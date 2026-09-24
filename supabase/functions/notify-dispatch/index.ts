// Dërgon njoftimet në pritje si Web Push. Thirret vetëm nga pg_cron, me sekretin e cron-it.
// Njoftimi nuk mbart përmbajtje: vetëm një titull dhe tekst i përgjithshëm sipas kategorisë.
// Asnjë vlerë matjeje, asnjë shënim, asnjë emër, asnjë tekst mesazhi, asnjë "zbuluam diçka".
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Lang = 'sq' | 'en';
const TEXT: Record<Lang, Record<string, [string, string]>> = {
  sq: {
    daily_reminder: ['A JE MIRË?', 'Kur të kesh një minutë, check-in-i i sotëm të pret.'],
    weekly_snapshot: ['Pamja javore', 'Pamja e javës është gati kur të duash ta shohësh.'],
    connection_request: ['Kërkesë e re', 'Dikush dëshiron të lidhet me ty.'],
    connection_accepted: ['Lidhje e re', 'Një kërkesë jote u pranua.'],
    unread_message: ['Mesazh i ri', 'Ke një mesazh të palexuar.'],
    challenge_ending: ['Sfida', 'Një sfidë ku merr pjesë mbaron nesër.'],
    app_update: ['Version i ri', 'Ka një version të ri të aplikacionit.']
  },
  en: {
    daily_reminder: ['A JE MIRË?', "Whenever you have a minute, today's check-in is here."],
    weekly_snapshot: ['Weekly snapshot', "This week's snapshot is ready whenever you want it."],
    connection_request: ['New request', 'Someone would like to connect with you.'],
    connection_accepted: ['New connection', 'One of your requests was accepted.'],
    unread_message: ['New message', 'You have an unread message.'],
    challenge_ending: ['Challenge', 'A challenge you joined ends tomorrow.'],
    app_update: ['New version', 'A new version of the app is available.']
  }
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

// Orët e qeta mund të kalojnë mesnatën (p.sh. 22:00–07:00).
function inQuietHours(timezone: string, start: string, end: string) {
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const now = local.slice(0, 5);
  const from = start.slice(0, 5);
  const to = end.slice(0, 5);
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

async function vapidKeys(admin: ReturnType<typeof createClient>) {
  const read = async (name: string) => (await admin.rpc('service_get_secret', { p_name: name })).data as string | null;
  let publicKey = await read('vapid_public_key');
  let privateKey = await read('vapid_private_key');
  if (!publicKey || !privateKey) {
    // Nisja e parë: çelësat krijohen këtu dhe ruhen direkt në Vault. Nuk dalin kurrë jashtë serverit.
    const generated = webpush.generateVAPIDKeys();
    await admin.rpc('service_store_secret', { p_name: 'vapid_public_key', p_value: generated.publicKey });
    await admin.rpc('service_store_secret', { p_name: 'vapid_private_key', p_value: generated.privateKey });
    publicKey = await read('vapid_public_key');
    privateKey = await read('vapid_private_key');
  }
  return { publicKey: publicKey!, privateKey: privateKey! };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: secret } = await admin.rpc('service_get_secret', { p_name: 'cron_secret' });
  if (!secret || !timingSafeEqual(req.headers.get('x-cron-secret') || '', secret as string)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const keys = await vapidKeys(admin);
  // Thirrja "setup" vetëm përgatit çelësat (për ndezjen e parë të modulit).
  const body = await req.json().catch(() => ({}));
  if (body && body.setup) return new Response(JSON.stringify({ ready: true }), { status: 200 });

  const { data: flag } = await admin.from('feature_flags').select('server_enabled').eq('key', 'notifications').single();
  if (!flag || !flag.server_enabled) return new Response(JSON.stringify({ skipped: 'disabled' }), { status: 200 });

  const subject = (await admin.rpc('service_get_secret', { p_name: 'vapid_subject' })).data || 'https://a-je-mire.vercel.app';
  webpush.setVapidDetails(subject as string, keys.publicKey, keys.privateKey);

  const { data: pending } = await admin.from('notifications')
    .select('id, user_id, category').is('sent_at', null)
    .gt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order('created_at').limit(200);

  let sent = 0, deferred = 0;
  for (const item of pending || []) {
    const { data: prefs } = await admin.from('notification_prefs')
      .select('enabled, categories, timezone, quiet_start, quiet_end, lang').eq('user_id', item.user_id).maybeSingle();
    // Pëlqimi mund të jetë tërhequr pas futjes në radhë: atëherë nuk dërgohet asgjë.
    if (!prefs || !prefs.enabled || !prefs.categories?.[item.category]) {
      await admin.from('notifications').update({ sent_at: new Date().toISOString() }).eq('id', item.id);
      continue;
    }
    if (inQuietHours(prefs.timezone, prefs.quiet_start, prefs.quiet_end)) { deferred += 1; continue; }

    const [title, text] = TEXT[(prefs.lang as Lang) || 'sq'][item.category];
    const payload = JSON.stringify({ title, body: text, url: '/#/notifications', tag: item.category });
    const { data: subscriptions } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', item.user_id);
    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600 });
        await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', subscription.id);
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: shfletuesi e ka tërhequr lejen — regjistrimi fshihet.
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
        else await admin.from('push_subscriptions').update({ failure_count: 1 }).eq('id', subscription.id);
      }
    }
    await admin.from('notifications').update({ sent_at: new Date().toISOString() }).eq('id', item.id);
  }
  // Vetëm numra në përgjigje; asnjë përmbajtje në log.
  return new Response(JSON.stringify({ sent, deferred }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
