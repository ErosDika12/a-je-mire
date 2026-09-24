// Abonimi Plus (opsional). Modaliteti lokal, check-ins, My Normal, Something Changed, Patterns,
// eksporti, llogaria bazë dhe fshirja mbeten falas përgjithmonë. Pagesa bëhet vetëm te faqja e Stripe.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatDateTime } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, friendlyError, rpc } from '../cloud/session.js';
import { signInPrompt } from '../social.js';
import { currentPassphrase } from '../cloud/sync.js';
import { decryptJson } from '../cloud/crypto.js';
import { migrate, saveLocalBackup } from '../storage.js';

const FREE = ['local', 'checkins', 'normal', 'changed', 'patterns', 'export', 'account', 'backup'];
const PLUS = ['devices', 'history', 'visuals', 'challenges', 'ai', 'versions'];

export async function renderSubscription(container, app) {
  container.innerHTML = head() + `<section class="card"><p class="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p></section>`;
  const user = await ensureSession();
  if (!user) { container.innerHTML = head() + plans() + signInPrompt(t('plus.signInNeeded')); return; }
  let status;
  try { status = await rpc('my_subscription'); } catch (error) { status = { plus: false }; }
  const params = new URLSearchParams((location.hash.split('?')[1]) || '');
  const checkout = params.get('checkout');

  container.innerHTML = head() + `
    ${checkout === 'success' ? `<section class="card card-soft"><p class="small">${icon('check', 14)} ${escapeHtml(t('plus.checkoutSuccess'))}</p></section>` : ''}
    ${checkout === 'cancelled' ? `<section class="card card-soft"><p class="small">${icon('info', 14)} ${escapeHtml(t('plus.checkoutCancelled'))}</p></section>` : ''}
    ${plans()}
    <section class="card mt-4">
      <h2 class="card-title">${escapeHtml(t('plus.statusTitle'))}</h2>
      <dl class="mt-3">
        <div class="data-row"><dt>${escapeHtml(t('plus.plan'))}</dt><dd>${escapeHtml(status.plus ? 'Plus' : t('plus.free'))}</dd></div>
        ${status.status ? `<div class="data-row"><dt>${escapeHtml(t('plus.state'))}</dt><dd>${escapeHtml(t(`plus.s_${status.status}`))}</dd></div>` : ''}
        ${status.current_period_end ? `<div class="data-row"><dt>${escapeHtml(status.cancel_at_period_end ? t('plus.endsOn') : t('plus.renewsOn'))}</dt><dd>${escapeHtml(formatDateTime(status.current_period_end, false))}</dd></div>` : ''}
        ${status.grace_until ? `<div class="data-row"><dt>${escapeHtml(t('plus.grace'))}</dt><dd>${escapeHtml(formatDateTime(status.grace_until, false))}</dd></div>` : ''}
      </dl>
      ${status.status === 'past_due' ? `<p class="warn mt-3">${escapeHtml(t('plus.paymentFailed'))}</p>` : ''}
      <div class="row mt-4">
        ${status.plus ? '' : `<button type="button" class="btn btn-primary" data-billing="checkout">${icon('lock', 16)} ${escapeHtml(t('plus.upgrade'))}</button>`}
        ${status.has_customer ? `<button type="button" class="btn" data-billing="portal">${escapeHtml(t('plus.manage'))}</button>` : ''}
        ${status.plus && !status.cancel_at_period_end ? `<button type="button" class="btn btn-danger" id="cancel-plus">${escapeHtml(t('plus.cancel'))}</button>` : ''}
        <button type="button" class="btn" data-billing="restore">${escapeHtml(t('plus.restore'))}</button>
      </div>
      <p class="card-note">${escapeHtml(t('plus.hostedNote'))}</p>
      <p class="card-note">${escapeHtml(t('plus.cancelNote'))}</p>
    </section>
    ${status.plus ? `<section class="card mt-4" id="versions"></section>` : ''}`;

  for (const button of container.querySelectorAll('[data-billing]')) button.addEventListener('click', () => billing(button.dataset.billing, container, app));
  const cancel = container.querySelector('#cancel-plus');
  if (cancel) cancel.addEventListener('click', () => {
    const panel = openModal(t('plus.cancelTitle'), `<p class="small">${escapeHtml(t('plus.cancelExplain'))}</p>
      <div class="row mt-5" style="justify-content:flex-end"><button type="button" class="btn" data-cancel>${escapeHtml(t('common.back'))}</button>
      <button type="button" class="btn btn-danger" data-confirm>${escapeHtml(t('plus.cancel'))}</button></div>`);
    panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
    panel.querySelector('[data-confirm]').addEventListener('click', () => { closeLayer(); billing('cancel', container, app); });
  });
  if (status.plus) renderVersions(container.querySelector('#versions'), app);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('plus.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('plus.subtitle'))}</p>
  </header>`;
}

function plans() {
  return `<div class="grid grid-2">
    <section class="card"><h2 class="card-title">${escapeHtml(t('plus.free'))}</h2><p class="small muted">${escapeHtml(t('plus.freePrice'))}</p>
      <ul class="facts mt-3">${FREE.map(key => `<li class="fact"><span class="fact-ic">${icon('check', 14)}</span><span>${escapeHtml(t(`plus.f_${key}`))}</span></li>`).join('')}</ul></section>
    <section class="card"><h2 class="card-title">Plus</h2><p class="small muted">${escapeHtml(t('plus.pricePlaceholder'))}</p>
      <ul class="facts mt-3">${PLUS.map(key => `<li class="fact"><span class="fact-ic">${icon('spark', 14)}</span><span>${escapeHtml(t(`plus.p_${key}`))}</span></li>`).join('')}</ul></section>
  </div>`;
}

async function billing(action, container, app) {
  const { data, error } = await getClient().functions.invoke('billing', { body: { action, return_origin: location.origin } });
  let code = data && data.error;
  if (!code && error && error.context && typeof error.context.json === 'function') code = (await error.context.json().catch(() => ({}))).error;
  if (code) { toast(friendlyError({ message: code }), 'err'); return; }
  if (data && data.url) {
    // Vetëm faqet e Stripe: asnjë ridrejtim tjetër nuk ndiqet.
    if (/^https:\/\/(checkout|billing)\.stripe\.com\//.test(data.url)) location.assign(data.url);
    else toast(t('errors.generic'), 'err');
    return;
  }
  toast(t('plus.updated'), 'ok');
  renderSubscription(container, app);
}

// Historiku i kopjeve (Plus): versionet e vjetra, të enkriptuara, që mund të rikthehen me fjalëkalimin e sinkronizimit.
async function renderVersions(section, app) {
  const { data, error } = await getClient().from('backup_versions').select('id, revision, saved_at, format_version').order('revision', { ascending: false });
  if (error) { section.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  section.innerHTML = `<h2 class="card-title">${escapeHtml(t('plus.versions'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('plus.versionsNote'))}</p>
    <ul class="stack mt-3">${data.map(row => `<li class="row-between"><span class="small">${escapeHtml(t('plus.revision', { n: row.revision }))} · ${escapeHtml(formatDateTime(row.saved_at))}</span>
      <button type="button" class="btn btn-sm" data-restore-version="${row.id}">${escapeHtml(t('plus.restoreVersion'))}</button></li>`).join('') || `<li class="small muted">${escapeHtml(t('plus.noVersions'))}</li>`}</ul>`;
  for (const button of section.querySelectorAll('[data-restore-version]')) button.addEventListener('click', async () => {
    const passphrase = currentPassphrase();
    if (!passphrase) { toast(t('plus.needPassphrase'), 'err'); return; }
    const { data: row } = await getClient().from('backup_versions').select('ciphertext, salt, iv, format_version').eq('id', button.dataset.restoreVersion).single();
    try {
      const plain = await decryptJson({ ciphertext: row.ciphertext, salt: row.salt, iv: row.iv, formatVersion: row.format_version }, passphrase);
      const restored = migrate(plain);
      saveLocalBackup(app.profile);
      restored.consent = { ...app.profile.consent };
      restored.sync = app.profile.sync;
      app.replaceProfile(restored);
      toast(t('plus.versionRestored'), 'ok');
    } catch (error) {
      toast(t('errors.passphrase'), 'err');
    }
  });
}
