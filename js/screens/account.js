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

const MIN_PASSWORD = 10;
const METRIC_SHORT = { mood: 'Humori', sleep: 'Gjumi', energy: 'Energjia', social: 'Lidhja', joy: 'Gëzimi', load: 'Ngarkesa' };

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
    if (event === 'PASSWORD_RECOVERY') state.recovery = true;
    if (event === 'SIGNED_OUT') { resetCloudState(); forgetPassphrase(); }
    // Supabase-i thërret këtë brenda vetes; rivizatimi shtyhet që të mos bllokojë.
    setTimeout(redraw, 0);
  });
  const { data } = await client.auth.getSession();
  state.user = data.session ? data.session.user : null;
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
      <section class="card"><p class="muted small">${icon('info', 14)} Llogaritë nuk janë aktive në këtë version. Aplikacioni punon plotësisht pa to, vetëm në këtë pajisje.</p></section>`;
    return;
  }

  if (!state.ready) {
    container.innerHTML = `${head()}<section class="card"><p class="status">${icon('refresh', 14)} Po lidhet…</p></section>`;
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
    state.message = 'Serveri nuk u arrit. Të dhënat lokale janë të paprekura.';
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
    <h1 class="page-title">Llogaria</h1>
    <p class="page-sub">Opsionale. Shërben vetëm për një kopje rezervë të enkriptuar, që ta rikthesh në një pajisje tjetër.</p>
  </header>`;
}

function guestIntro() {
  return `<section class="card card-soft">
    <ul class="facts">
      <li class="fact"><span class="fact-ic">${icon('shield', 16)}</span><span>Pa llogari, gjithçka rri vetëm në këtë pajisje — si deri tani.</span></li>
      <li class="fact"><span class="fact-ic">${icon('lock', 16)}</span><span>Me llogari, të dhënat enkriptohen <strong>në pajisjen tënde</strong> me një fjalëkalim sinkronizimi që e di vetëm ti. Serveri ruan vetëm tekstin e enkriptuar.</span></li>
      <li class="fact"><span class="fact-ic">${icon('cloud', 16)}</span><span>Asgjë nuk ngarkohet automatikisht. Çdo ngarkim e bën ti, pasi sheh përmbledhjen.</span></li>
    </ul>
  </section>`;
}

function authCard() {
  const tabs = [['login', 'Hyr'], ['register', 'Krijo llogari'], ['reset', 'Harrova fjalëkalimin']];
  const body = {
    login: `<form class="stack" data-form="login">
        ${field('email', 'Email', 'email', 'email')}
        ${field('password', 'Fjalëkalimi', 'password', 'current-password')}
        <button type="submit" class="btn btn-primary">${icon('lock', 16)} Hyr</button>
      </form>`,
    register: `<form class="stack" data-form="register">
        ${field('email', 'Email', 'email', 'email')}
        ${field('password', `Fjalëkalimi <span class="field-hint">të paktën ${MIN_PASSWORD} shenja</span>`, 'password', 'new-password')}
        ${field('password2', 'Përsërite fjalëkalimin', 'password', 'new-password')}
        <label class="check-row"><input type="checkbox" name="terms" required>
          <span>Kam lexuar dhe pranoj <a href="#/privacy" data-go="privacy">Privatësinë dhe Kushtet</a>.</span></label>
        <button type="submit" class="btn btn-primary">${icon('check', 16)} Krijo llogarinë</button>
        <p class="card-note">Do të marrësh një email verifikimi. Kërkojmë vetëm emailin — asnjë emër, telefon, adresë, datëlindje apo foto.</p>
      </form>`,
    reset: `<form class="stack" data-form="reset">
        ${field('email', 'Email', 'email', 'email')}
        <button type="submit" class="btn btn-primary">${icon('refresh', 16)} Dërgo linkun e rivendosjes</button>
        <p class="card-note">Fjalëkalimi i llogarisë rivendoset me email. Fjalëkalimi i sinkronizimit <strong>nuk</strong> mund të rivendoset nga askush.</p>
      </form>`
  };
  return `<section class="card mt-4">
    <div class="seg-control" role="group" aria-label="Zgjidh veprimin">
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
    <h2 class="card-title">Vendos fjalëkalim të ri</h2>
    <form class="stack mt-4" data-form="newpass">
      ${field('password', `Fjalëkalimi i ri <span class="field-hint">të paktën ${MIN_PASSWORD} shenja</span>`, 'password', 'new-password')}
      ${field('password2', 'Përsërite', 'password', 'new-password')}
      <button type="submit" class="btn btn-primary">${icon('check', 16)} Ruaj</button>
    </form>
    ${messageLine()}
  </section>`;
}

