// Pjesët e përbashkëta të moduleve sociale: avatari abstrakt, profili publik, raportimi, ri-hyrja.
import { icon, toast, openModal, closeLayer } from './ui.js';
import { escapeHtml } from './format.js';
import { t } from './i18n/index.js';
import { getClient } from './cloud/client.js';
import { currentUser, friendlyError, rpc } from './cloud/session.js';

// Avatar gjeometrik nga një numër i rastësishëm — pa foto, pa inicialet e emrit të vërtetë.
const PALETTE = ['#0f766e', '#5a52c2', '#2672ad', '#a8581a', '#3b7d52', '#8a4f7d', '#4b6584'];
export function avatarSvg(seed = 0, size = 36) {
  const pick = offset => PALETTE[Math.abs(seed + offset * 7919) % PALETTE.length];
  const shape = Math.abs(seed) % 3;
  const inner = shape === 0
    ? `<circle cx="20" cy="20" r="9" fill="${pick(1)}"/>`
    : shape === 1
      ? `<rect x="11" y="11" width="18" height="18" rx="4" fill="${pick(1)}" transform="rotate(${seed % 45} 20 20)"/>`
      : `<path d="M20 9 31 29H9z" fill="${pick(1)}"/>`;
  return `<svg class="avatar-svg" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="12" fill="${pick(0)}"/>${inner}<circle cx="${12 + (seed % 17)}" cy="30" r="3" fill="#fff" opacity=".7"/></svg>`;
}

let cachedProfile = undefined;

export async function loadMyProfile(force = false) {
  const user = currentUser();
  if (!user) return null;
  if (cachedProfile !== undefined && !force) return cachedProfile;
  const { data } = await getClient().from('public_profiles').select('nickname, bio, avatar_seed').eq('user_id', user.id).maybeSingle();
  cachedProfile = data || null;
  return cachedProfile;
}

export function forgetProfile() {
  cachedProfile = undefined;
}

// Profili publik: vetëm pseudonim dhe një bio e shkurtër. Asnjë email, emër i vërtetë, foto apo datëlindje.
export function profileSetupCard(profile) {
  return `<section class="card" id="profile-setup">
    <h2 class="card-title">${escapeHtml(profile ? t('social.profileTitleEdit') : t('social.profileTitle'))}</h2>
    <p class="muted small mt-2">${escapeHtml(t('social.profileIntro'))}</p>
    <form class="stack mt-4" data-profile-form>
      <div class="field">
        <label for="p-nickname">${escapeHtml(t('social.nickname'))} <span class="field-hint">${escapeHtml(t('social.nicknameHint'))}</span></label>
        <input id="p-nickname" name="nickname" required minlength="3" maxlength="24" pattern="[A-Za-z0-9ÇçËë_.\\-]{3,24}" autocomplete="off" value="${escapeHtml(profile ? profile.nickname : '')}">
      </div>
      <div class="field">
        <label for="p-bio">${escapeHtml(t('social.bio'))} <span class="field-hint">${escapeHtml(t('social.optional'))}</span></label>
        <textarea id="p-bio" name="bio" rows="2" maxlength="160">${escapeHtml(profile ? profile.bio : '')}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">${icon('check', 16)} ${escapeHtml(t('common.save'))}</button>
    </form>
    <p class="card-note">${escapeHtml(t('social.profilePrivacy'))}</p>
  </section>`;
}

export function wireProfileSetup(container, onSaved) {
  const form = container.querySelector('[data-profile-form]');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const row = { user_id: currentUser().id, nickname: String(data.get('nickname')).trim(), bio: String(data.get('bio') || '').trim() };
    const { error } = await getClient().from('public_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) { toast(friendlyError(error), 'err'); return; }
    forgetProfile();
    toast(t('social.profileSaved'), 'ok');
    onSaved();
  });
}

const REASONS = ['spam', 'harassment', 'hate', 'safety_concern', 'sexual', 'privacy', 'impersonation', 'other'];

