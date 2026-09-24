// Veprimet e faturimit për përdoruesin e kyçur: checkout, portali, anulimi, rikthimi i blerjeve.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { serviceClient, secret, stripeClient, saveSubscription } from '../_shared/billing.ts';

const ALLOWED_ORIGINS = ['https://a-je-mire.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];

function allowedOrigin(origin: string | null) {
  return Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/a-je-mire-[a-z0-9-]+-erosdika12s-projects\.vercel\.app$/.test(origin)));
}

function headersFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = headersFor(origin);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: auth } = await userClient.auth.getUser(token);
  if (!auth?.user) return reply({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  const { data: enabled } = await userClient.rpc('feature_enabled', { p_key: 'subscriptions' });
  if (!enabled) return reply({ error: 'feature_disabled' }, 403);

  const admin = serviceClient();
  const key = await secret(admin, 'stripe_secret_key');
  if (!key) return reply({ error: 'not_configured' }, 503);
  const stripe = stripeClient(key);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  // Kthimi pas pagesës lejohet vetëm te origjinat e njohura — kurrë te një adresë e dhënë nga jashtë.
  const returnOrigin = allowedOrigin(body.return_origin) ? body.return_origin : ALLOWED_ORIGINS[0];
  const returnUrl = `${returnOrigin}/#/subscription`;

  const { data: customerRow } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  let customerId = customerRow?.stripe_customer_id as string | undefined;

  try {
    if (action === 'checkout') {
      const price = await secret(admin, 'stripe_price_plus');
      if (!price) return reply({ error: 'not_configured' }, 503);
      if (!customerId) {
        // Klienti krijohet pa email dhe pa emër: Stripe i mbledh vetë në faqen e vet të pagesës.
        const customer = await stripe.customers.create({ metadata: { user_id: userId } });
        customerId = customer.id;
        await admin.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { user_id: userId } },
        success_url: `${returnUrl}?checkout=success`,
        cancel_url: `${returnUrl}?checkout=cancelled`
      });
      return reply({ url: session.url });
    }

    if (!customerId) return reply({ error: 'no_customer' }, 404);

    if (action === 'portal') {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
      return reply({ url: portal.url });
    }

    if (action === 'cancel') {
      const { data: row } = await admin.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).maybeSingle();
      if (!row?.stripe_subscription_id) return reply({ error: 'no_subscription' }, 404);
      // Anulimi në fund të periudhës: asnjë e dhënë nuk fshihet.
      const updated = await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
      await saveSubscription(admin, updated);
      return reply({ ok: true });
    }

    if (action === 'restore') {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 5 });
      const latest = list.data.sort((left, right) => right.created - left.created)[0];
      if (latest) await saveSubscription(admin, latest);
      return reply({ ok: true, found: Boolean(latest) });
    }
  } catch (_error) {
    return reply({ error: 'provider_error' }, 502);
  }
  return reply({ error: 'invalid_action' }, 400);
});