function accountCard() {
  const verified = Boolean(state.user.email_confirmed_at);
  return `<section class="card">
    <div class="row-between">
      <div>
        <p class="small muted">Je i kyçur si</p>
        <p><strong>${escapeHtml(state.user.email || '')}</strong></p>
      </div>
      <span class="pill ${verified ? 'pill-accent' : 'pill-amber'}">${icon(verified ? 'check' : 'info', 13)} ${verified ? 'Email i verifikuar' : 'Pa verifikuar'}</span>
    </div>
    ${messageLine()}
  </section>`;
}

function termsGate() {
  return `<section class="card mt-4">
    <h2 class="card-title">Para kopjes rezervë</h2>
    <p class="muted small mt-2">Duhet pranimi yt i veçantë për Kushtet dhe Privatësinë. Ruhet si shënim me datë, dhe mund ta shohësh këtu.</p>
    <label class="check-row mt-4"><input type="checkbox" id="accept-terms">
      <span>Pranoj <a href="#/privacy" data-go="privacy">Privatësinë dhe Kushtet</a> (versioni 2026-09).</span></label>
    <button type="button" class="btn btn-primary mt-4" data-accept-terms disabled>${icon('check', 16)} Vazhdo</button>
  </section>`;
}

function syncCentre(app) {
  const profile = app.profile;
  const sync = profile.sync || {};
  const info = state.backupInfo;
  const hasPass = Boolean(currentPassphrase());

  let cloudLine;
  if (info === undefined) cloudLine = `${icon('refresh', 14)} Po kontrollohet…`;
  else if (info === null) cloudLine = 'Asnjë kopje në cloud.';
  else cloudLine = `Revizioni ${info.revision} · ${escapeHtml(formatStamp(info.updated_at))}${info.device_id === sync.deviceId ? ' · nga kjo pajisje' : ' · nga një pajisje tjetër'}`;

  const behind = info && sync.revision !== info.revision;

  return `<section class="card mt-4" id="sync-centre">
    <div class="card-head">
      <span class="fact-ic">${icon('cloud', 20)}</span>
      <div>
        <h2 class="card-title">Qendra e sinkronizimit</h2>
        <p class="card-sub">Kjo pajisje është burimi kryesor. Cloud-i mban vetëm një kopje të enkriptuar.</p>
      </div>
    </div>

    <dl>
      <div class="data-row"><dt>Në këtë pajisje</dt><dd>${profile.checkins.length} ditë${profile.mode === 'demo' ? ' · profil sintetik demo' : ''}</dd></div>
      <div class="data-row"><dt>Në cloud</dt><dd>${cloudLine}</dd></div>
      <div class="data-row"><dt>Sinkronizimi i fundit</dt><dd>${sync.lastSyncedAt ? escapeHtml(formatStamp(sync.lastSyncedAt)) : 'asnjëherë'}</dd></div>
    </dl>
    ${behind ? `<p class="warn mt-3">${icon('info', 14)} Cloud-i ka një version që kjo pajisje nuk e ka parë ende. Sinkronizo për ta krahasuar.</p>` : ''}

    ${hasPass ? `
      <p class="status mt-4">${icon('lock', 14)} Fjalëkalimi i sinkronizimit është aktiv vetëm për këtë seancë.
        <button type="button" class="btn btn-sm" data-forget-pass>Harroje tani</button></p>
      <div class="row mt-4">
        ${info ? `<button type="button" class="btn btn-primary" data-sync ${state.busy ? 'disabled' : ''}>${icon('refresh', 16)} Sinkronizo tani</button>
                  <button type="button" class="btn" data-restore ${state.busy ? 'disabled' : ''}>${icon('download', 16)} Rikthe nga cloud</button>`
               : `<button type="button" class="btn btn-primary" data-first-upload ${state.busy ? 'disabled' : ''}>${icon('upload', 16)} Ngarko kopjen e parë</button>`}
      </div>`
    : `
      <form class="stack mt-4" data-form="passphrase">
        <div class="field">
          <label for="f-passphrase">Fjalëkalimi i sinkronizimit <span class="field-hint">të paktën ${MIN_PASSPHRASE} shenja, i ndryshëm nga ai i llogarisë</span></label>
          <input id="f-passphrase" name="passphrase" type="password" autocomplete="off" required minlength="${MIN_PASSPHRASE}" maxlength="200">
        </div>
        ${info ? '' : `<div class="field">
          <label for="f-passphrase2">Përsërite</label>
          <input id="f-passphrase2" name="passphrase2" type="password" autocomplete="off" required maxlength="200">
        </div>`}
        <button type="submit" class="btn btn-primary">${icon('lock', 16)} Përdor për këtë seancë</button>
      </form>
      <p class="card-note">Ky fjalëkalim nuk ruhet askund dhe nuk dërgohet. Nëse e harron, kopja në cloud nuk mund të hapet më — as nga ne. Të dhënat në këtë pajisje mbeten.</p>`}

    ${state.pending ? conflictPanel(state.pending) : ''}
  </section>`;
}