// Raportimi: arsyeja, detaje opsionale, dhe paralajmërimi për të dhënat personale.
export function openReportDialog(type, targetId, onDone = () => {}) {
  const panel = openModal(t('report.title'), `
    <form class="stack" data-report-form>
      <p class="warn">${icon('info', 14)} ${escapeHtml(t('report.privacyWarning'))}</p>
      <fieldset class="stack">
        <legend class="small">${escapeHtml(t('report.reason'))}</legend>
        ${REASONS.map((reason, index) => `<label class="check-row"><input type="radio" name="reason" value="${reason}" ${index === 0 ? 'checked' : ''}>
          <span>${escapeHtml(t(`report.reasons.${reason}`))}</span></label>`).join('')}
      </fieldset>
      <div class="field">
        <label for="r-details">${escapeHtml(t('report.details'))} <span class="field-hint">${escapeHtml(t('social.optional'))}</span></label>
        <textarea id="r-details" name="details" rows="3" maxlength="500"></textarea>
      </div>
      <p class="card-note">${escapeHtml(t(type === 'message' || type === 'conversation' ? 'report.privateNote' : 'report.note'))}</p>
      <p class="card-note">${escapeHtml(t('report.safetyNote'))}</p>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
        <button type="submit" class="btn btn-danger">${icon('shield', 15)} ${escapeHtml(t('report.send'))}</button>
      </div>
    </form>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-report-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      await rpc('report_content', { p_type: type, p_target: String(targetId), p_reason: data.get('reason'), p_details: String(data.get('details') || '') });
      closeLayer();
      toast(t('report.sent'), 'ok');
      onDone();
    } catch (error) {
      toast(error.message, 'err');
    }
  });
}

export async function blockUser(userId, onDone = () => {}) {
  const panel = openModal(t('social.blockTitle'), `
    <p class="muted small">${escapeHtml(t('social.blockExplain'))}</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
      <button type="button" class="btn btn-danger" data-confirm>${escapeHtml(t('social.block'))}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', async () => {
    try {
      await rpc('block_user', { p_target: userId });
      closeLayer();
      toast(t('social.blocked'), 'ok');
      onDone();
    } catch (error) {
      toast(error.message, 'err');
    }
  });
}

export async function muteUser(userId, onDone = () => {}) {
  const { error } = await getClient().from('mutes').insert({ muter_id: currentUser().id, muted_id: userId });
  if (error && !/duplicate/.test(error.message)) { toast(friendlyError(error), 'err'); return; }
  toast(t('social.muted'), 'ok');
  onDone();
}

// Veprimet shumë të ndjeshme kërkojnë fjalëkalimin sërish (serveri e kontrollon me "amr" në JWT).
export function withReauth(action) {
  return async (...args) => {
    try {
      return await action(...args);
    } catch (error) {
      if (error.message !== t('errors.reauth_required')) throw error;
      const password = await askPassword();
      if (!password) throw new Error(t('errors.reauth_required'));
      const { error: signError } = await getClient().auth.signInWithPassword({ email: currentUser().email, password });
      if (signError) throw new Error(t('errors.reauth_failed'));
      return action(...args);
    }
  };
}

function askPassword() {
  return new Promise(resolve => {
    const panel = openModal(t('admin.reauthTitle'), `
      <form class="stack" data-reauth>
        <p class="muted small">${escapeHtml(t('admin.reauthExplain'))}</p>
        <div class="field"><label for="reauth-password">${escapeHtml(t('account.password'))}</label>
          <input id="reauth-password" type="password" autocomplete="current-password" required></div>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
          <button type="submit" class="btn btn-primary">${escapeHtml(t('common.confirm'))}</button>
        </div>
      </form>`);
    panel.querySelector('[data-cancel]').addEventListener('click', () => { closeLayer(); resolve(null); });
    panel.querySelector('[data-reauth]').addEventListener('submit', event => {
      event.preventDefault();
      const value = panel.querySelector('#reauth-password').value;
      closeLayer();
      resolve(value);
    });
  });
}

export function signInPrompt(message) {
  return `<section class="card">
    <p class="muted small">${icon('lock', 14)} ${escapeHtml(message)}</p>
    <a href="#/account" class="btn btn-primary mt-4" data-go="account">${icon('cloud', 16)} ${escapeHtml(t('social.goToAccount'))}</a>
  </section>`;
}
