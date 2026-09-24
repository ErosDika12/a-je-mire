// Llogaria dhe Qendra e sinkronizimit. E gjithë kjo është opsionale:
// pa llogari aplikacioni punon njësoj, dhe asgjë nuk largohet nga pajisja.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml, formatDateLong } from '../format.js';
import { METRICS } from '../patterns.js';
import { saveLocalBackup, recordConsent } from '../storage.js';
import { findConflicts, mergeProfiles } from '../merge.js';
import { cloudConfigured, getClient, redirectUrl } from '../cloud/client.js';
import { MIN_PASSPHRASE } from '../cloud/crypto.js';
import {
  ensureSyncState, fetchBackupInfo, downloadBackup, uploadBackup, deleteCloudBackup,
  listConsentRecords, addConsentRecord, deleteAccount,
  rememberPassphrase, currentPassphrase, forgetPassphrase
} from '../cloud/sync.js';
import { setSessionUser } from '../cloud/session.js';
import { forgetProfile } from '../social.js';
import { t } from '../i18n/index.js';

const MIN_PASSWORD = 10;

// Gjendja e ekranit mbahet në memorie, jo në disk.
const state = {
  ready: false,
  user: null,
  recovery: false,
  view: 'login',
  backupInfo: undefined,
  consents: null,
  pending: null,   // { remote, conflicts, resolutions } kur ka konflikte për t'u zgjidhur
  busy: false,
  message: null
};

let appRef = null;
let hostRef = null;

// Thirret një herë, kur aplikacioni ka nevojë për llogarinë (ekrani hapet ose vjen një link emaili).
export async function initAuth(app) {
  appRef = app;
  if (state.ready || !cloudConfigured()) return;
  state.ready = true;
  const client = getClient();
  client.auth.onAuthStateChange((event, session) => {
    state.user = session ? session.user : null;
    // Ekranet e tjera (komuniteti, mentori...) lexojnë të njëjtin sesion.
    setTimeout(() => setSessionUser(state.user), 0);
    if (event === 'SIGNED_OUT') forgetProfile();
    if (event === 'PASSWORD_RECOVERY') state.recovery = true;
    if (event === 'SIGNED_OUT') { resetCloudState(); forgetPassphrase(); }
    // Supabase-i thërret këtë brenda vetes; rivizatimi shtyhet që të mos bllokojë.
    setTimeout(redraw, 0);
  });
  const { data } = await client.auth.getSession();
  state.user = data.session ? data.session.user : null;
  await setSessionUser(state.user);
  // Pas linkut të emailit, adresa pastrohet që kodi të mos mbetet në histori.
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
}

function resetCloudState() {
  state.backupInfo = undefined;
  state.consents = null;
  state.pending = null;
}

function redraw() {
  if (hostRef && hostRef.isConnected && !hostRef.hidden) renderAccount(hostRef, appRef);
}

export function renderAccount(container, app) {
  hostRef = container;
  appRef = app;

  if (!cloudConfigured()) {
    container.innerHTML = `${head()}
      <section class="card"><p class="muted small">${icon('info', 14)} ${t('acct.notActive')}</p></section>`;
    return;
  }

  if (!state.ready) {
    container.innerHTML = `${head()}<section class="card"><p class="status">${icon('refresh', 14)} ${t('acct.connecting')}</p></section>`;
    initAuth(app).then(redraw);
    return;
  }

  if (state.recovery) {
    container.innerHTML = head() + newPasswordCard();
    wireNewPassword(container);
    return;
  }

  if (!state.user) {
    container.innerHTML = head() + guestIntro() + authCard();
    wireAuth(container);
    return;
  }

  // Të dhënat nga serveri merren një herë për çdo hyrje, jo në çdo rivizatim.
  if (state.consents === null) {
    state.consents = [];
    loadServerState().then(redraw);
  }

  container.innerHTML = head() + accountCard() + (hasTerms() ? syncCentre(app) : termsGate()) + securityCard() + deletionCard();
  wireSignedIn(container, app);
}