function conflictPanel(pending) {
  return `<div class="card card-soft mt-4" id="conflicts">
    <h3 class="card-title">${pending.conflicts.length} ${pending.conflicts.length === 1 ? 'ditë ndryshon' : 'ditë ndryshojnë'} mes pajisjes dhe cloud-it</h3>
    <p class="muted small mt-2">Zgjidh cilin version të mbash për secilën datë. Asgjë nuk ndryshon para se të shtypësh "Apliko".</p>
    ${pending.conflicts.map(item => `
      <fieldset class="conflict mt-4">
        <legend><strong>${escapeHtml(formatDateLong(item.date))}</strong></legend>
        <div class="conflict-grid">
          ${conflictOption(item, 'local', 'Kjo pajisje', item.local, pending.resolutions[item.date])}
          ${conflictOption(item, 'incoming', 'Cloud', item.incoming, pending.resolutions[item.date])}
        </div>
      </fieldset>`).join('')}
    <div class="row mt-4">
      <button type="button" class="btn btn-primary" data-apply-merge>${icon('check', 16)} Apliko dhe sinkronizo</button>
      <button type="button" class="btn" data-cancel-merge>Anulo</button>
    </div>
  </div>`;
}

function conflictOption(item, side, label, entry, chosen) {
  const values = METRICS.filter(metric => Number.isFinite(entry[metric]))
    .map(metric => `${METRIC_SHORT[metric]} ${entry[metric]}`).join(' · ');
  return `<label class="conflict-option">
    <input type="radio" name="c-${item.date}" value="${side}" ${chosen === side ? 'checked' : ''} data-resolve="${item.date}">
    <span><strong>${label}</strong>
      <span class="small muted" style="display:block">${escapeHtml(values || 'pa matje')}</span>
      ${entry.note ? `<span class="small" style="display:block">“${escapeHtml(entry.note.slice(0, 80))}”</span>` : ''}
    </span>
  </label>`;
}

function securityCard() {
  return `<section class="card mt-4">
    <h2 class="card-title">Siguria</h2>
    <div class="row mt-4">
      <button type="button" class="btn" data-change-pass>${icon('lock', 16)} Ndrysho fjalëkalimin</button>
      <button type="button" class="btn" data-signout>${icon('logout', 16)} Dil</button>
      <button type="button" class="btn" data-signout-all>${icon('logout', 16)} Dil nga të gjitha pajisjet</button>
    </div>
    ${consentHistory()}
  </section>`;
}

function consentHistory() {
  if (!state.consents || state.consents.length === 0) return '';
  const names = { terms: 'Kushtet', privacy: 'Privatësia', cloud_backup: 'Kopja në cloud', local_storage: 'Ruajtja lokale' };
  return `<details class="collapse mt-4">
    <summary>${icon('doc', 16)} Pëlqimet e ruajtura në llogari</summary>
    <div class="collapse-body">
      ${state.consents.map(item => `<div class="data-row"><dt>${escapeHtml(names[item.kind] || item.kind)} · v${escapeHtml(item.policy_version)}</dt>
        <dd>${item.granted ? 'pranuar' : 'tërhequr'} · ${escapeHtml(formatStamp(item.created_at))}</dd></div>`).join('')}
    </div>
  </details>`;
}

