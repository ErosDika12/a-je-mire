// Njoftimet opsionale. Leja e shfletuesit kërkohet vetëm kur përdoruesi ndez qëllimisht një kategori.
// Asnjë njoftim diagnostik, rreziku, "zbuluam diçka", vlerë matjeje, shënim apo mesazh automatik.
import { icon, toast } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, getLang, formatDateTime } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, currentUser, friendlyError, rpc } from '../cloud/session.js';
import { signInPrompt } from '../social.js';
import { recordConsent } from '../storage.js';

export const CATEGORIES = ['daily_reminder', 'weekly_snapshot', 'connection_request', 'connection_accepted', 'unread_message', 'challenge_ending', 'app_update'];

export async function renderNotifications(container, app) {
  container.innerHTML = head() + `<section class="card"><p class="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p></section>`;
  const user = await ensureSession();
  if (!user) { container.innerHTML = head() + signInPrompt(t('notify.signInNeeded')); return; }
  const [{ data: prefs }, { data: history }] = await Promise.all([
    getClient().from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle(),
    getClient().from('notifications').select('id, category, created_at, sent_at, read_at').order('created_at', { ascending: false }).limit(30)
  ]);
  await handleRevocation(prefs);
  const current = prefs || { enabled: false, categories: {}, reminder_time: '20:00:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Belgrade', quiet_start: '22:00:00', quiet_end: '07:00:00', lang: getLang() };
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';

  container.innerHTML = head() + `
    <section class="card card-soft">
      <p class="small">${icon('info', 14)} ${escapeHtml(t('notify.explain'))}</p>
      <p class="small mt-2">${escapeHtml(t(`notify.permission_${permission}`))}</p>
    </section>
    <form class="card mt-4 stack" id="notify-form">
      <label class="switch-row ${current.enabled ? 'is-on' : ''}" for="n-enabled">
        <input type="checkbox" id="n-enabled" ${current.enabled ? 'checked' : ''}>
        <span class="switch" aria-hidden="true"></span>
        <span class="switch-text"><strong>${escapeHtml(t('notify.master'))}</strong><span>${escapeHtml(t('notify.masterHint'))}</span></span>
      </label>
      <fieldset class="stack"><legend class="small">${escapeHtml(t('notify.categories'))}</legend>
        ${CATEGORIES.map(key => `<label class="check-row"><input type="checkbox" name="cat" value="${key}" ${current.categories[key] ? 'checked' : ''}>
          <span><strong>${escapeHtml(t(`notify.cat_${key}`))}</strong> <span class="muted">— ${escapeHtml(t(`notify.catHint_${key}`))}</span></span></label>`).join('')}
      </fieldset>
      <div class="grid grid-2">
        <div class="field"><label for="n-time">${escapeHtml(t('notify.reminderTime'))}</label><input id="n-time" type="time" value="${current.reminder_time.slice(0, 5)}"></div>
        <div class="field"><label for="n-tz">${escapeHtml(t('notify.timezone'))}</label><input id="n-tz" value="${escapeHtml(current.timezone)}" maxlength="64" list="tz-list">
          <datalist id="tz-list">${['Europe/Belgrade', 'Europe/Tirane', 'Europe/Skopje', 'Europe/Berlin', 'Europe/London', 'America/New_York'].map(zone => `<option value="${zone}">`).join('')}</datalist></div>
        <div class="field"><label for="n-quiet-start">${escapeHtml(t('notify.quietStart'))}</label><input id="n-quiet-start" type="time" value="${current.quiet_start.slice(0, 5)}"></div>
        <div class="field"><label for="n-quiet-end">${escapeHtml(t('notify.quietEnd'))}</label><input id="n-quiet-end" type="time" value="${current.quiet_end.slice(0, 5)}"></div>
      </div>
      <div class="row">
        <button type="submit" class="btn btn-primary">${icon('check', 16)} ${escapeHtml(t('common.save'))}</button>
        <button type="button" class="btn btn-danger" id="n-off">${escapeHtml(t('notify.disableAll'))}</button>
      </div>
      <p class="card-note">${escapeHtml(t('notify.never'))}</p>
    </form>
    <section class="card mt-4">
      <div class="row-between"><h2 class="card-title">${escapeHtml(t('notify.history'))}</h2>
        ${(history || []).some(item => !item.read_at) ? `<button type="button" class="btn btn-sm" id="n-read">${escapeHtml(t('notify.markRead'))}</button>` : ''}</div>
      <ul class="changelog mt-3">${(history || []).map(item => `<li class="${item.read_at ? '' : 'is-unread'}">${escapeHtml(t(`notify.cat_${item.category}`))} ·
        <time datetime="${escapeHtml(item.created_at)}">${escapeHtml(formatDateTime(item.created_at))}</time></li>`).join('') || `<li>${escapeHtml(t('notify.noHistory'))}</li>`}</ul>
    </section>`;

  const form = container.querySelector('#notify-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const categories = Object.fromEntries(CATEGORIES.map(key => [key, form.querySelector(`[value="${key}"]`).checked]));
    const enabled = form.querySelector('#n-enabled').checked && Object.values(categories).some(Boolean);
    // Leja kërkohet vetëm tani, pas një veprimi të qëllimshëm, dhe vetëm nëse diçka u ndez.
    if (enabled) {
      const ok = await enablePush();
      if (!ok) toast(t('notify.permissionDenied'), 'err');
    }
    const row = {
      user_id: user.id, enabled, categories,
      reminder_time: form.querySelector('#n-time').value || '20:00',
      timezone: form.querySelector('#n-tz').value.trim() || 'Europe/Belgrade',
      quiet_start: form.querySelector('#n-quiet-start').value || '22:00',
      quiet_end: form.querySelector('#n-quiet-end').value || '07:00',
      lang: getLang()
    };
    const { error } = await getClient().from('notification_prefs').upsert(row, { onConflict: 'user_id' });
    if (error) { toast(friendlyError(error), 'err'); return; }
    recordConsent(app.profile, 'notifications', enabled);
    // Njoftimi "version i ri" shfaqet nga vetë pajisja, prandaj zgjedhja ruhet edhe lokalisht.
    app.profile.settings.appUpdateNotice = enabled && categories.app_update;
    app.save();
    await getClient().from('consent_records').insert({ user_id: user.id, kind: 'notifications', granted: enabled, policy_version: '2026-09' });
    toast(t('notify.saved'), 'ok');
    renderNotifications(container, app);
  });
  container.querySelector('#n-off').addEventListener('click', async () => {
    await disableAll(user.id);
    app.profile.settings.appUpdateNotice = false;
    recordConsent(app.profile, 'notifications', false);
    app.save();
    toast(t('notify.allOff'), 'ok');
    renderNotifications(container, app);
  });
  const read = container.querySelector('#n-read');
  if (read) read.addEventListener('click', async () => { await rpc('mark_notifications_read'); renderNotifications(container, app); });
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('notify.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('notify.subtitle'))}</p>
  </header>`;
}

function base64ToBytes(value) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await rpc('get_vapid_public_key');
      if (!publicKey) return false;
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
    }
    const json = subscription.toJSON();
    await getClient().from('push_subscriptions').upsert({ user_id: currentUser().id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint', ignoreDuplicates: true });
    return true;
  } catch (error) {
    return false;
  }
}

async function disableAll(userId) {
  await getClient().from('notification_prefs').upsert({ user_id: userId, enabled: false, categories: {} }, { onConflict: 'user_id' });
  await getClient().from('push_subscriptions').delete().eq('user_id', userId);
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (error) { /* shfletuesi pa push */ }
}

// Nëse përdoruesi e ka hequr lejen te shfletuesi, regjistrimet në server fshihen.
async function handleRevocation(prefs) {
  if (!prefs || !('Notification' in window)) return;
  if (Notification.permission === 'denied') await getClient().from('push_subscriptions').delete().eq('user_id', currentUser().id);
}

export function wantsUpdateNotice(prefs) {
  return Boolean(prefs && prefs.enabled && prefs.categories && prefs.categories.app_update);
}