async function loadServerState() {
  // Rreshti i profilit krijohet në hyrjen e parë; "ignoreDuplicates" e bën këtë pa gabim kur ekziston.
  await getClient().from('profiles').upsert({ id: state.user.id }, { onConflict: 'id', ignoreDuplicates: true });
  try {
    state.consents = await listConsentRecords();
    state.backupInfo = await fetchBackupInfo();
  } catch (error) {
    state.message = t('acct.serverUnreachable');
  }
}

function hasTerms() {
  const latest = kind => (state.consents || []).find(item => item.kind === kind);
  const terms = latest('terms');
  const privacy = latest('privacy');
  return Boolean(terms && terms.granted && privacy && privacy.granted);
}

// ---------- pjesët e faqes ----------

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${t('acct.title')}</h1>
    <p class="page-sub">${t('acct.subtitle')}</p>
  </header>`;
}

function guestIntro() {
  return `<section class="card card-soft">
    <ul class="facts">
      <li class="fact"><span class="fact-ic">${icon('shield', 16)}</span><span>${t('acct.guest1')}</span></li>
      <li class="fact"><span class="fact-ic">${icon('lock', 16)}</span><span>${t('acct.guest2')}</span></li>
      <li class="fact"><span class="fact-ic">${icon('cloud', 16)}</span><span>${t('acct.guest3')}</span></li>
    </ul>
  </section>`;
}

function authCard() {
  const tabs = [['login', t('acct.tabLogin')], ['register', t('acct.tabRegister')], ['reset', t('acct.tabReset')]];
  const body = {
    login: `<form class="stack" data-form="login">
        ${field('email', t('acct.email'), 'email', 'email')}
        ${field('password', t('acct.password'), 'password', 'current-password')}
        <button type="submit" class="btn btn-primary">${icon('lock', 16)} ${t('acct.login')}</button>
      </form>`,
    register: `<form class="stack" data-form="register">
        ${field('email', t('acct.email'), 'email', 'email')}
        ${field('password', `${t('acct.password')} <span class="field-hint">${t('acct.minChars', { n: MIN_PASSWORD })}</span>`, 'password', 'new-password')}
        ${field('password2', t('acct.repeatPassword'), 'password', 'new-password')}
        <label class="check-row"><input type="checkbox" name="terms" required>
          <span>${t('acct.acceptPrefix')} <a href="#/privacy" data-go="privacy">${t('acct.privacyTerms')}</a>.</span></label>
        <button type="submit" class="btn btn-primary">${icon('check', 16)} ${t('acct.createAccount')}</button>
        <p class="card-note">${t('acct.registerNote')}</p>
      </form>`,
    reset: `<form class="stack" data-form="reset">
        ${field('email', t('acct.email'), 'email', 'email')}
        <button type="submit" class="btn btn-primary">${icon('refresh', 16)} ${t('acct.sendReset')}</button>
        <p class="card-note">${t('acct.resetNote')}</p>
      </form>`
  };
  return `<section class="card mt-4">
    <div class="seg-control" role="group" aria-label="${t('acct.pickAction')}">
      ${tabs.map(([key, label]) => `<button type="button" data-view="${key}" aria-pressed="${state.view === key}">${label}</button>`).join('')}
    </div>
    <div class="mt-4">${body[state.view]}</div>
    ${messageLine()}
  </section>`;
}

function field(name, label, type, autocomplete) {
  return `<div class="field">
    <label for="f-${name}">${label}</label>
    <input id="f-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required maxlength="200">
  </div>`;
}

function messageLine() {
  return state.message ? `<p class="status mt-3" role="status">${icon('info', 14)} ${escapeHtml(state.message)}</p>` : '';
}

function newPasswordCard() {
  return `<section class="card">
    <h2 class="card-title">${t('acct.newPassTitle')}</h2>
    <form class="stack mt-4" data-form="newpass">
      ${field('password', `${t('acct.newPass')} <span class="field-hint">${t('acct.minChars', { n: MIN_PASSWORD })}</span>`, 'password', 'new-password')}
      ${field('password2', t('acct.repeat'), 'password', 'new-password')}
      <button type="submit" class="btn btn-primary">${icon('check', 16)} ${t('acct.save')}</button>
    </form>
    ${messageLine()}
  </section>`;
}

function accountCard() {
  const verified = Boolean(state.user.email_confirmed_at);
  return `<section class="card">
    <div class="row-between">
      <div>
        <p class="small muted">${t('acct.signedInAs')}</p>
        <p><strong>${escapeHtml(state.user.email || '')}</strong></p>
      </div>
      <span class="pill ${verified ? 'pill-accent' : 'pill-amber'}">${icon(verified ? 'check' : 'info', 13)} ${verified ? t('acct.verified') : t('acct.notVerified')}</span>
    </div>
    ${messageLine()}
  </section>`;
}

function termsGate() {
  return `<section class="card mt-4">
    <h2 class="card-title">${t('acct.beforeBackup')}</h2>
    <p class="muted small mt-2">${t('acct.beforeBackupText')}</p>
    <label class="check-row mt-4"><input type="checkbox" id="accept-terms">
      <span>${t('acct.acceptVersion')} <a href="#/privacy" data-go="privacy">${t('acct.privacyTerms')}</a> ${t('acct.versionSuffix')}</span></label>
    <button type="button" class="btn btn-primary mt-4" data-accept-terms disabled>${icon('check', 16)} ${t('acct.continue')}</button>
  </section>`;
}

function syncCentre(app) {
  const profile = app.profile;
  const sync = profile.sync || {};
  const info = state.backupInfo;
  const hasPass = Boolean(currentPassphrase());

  let cloudLine;
  if (info === undefined) cloudLine = `${icon('refresh', 14)} ${t('acct.checking')}`;
  else if (info === null) cloudLine = t('acct.noCloud');
  else cloudLine = `${t('acct.revision', { n: info.revision })} · ${escapeHtml(formatStamp(info.updated_at))} · ${info.device_id === sync.deviceId ? t('acct.fromThis') : t('acct.fromOther')}`;

  const behind = info && sync.revision !== info.revision;

  return `<section class="card mt-4" id="sync-centre">
    <div class="card-head">
      <span class="fact-ic">${icon('cloud', 20)}</span>
      <div>
        <h2 class="card-title">${t('acct.syncTitle')}</h2>
        <p class="card-sub">${t('acct.syncHint')}</p>
      </div>
    </div>

    <dl>
      <div class="data-row"><dt>${t('acct.onDevice')}</dt><dd>${t('acct.onDeviceDays', { n: profile.checkins.length })}${profile.mode === 'demo' ? t('acct.demoSuffix') : ''}</dd></div>
      <div class="data-row"><dt>${t('acct.inCloud')}</dt><dd>${cloudLine}</dd></div>
      <div class="data-row"><dt>${t('acct.lastSync')}</dt><dd>${sync.lastSyncedAt ? escapeHtml(formatStamp(sync.lastSyncedAt)) : t('acct.never')}</dd></div>
    </dl>
    ${behind ? `<p class="warn mt-3">${icon('info', 14)} ${t('acct.behind')}</p>` : ''}

    ${hasPass ? `
      <p class="status mt-4">${icon('lock', 14)} ${t('acct.passActive')}
        <button type="button" class="btn btn-sm" data-forget-pass>${t('acct.forgetNow')}</button></p>
      <div class="row mt-4">
        ${info ? `<button type="button" class="btn btn-primary" data-sync ${state.busy ? 'disabled' : ''}>${icon('refresh', 16)} ${t('acct.syncNow')}</button>
                  <button type="button" class="btn" data-restore ${state.busy ? 'disabled' : ''}>${icon('download', 16)} ${t('acct.restore')}</button>`
               : `<button type="button" class="btn btn-primary" data-first-upload ${state.busy ? 'disabled' : ''}>${icon('upload', 16)} ${t('acct.firstUpload')}</button>`}
      </div>`
    : `
      <form class="stack mt-4" data-form="passphrase">
        <div class="field">
          <label for="f-passphrase">${t('acct.passphrase')} <span class="field-hint">${t('acct.passphraseHint', { n: MIN_PASSPHRASE })}</span></label>
          <input id="f-passphrase" name="passphrase" type="password" autocomplete="off" required minlength="${MIN_PASSPHRASE}" maxlength="200">
        </div>
        ${info ? '' : `<div class="field">
          <label for="f-passphrase2">${t('acct.repeat')}</label>
          <input id="f-passphrase2" name="passphrase2" type="password" autocomplete="off" required maxlength="200">
        </div>`}
        <button type="submit" class="btn btn-primary">${icon('lock', 16)} ${t('acct.useForSession')}</button>
      </form>
      <p class="card-note">${t('acct.passphraseNote')}</p>`}

    ${state.pending ? conflictPanel(state.pending) : ''}
  </section>`;
}

function conflictPanel(pending) {
  return `<div class="card card-soft mt-4" id="conflicts">
    <h3 class="card-title">${pending.conflicts.length === 1 ? t('acct.conflictsOne') : t('acct.conflictsMany', { n: pending.conflicts.length })}</h3>
    <p class="muted small mt-2">${t('acct.conflictsHint')}</p>
    ${pending.conflicts.map(item => `
      <fieldset class="conflict mt-4">
        <legend><strong>${escapeHtml(formatDateLong(item.date))}</strong></legend>
        <div class="conflict-grid">
          ${conflictOption(item, 'local', t('acct.thisDevice'), item.local, pending.resolutions[item.date])}
          ${conflictOption(item, 'incoming', t('acct.cloud'), item.incoming, pending.resolutions[item.date])}
        </div>
      </fieldset>`).join('')}
    <div class="row mt-4">
      <button type="button" class="btn btn-primary" data-apply-merge>${icon('check', 16)} ${t('acct.applySync')}</button>
      <button type="button" class="btn" data-cancel-merge>${t('acct.cancel')}</button>
    </div>
  </div>`;
}

function conflictOption(item, side, label, entry, chosen) {
  const values = METRICS.filter(metric => Number.isFinite(entry[metric]))
    .map(metric => `${t(`metrics.${metric}`)} ${entry[metric]}`).join(' · ');
  return `<label class="conflict-option">
    <input type="radio" name="c-${item.date}" value="${side}" ${chosen === side ? 'checked' : ''} data-resolve="${item.date}">
    <span><strong>${label}</strong>
      <span class="small muted" style="display:block">${escapeHtml(values || t('acct.noValues'))}</span>
      ${entry.note ? `<span class="small" style="display:block">“${escapeHtml(entry.note.slice(0, 80))}”</span>` : ''}
    </span>
  </label>`;
}

function securityCard() {
  return `<section class="card mt-4">
    <h2 class="card-title">${t('acct.security')}</h2>
    <div class="row mt-4">
      <button type="button" class="btn" data-change-pass>${icon('lock', 16)} ${t('acct.changePass')}</button>
      <button type="button" class="btn" data-signout>${icon('logout', 16)} ${t('acct.signOut')}</button>
      <button type="button" class="btn" data-signout-all>${icon('logout', 16)} ${t('acct.signOutAll')}</button>
    </div>
    ${consentHistory()}
  </section>`;
}

function consentHistory() {
  if (!state.consents || state.consents.length === 0) return '';
  const known = ['terms', 'privacy', 'cloud_backup', 'local_storage'];
  return `<details class="collapse mt-4">
    <summary>${icon('doc', 16)} ${t('acct.consentsTitle')}</summary>
    <div class="collapse-body">
      ${state.consents.map(item => `<div class="data-row"><dt>${escapeHtml(known.includes(item.kind) ? t(`acct.consent.${item.kind}`) : item.kind)} · v${escapeHtml(item.policy_version)}</dt>
        <dd>${item.granted ? t('acct.granted') : t('acct.withdrawn')} · ${escapeHtml(formatStamp(item.created_at))}</dd></div>`).join('')}
    </div>
  </details>`;
}

function deletionCard() {
  return `<section class="card mt-4" style="border-color:color-mix(in srgb, var(--signal) 35%, var(--border))">
    <h2 class="card-title">${t('acct.deletions')}</h2>
    <p class="muted small mt-2">${t('acct.deletionsHint')}</p>
    <div class="stack mt-4">
      <div class="row-between"><span class="small">${t('acct.delLocalLabel')}</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-local>${icon('trash', 15)} ${t('acct.delLocal')}</button></div>
      <div class="row-between"><span class="small">${t('acct.delCloudLabel')}</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-cloud ${state.backupInfo ? '' : 'disabled'}>${icon('trash', 15)} ${t('acct.delCloud')}</button></div>
      <div class="row-between"><span class="small">${t('acct.delAccountLabel')}</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-account>${icon('trash', 15)} ${t('acct.delAccount')}</button></div>
    </div>
  </section>`;
}

function formatStamp(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${formatDateLong(iso.slice(0, 10))}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ---------- veprimet ----------

function friendlyError(error) {
  const text = String((error && error.message) || error || '');
  if (/Invalid login credentials/i.test(text)) return t('acct.eCredentials');
  if (/Email not confirmed/i.test(text)) return t('acct.eNotConfirmed');
  if (/rate limit|too many/i.test(text)) return t('acct.eRate');
  if (/already registered/i.test(text)) return t('acct.eRegistered');
  if (/weak|password/i.test(text)) return t('acct.eWeak');
  if (text === 'passphrase') return t('acct.ePassphrase');
  if (/fetch|network/i.test(text)) return t('acct.eNetwork');
  return t('acct.eGeneric');
}

async function run(task) {
  if (state.busy) return;
  state.busy = true;
  state.message = null;
  try {
    await task();
  } catch (error) {
    state.message = friendlyError(error);
  } finally {
    state.busy = false;
    redraw();
  }
}

function wireAuth(container) {
  for (const button of container.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => { state.view = button.dataset.view; state.message = null; redraw(); });
  }
  const form = container.querySelector('[data-form]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const client = getClient();

    if (form.dataset.form === 'login') {
      run(async () => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast(t('acct.signedIn'), 'ok');
      });
    } else if (form.dataset.form === 'register') {
      if (password.length < MIN_PASSWORD) { state.message = t('acct.passwordMin', { n: MIN_PASSWORD }); redraw(); return; }
      if (password !== data.get('password2')) { state.message = t('acct.passwordsDiffer'); redraw(); return; }
      run(async () => {
        const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        state.view = 'login';
        state.message = t('acct.checkEmail');
      });
    } else {
      run(async () => {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) throw error;
        // I njëjti mesazh edhe kur emaili nuk ekziston, që të mos zbulohet kush ka llogari.
        state.message = t('acct.resetSent');
      });
    }
  });
}

function wireNewPassword(container) {
  const form = container.querySelector('[data-form="newpass"]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    if (password.length < MIN_PASSWORD) { state.message = t('acct.atLeast', { n: MIN_PASSWORD }); redraw(); return; }
    if (password !== data.get('password2')) { state.message = t('acct.passwordsDiffer'); redraw(); return; }
    run(async () => {
      const { error } = await getClient().auth.updateUser({ password });
      if (error) throw error;
      state.recovery = false;
      toast(t('acct.passwordChanged'), 'ok');
    });
  });
}

function wireSignedIn(container, app) {
  const on = (selector, handler) => {
    const element = container.querySelector(selector);
    if (element) element.addEventListener('click', handler);
  };

  const termsBox = container.querySelector('#accept-terms');
  if (termsBox) {
    termsBox.addEventListener('change', () => { container.querySelector('[data-accept-terms]').disabled = !termsBox.checked; });
    on('[data-accept-terms]', () => run(async () => {
      await addConsentRecord(state.user.id, 'terms', true);
      await addConsentRecord(state.user.id, 'privacy', true);
      recordConsent(app.profile, 'terms', true);
      recordConsent(app.profile, 'privacy', true);
      app.save();
      state.consents = await listConsentRecords();
    }));
  }

  const passForm = container.querySelector('[data-form="passphrase"]');
  if (passForm) {
    passForm.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(passForm);
      const value = String(data.get('passphrase') || '');
      if (value.length < MIN_PASSPHRASE) { state.message = t('acct.atLeast', { n: MIN_PASSPHRASE }); redraw(); return; }
      if (data.has('passphrase2') && value !== data.get('passphrase2')) { state.message = t('acct.passphrasesDiffer'); redraw(); return; }
      rememberPassphrase(value);
      state.message = null;
      redraw();
    });
  }

  on('[data-forget-pass]', () => { forgetPassphrase(); redraw(); });
  on('[data-first-upload]', () => confirmFirstUpload(app));
  on('[data-sync]', () => run(() => syncNow(app)));
  on('[data-restore]', () => confirmRestore(app));

  for (const radio of container.querySelectorAll('[data-resolve]')) {
    radio.addEventListener('change', () => { state.pending.resolutions[radio.dataset.resolve] = radio.value; });
  }
  on('[data-apply-merge]', () => run(() => applyMerge(app)));
  on('[data-cancel-merge]', () => { state.pending = null; redraw(); });

  on('[data-change-pass]', () => { state.recovery = true; redraw(); });
  on('[data-signout]', () => run(async () => { await getClient().auth.signOut({ scope: 'local' }); toast(t('acct.signedOut')); }));
  on('[data-signout-all]', () => confirmTyped(t('acct.signOutAll'), t('acct.signOutAllText'), null,
    () => run(async () => { await getClient().auth.signOut({ scope: 'global' }); toast(t('acct.signedOutAll')); })));

  on('[data-del-local]', () => confirmTyped(t('acct.delLocalTitle'), t('acct.delLocalText'), null,
    () => run(async () => { await getClient().auth.signOut({ scope: 'local' }); app.deleteEverything(); })));
  on('[data-del-cloud]', () => confirmTyped(t('acct.delCloudTitle'), t('acct.delCloudText'), null,
    () => run(async () => {
      await deleteCloudBackup();
      await addConsentRecord(state.user.id, 'cloud_backup', false);
      recordConsent(app.profile, 'cloud_backup', false);
      if (app.profile.sync) { app.profile.sync.revision = null; app.profile.sync.lastSyncedAt = null; }
      app.save();
      state.backupInfo = null;
      toast(t('acct.cloudDeleted'), 'ok');
    })));
  on('[data-del-account]', () => confirmTyped(t('acct.delAccount'), t('acct.delAccountText'), t('acct.deleteWord'),
    () => run(async () => {
      await deleteAccount();
      await getClient().auth.signOut({ scope: 'local' });
      app.profile.sync = null;
      app.save();
      toast(t('acct.accountDeleted'), 'ok');
    })));
}

// Dialog konfirmimi; për veprimet e pakthyeshme kërkon të shkruhet një fjalë.
function confirmTyped(title, body, word, onConfirm) {
  const panel = openModal(title, `
    <p class="muted small">${escapeHtml(body)}</p>
    ${word ? `<div class="field mt-4"><label for="confirm-word">${t('acct.typeWord', { word: escapeHtml(word) })}</label>
      <input id="confirm-word" autocomplete="off"></div>` : ''}
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>${t('acct.cancel')}</button>
      <button type="button" class="btn btn-danger" data-confirm ${word ? 'disabled' : ''}>${t('acct.continue')}</button>
    </div>`);
  const confirm = panel.querySelector('[data-confirm]');
  if (word) {
    panel.querySelector('#confirm-word').addEventListener('input', event => {
      confirm.disabled = event.target.value.trim() !== word;
    });
  }
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  confirm.addEventListener('click', () => { closeLayer(); onConfirm(); });
}

// Kalimi nga "mysafir" në llogari: përmbledhje e qartë dhe konfirmim, kurrë automatik.
function confirmFirstUpload(app) {
  const profile = app.profile;
  const notes = profile.checkins.filter(entry => String(entry.note || '').trim() !== '').length;
  const panel = openModal(t('acct.uploadTitle'), `
    <p class="muted small">${t('acct.uploadIntro')}</p>
    <ul class="facts mt-3">
      <li class="fact"><span class="fact-ic">${icon('calendar', 15)}</span><span>${t('acct.uploadCheckins', { n: profile.checkins.length })}${notes ? t('acct.uploadNotes', { n: notes }) : ''}</span></li>
      <li class="fact"><span class="fact-ic">${icon('users', 15)}</span><span>${t('acct.uploadMy5', { n: (profile.my5 || []).length })}</span></li>
      <li class="fact"><span class="fact-ic">${icon('coffee', 15)}</span><span>${t('acct.uploadConnections', { n: (profile.connections || []).length })}</span></li>
    </ul>
    ${profile.mode === 'demo' ? `<p class="warn mt-3">${icon('info', 14)} ${t('acct.uploadDemo')}</p>` : ''}
    <p class="muted small mt-3">${t('acct.uploadServer')}</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>${t('acct.cancel')}</button>
      <button type="button" class="btn btn-primary" data-confirm>${icon('upload', 15)} ${t('acct.uploadButton')}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', () => {
    closeLayer();
    run(async () => {
      await addConsentRecord(state.user.id, 'cloud_backup', true);
      recordConsent(app.profile, 'cloud_backup', true);
      await pushProfile(app, null);
      state.consents = await listConsentRecords();
      toast(t('acct.uploaded'), 'ok');
    });
  });
}