function deletionCard() {
  return `<section class="card mt-4" style="border-color:color-mix(in srgb, var(--signal) 35%, var(--border))">
    <h2 class="card-title">Fshirjet</h2>
    <p class="muted small mt-2">Tri veprime të ndara. Secila fshin vetëm atë që thotë.</p>
    <div class="stack mt-4">
      <div class="row-between"><span class="small"><strong>Të dhënat lokale</strong> — vetëm në këtë pajisje. Llogaria dhe cloud-i mbeten.</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-local>${icon('trash', 15)} Fshij lokalet</button></div>
      <div class="row-between"><span class="small"><strong>Kopja në cloud</strong> — teksti i enkriptuar në server. Pajisja dhe llogaria mbeten.</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-cloud ${state.backupInfo ? '' : 'disabled'}>${icon('trash', 15)} Fshij kopjen</button></div>
      <div class="row-between"><span class="small"><strong>Llogaria</strong> — emaili, kopja në cloud dhe pëlqimet. Të dhënat në këtë pajisje mbeten.</span>
        <button type="button" class="btn btn-danger btn-sm" data-del-account>${icon('trash', 15)} Fshij llogarinë</button></div>
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
  if (/Invalid login credentials/i.test(text)) return 'Emaili ose fjalëkalimi nuk përputhen.';
  if (/Email not confirmed/i.test(text)) return 'Emaili nuk është verifikuar ende. Kontrollo postën.';
  if (/rate limit|too many/i.test(text)) return 'Shumë tentativa. Provo sërish pas pak.';
  if (/already registered/i.test(text)) return 'Ky email ka tashmë llogari. Provo "Hyr".';
  if (/weak|password/i.test(text)) return 'Fjalëkalimi nuk u pranua. Provo një më të gjatë.';
  if (text === 'passphrase') return 'Fjalëkalimi i sinkronizimit nuk e hap këtë kopje.';
  if (/fetch|network/i.test(text)) return 'Nuk ka lidhje me serverin. Të dhënat lokale janë të paprekura.';
  return 'Diçka nuk shkoi. Të dhënat lokale janë të paprekura.';
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
        toast('U kyçe', 'ok');
      });
    } else if (form.dataset.form === 'register') {
      if (password.length < MIN_PASSWORD) { state.message = `Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD} shenja.`; redraw(); return; }
      if (password !== data.get('password2')) { state.message = 'Fjalëkalimet nuk përputhen.'; redraw(); return; }
      run(async () => {
        const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        state.view = 'login';
        state.message = 'Kontrollo emailin dhe kliko linkun e verifikimit. Pastaj hyr këtu.';
      });
    } else {
      run(async () => {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) throw error;
        // I njëjti mesazh edhe kur emaili nuk ekziston, që të mos zbulohet kush ka llogari.
        state.message = 'Nëse ky email ka llogari, do të marrë një link rivendosjeje.';
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
    if (password.length < MIN_PASSWORD) { state.message = `Të paktën ${MIN_PASSWORD} shenja.`; redraw(); return; }
    if (password !== data.get('password2')) { state.message = 'Fjalëkalimet nuk përputhen.'; redraw(); return; }
    run(async () => {
      const { error } = await getClient().auth.updateUser({ password });
      if (error) throw error;
      state.recovery = false;
      toast('Fjalëkalimi u ndryshua', 'ok');
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
      if (value.length < MIN_PASSPHRASE) { state.message = `Të paktën ${MIN_PASSPHRASE} shenja.`; redraw(); return; }
      if (data.has('passphrase2') && value !== data.get('passphrase2')) { state.message = 'Fjalëkalimet e sinkronizimit nuk përputhen.'; redraw(); return; }
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
  on('[data-signout]', () => run(async () => { await getClient().auth.signOut({ scope: 'local' }); toast('Dole nga llogaria'); }));
  on('[data-signout-all]', () => confirmTyped('Dil nga të gjitha pajisjet',
    'Çdo pajisje ku je i kyçur do të dalë. Të dhënat lokale mbeten kudo.', null,
    () => run(async () => { await getClient().auth.signOut({ scope: 'global' }); toast('Dole nga të gjitha pajisjet'); })));

  on('[data-del-local]', () => confirmTyped('Fshij të dhënat lokale',
    'Check-ins, MY 5 dhe lidhjet fshihen nga kjo pajisje. Llogaria dhe kopja në cloud mbeten.', null,
    () => run(async () => { await getClient().auth.signOut({ scope: 'local' }); app.deleteEverything(); })));
  on('[data-del-cloud]', () => confirmTyped('Fshij kopjen në cloud',
    'Teksti i enkriptuar fshihet nga serveri. Të dhënat në këtë pajisje mbeten.', null,
    () => run(async () => {
      await deleteCloudBackup();
      await addConsentRecord(state.user.id, 'cloud_backup', false);
      recordConsent(app.profile, 'cloud_backup', false);
      if (app.profile.sync) { app.profile.sync.revision = null; app.profile.sync.lastSyncedAt = null; }
      app.save();
      state.backupInfo = null;
      toast('Kopja në cloud u fshi', 'ok');
    })));
  on('[data-del-account]', () => confirmTyped('Fshij llogarinë',
    'Fshihen emaili, kopja në cloud dhe pëlqimet. Nuk kthehet. Të dhënat në këtë pajisje mbeten.', 'FSHIJ',
    () => run(async () => {
      await deleteAccount();
      await getClient().auth.signOut({ scope: 'local' });
      app.profile.sync = null;
      app.save();
      toast('Llogaria u fshi', 'ok');
    })));
}

// Dialog konfirmimi; për veprimet e pakthyeshme kërkon të shkruhet një fjalë.
function confirmTyped(title, body, word, onConfirm) {
  const panel = openModal(title, `
    <p class="muted small">${escapeHtml(body)}</p>
    ${word ? `<div class="field mt-4"><label for="confirm-word">Shkruaj <strong>${word}</strong> për të vazhduar</label>
      <input id="confirm-word" autocomplete="off"></div>` : ''}
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>Anulo</button>
      <button type="button" class="btn btn-danger" data-confirm ${word ? 'disabled' : ''}>Vazhdo</button>
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
  const panel = openModal('Ngarko kopjen e parë', `
    <p class="muted small">Këto do të enkriptohen në këtë pajisje dhe do të ngarkohen si një bllok i vetëm tekst i palexueshëm:</p>
    <ul class="facts mt-3">
      <li class="fact"><span class="fact-ic">${icon('calendar', 15)}</span><span>${profile.checkins.length} check-ins${notes ? `, nga të cilat ${notes} me shënim` : ''}</span></li>
      <li class="fact"><span class="fact-ic">${icon('users', 15)}</span><span>${(profile.my5 || []).length} persona në MY 5</span></li>
      <li class="fact"><span class="fact-ic">${icon('coffee', 15)}</span><span>${(profile.connections || []).length} lidhje të shënuara</span></li>
    </ul>
    ${profile.mode === 'demo' ? `<p class="warn mt-3">${icon('info', 14)} Ky është profili sintetik demo, jo të dhëna të tua.</p>` : ''}
    <p class="muted small mt-3">Serveri nuk sheh dot përmbajtjen. Mund ta fshish kopjen kur të duash.</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>Anulo</button>
      <button type="button" class="btn btn-primary" data-confirm>${icon('upload', 15)} Enkripto dhe ngarko</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', () => {
    closeLayer();
    run(async () => {
      await addConsentRecord(state.user.id, 'cloud_backup', true);
      recordConsent(app.profile, 'cloud_backup', true);
      await pushProfile(app, null);
      state.consents = await listConsentRecords();
      toast('Kopja e enkriptuar u ngarkua', 'ok');
    });
  });
}

async function pushProfile(app, expectedRevision) {
  const sync = ensureSyncState(app.profile);
  const result = await uploadBackup(app.profile, currentPassphrase(), expectedRevision);
  if (result.conflict) {
    // Një pajisje tjetër ruajti ndërkohë. Nuk mbishkruajmë: rinisim krahasimin.
    state.message = 'Një pajisje tjetër ruajti ndërkohë. U krahasua sërish.';
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
  toast(summary.added ? `${summary.added} ditë u shtuan nga cloud` : 'Gjithçka është e sinkronizuar', 'ok');
}

async function applyMerge(app) {
  const { remote, resolutions } = state.pending;
  const { profile } = mergeProfiles(app.profile, remote.profile, resolutions);
  state.pending = null;
  finishMerge(app, profile, remote.revision);
  await pushProfile(app, remote.revision);
  toast('Konfliktet u zgjidhën dhe u sinkronizua', 'ok');
}

function finishMerge(app, profile, revision) {
  saveLocalBackup(app.profile);
  profile.sync = { ...ensureSyncState(app.profile), revision };
  app.replaceProfile(profile);
}

function confirmRestore(app) {
  confirmTyped('Rikthe nga cloud',
    'Të dhënat në këtë pajisje zëvendësohen me kopjen nga cloud. Para kësaj ruhet automatikisht një kopje lokale që mund ta rikthesh te "Të dhënat e mia".',
    null,
    () => run(async () => {
      const remote = await downloadBackup(currentPassphrase());
      if (!remote) { state.backupInfo = null; return; }
      const sync = ensureSyncState(app.profile);
      saveLocalBackup(app.profile);
      remote.profile.sync = { ...sync, revision: remote.revision, lastSyncedAt: new Date().toISOString() };
      remote.profile.consent = { ...app.profile.consent };
      app.replaceProfile(remote.profile);
      toast('U rikthye nga cloud', 'ok');
    }));
}