async function pushProfile(app, expectedRevision) {
  const sync = ensureSyncState(app.profile);
  const result = await uploadBackup(app.profile, currentPassphrase(), expectedRevision);
  if (result.conflict) {
    // Një pajisje tjetër ruajti ndërkohë. Nuk mbishkruajmë: rinisim krahasimin.
    state.message = t('acct.otherDevice');
    await syncNow(app);
    return;
  }
  sync.revision = result.revision;
  sync.lastSyncedAt = new Date().toISOString();
  sync.userId = state.user.id;
  app.save();
  state.backupInfo = await fetchBackupInfo();
}

async function syncNow(app) {
  const remote = await downloadBackup(currentPassphrase());
  if (!remote) { state.backupInfo = null; return; }
  const conflicts = findConflicts(app.profile, remote.profile);
  if (conflicts.length > 0) {
    const resolutions = Object.fromEntries(conflicts.map(item => [item.date, 'local']));
    state.pending = { remote, conflicts, resolutions };
    return;
  }
  const { profile, summary } = mergeProfiles(app.profile, remote.profile);
  finishMerge(app, profile, remote.revision);
  await pushProfile(app, remote.revision);
  toast(summary.added ? t('acct.addedFromCloud', { n: summary.added }) : t('acct.allSynced'), 'ok');
}

async function applyMerge(app) {
  const { remote, resolutions } = state.pending;
  const { profile } = mergeProfiles(app.profile, remote.profile, resolutions);
  state.pending = null;
  finishMerge(app, profile, remote.revision);
  await pushProfile(app, remote.revision);
  toast(t('acct.resolved'), 'ok');
}

function finishMerge(app, profile, revision) {
  saveLocalBackup(app.profile);
  profile.sync = { ...ensureSyncState(app.profile), revision };
  app.replaceProfile(profile);
}

function confirmRestore(app) {
  confirmTyped(t('acct.restore'), t('acct.restoreText'),
    null,
    () => run(async () => {
      const remote = await downloadBackup(currentPassphrase());
      if (!remote) { state.backupInfo = null; return; }
      const sync = ensureSyncState(app.profile);
      saveLocalBackup(app.profile);
      remote.profile.sync = { ...sync, revision: remote.revision, lastSyncedAt: new Date().toISOString() };
      remote.profile.consent = { ...app.profile.consent };
      app.replaceProfile(remote.profile);
      toast(t('acct.restored'), 'ok');
    }));
}
