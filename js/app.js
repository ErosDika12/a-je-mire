import { loadProfile, saveProfile, clearAll, todayIso, recordConsent } from './storage.js';
import { generateProfile, emptyProfile } from './seed.js';
import { icon, applyTheme, nextTheme, themeIcon, themeLabel, toast, openSheet, closeLayer } from './ui.js';
import { startTour, stopTour, isTourActive, drawTourBar } from './tour.js';
import { t, setLang, getLang, onLangChange, plural } from './i18n/index.js';
import { isEnabled, onFlagsChange } from './flags.js';
import { track, setAnalyticsConsent } from './analytics.js';
import { recordActivity } from './challenges.js';

import { renderConsent, logoMark } from './screens/consent.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderCheckin } from './screens/checkin.js';
import { renderNormal } from './screens/normal.js';
import { renderChanged } from './screens/changed.js';
import { renderWhy } from './screens/why.js';
import { renderPatterns } from './screens/patterns.js';
import { renderHelps } from './screens/helps.js';
import { renderConnect, setConnectTab } from './screens/connect.js';
import { renderData } from './screens/data.js';
import { renderAccount, initAuth } from './screens/account.js';
import { renderPrivacy } from './screens/privacy.js';

// Modulet e Fazës 2 ngarkohen vetëm kur hapen (dhe vetëm kur flamuri i lejon). Service worker-i
// i ruan edhe këto pjesë, prandaj punojnë offline pas vizitës së parë.
const lazy = (load, name) => async (host, app) => (await load())[name](host, app);
const renderCommunity = lazy(() => import('./screens/community.js'), 'renderCommunity');
const renderNetwork = lazy(() => import('./screens/network.js'), 'renderNetwork');
const renderChallenges = lazy(() => import('./screens/challenges.js'), 'renderChallenges');
const renderMentor = lazy(() => import('./screens/mentor.js'), 'renderMentor');
const renderNotifications = lazy(() => import('./screens/notifications.js'), 'renderNotifications');
const renderAssistant = lazy(() => import('./screens/assistant.js'), 'renderAssistant');
const renderSubscription = lazy(() => import('./screens/subscription.js'), 'renderSubscription');
const renderAdmin = lazy(() => import('./screens/admin.js'), 'renderAdmin');
import { isAuthRedirect, setAuthPersistence, cloudConfigured } from './cloud/client.js';
import { forgetPassphrase } from './cloud/sync.js';
import { ensureSession, onSessionChange, hasRole, currentUser } from './cloud/session.js';

import * as stats from './stats.js';
import * as patterns from './patterns.js';

// "flag": moduli shfaqet vetëm kur e lejojnë edhe tavani i build-it edhe serveri.
// "roles": edhe roli në bazë (jo në metadata të klientit) duhet të përputhet.
const SCREENS = [
  { id: 'dashboard',     icon: 'today',    group: 'you',      render: renderDashboard, primary: true },
  { id: 'checkin',       icon: 'check',    group: 'you',      render: renderCheckin },
  { id: 'challenges',    icon: 'spark',    group: 'you',      render: renderChallenges, flag: 'challenges' },
  { id: 'normal',        icon: 'normal',   group: 'patterns', render: renderNormal,    primary: true },
  { id: 'changed',       icon: 'shift',    group: 'patterns', render: renderChanged },
  { id: 'why',           icon: 'why',      group: 'patterns', render: renderWhy },
  { id: 'patterns',      icon: 'patterns', group: 'patterns', render: renderPatterns,  primary: true },
  { id: 'helps',         icon: 'spark',    group: 'patterns', render: renderHelps },
  { id: 'assistant',     icon: 'why',      group: 'patterns', render: renderAssistant, flag: 'ai' },
  { id: 'connect',       icon: 'connect',  group: 'people',   render: renderConnect,   primary: true },
  { id: 'community',     icon: 'users',    group: 'people',   render: renderCommunity, flag: 'community' },
  { id: 'network',       icon: 'connect',  group: 'people',   render: renderNetwork,   flag: ['connections', 'messages'] },
  { id: 'mentor',        icon: 'shield',   group: 'people',   render: renderMentor,    flag: 'mentor' },
  { id: 'data',          icon: 'database', group: 'privacy',  render: renderData },
  { id: 'account',       icon: 'cloud',    group: 'privacy',  render: renderAccount },
  { id: 'notifications', icon: 'info',     group: 'privacy',  render: renderNotifications, flag: 'notifications' },
  { id: 'subscription',  icon: 'lock',     group: 'privacy',  render: renderSubscription, flag: 'subscriptions' },
  { id: 'privacy',       icon: 'privacy',  group: 'privacy',  render: renderPrivacy },
  { id: 'admin',         icon: 'shield',   group: 'staff',    render: renderAdmin, flag: 'admin', roles: ['moderator', 'admin', 'owner', 'billing'] }
];

// Adresat e vjetra (#/my5, #/kafe, #/wall) dhe butonat data-go vazhdojnë të punojnë.
const ALIASES = { my5: 'connect', kafe: 'connect', wall: 'connect' };

const byId = Object.fromEntries(SCREENS.map(screen => [screen.id, screen]));

function visible(screen) {
  if (screen.flag) {
    const keys = Array.isArray(screen.flag) ? screen.flag : [screen.flag];
    if (!keys.some(isEnabled)) return false;
  }
  if (screen.roles && !hasRole(...screen.roles)) return false;
  return true;
}

const label = screen => t(`nav.${screen.id}`);

// Tema dhe gjuha para consent-it rrinë vetëm në memorie: asgjë nuk shkruhet pa leje.
let temporaryTheme = 'auto';
let current = 'dashboard';
let navigating = false;
let pendingAccount = false;

const app = {
  profile: loadProfile(),
  today: todayIso(),
  goTo,
  save,
  acceptConsent,
  deleteEverything,
  resetToDemo,
  resetToPrivate,
  replaceProfile,
  refreshShell,
  setLanguage,
  rerender: () => goTo(current),
  startTour: () => startTour(app)
};

// ---------- tema dhe gjuha ----------

function currentTheme() {
  return app.profile ? (app.profile.settings.theme || 'auto') : temporaryTheme;
}

function setTheme(theme) {
  if (app.profile) {
    app.profile.settings.theme = theme;
    saveProfile(app.profile);
  } else {
    temporaryTheme = theme;
  }
  applyTheme(theme);
  refreshShell();
}

// Gjuha ruhet me profilin (pas consent-it), jo në një çelës të veçantë.
function setLanguage(lang) {
  if (app.profile) {
    app.profile.settings.lang = lang;
    saveProfile(app.profile);
  }
  setLang(lang);
}

// ---------- ndërtimi i guaskës ----------

function buildShell() {
  const sidebar = document.getElementById('sidebar');
  const bottomnav = document.getElementById('bottomnav');
  const shown = SCREENS.filter(visible);

  let lastGroup = '';
  sidebar.querySelector('.nav').innerHTML = shown.map(screen => {
    const header = screen.group !== lastGroup ? `<p class="nav-group">${t(`nav.group_${screen.group}`)}</p>` : '';
    lastGroup = screen.group;
    return `${header}<button type="button" class="nav-item" data-screen="${screen.id}">${icon(screen.icon)}<span>${label(screen)}</span></button>`;
  }).join('');

  bottomnav.innerHTML = shown.filter(screen => screen.primary).map(screen =>
    `<button type="button" class="bottomnav-item" data-screen="${screen.id}">
      <i class="bn-dot" aria-hidden="true"></i>${icon(screen.icon, 20)}<span>${t(`nav.short_${screen.id}`)}</span>
    </button>`).join('')
    + `<button type="button" class="bottomnav-item" data-more>
        <i class="bn-dot" aria-hidden="true"></i>${icon('more', 20)}<span>${t('nav.more')}</span>
      </button>`;

  // Seksionet krijohen për të gjitha ekranet, por vetëm të dukshmet mund të hapen (shih goTo).
  const host = document.getElementById('screens');
  if (!host.children.length) {
    host.innerHTML = SCREENS.map(screen =>
      `<section class="screen" id="screen-${screen.id}" role="tabpanel" hidden></section>`).join('');
  }
  for (const screen of SCREENS) document.getElementById('screen-' + screen.id).setAttribute('aria-label', label(screen));

  for (const button of document.querySelectorAll('.nav [data-screen], .bottomnav [data-screen]')) {
    button.addEventListener('click', () => goTo(button.dataset.screen));
  }
  document.querySelector('[data-more]').addEventListener('click', openMoreSheet);
  document.getElementById('tour-button').textContent = t('nav.tour');
  document.getElementById('quick-checkin').textContent = t('nav.checkin');
  // Tekstet statike të index.html ndjekin gjuhën aktive.
  sidebar.querySelector('.nav').setAttribute('aria-label', t('shell.mainNav'));
  bottomnav.setAttribute('aria-label', t('shell.quickNav'));
  const skip = document.querySelector('a.sr-only[href="#screens"]');
  if (skip) skip.textContent = t('shell.skip');
  markActive();
}

function openMoreSheet() {
  const extra = SCREENS.filter(screen => visible(screen) && !screen.primary);
  const panel = openSheet(t('nav.more'), `
    <div class="nav">
      ${extra.map(screen => `<button type="button" class="nav-item" data-sheet-screen="${screen.id}">${icon(screen.icon)}<span>${label(screen)}</span></button>`).join('')}
      <p class="nav-group">${t('nav.settings')}</p>
      <button type="button" class="nav-item" data-sheet-lang>${icon('auto')}<span>${getLang() === 'sq' ? 'English' : 'Shqip'}</span></button>
      <button type="button" class="nav-item" data-sheet-tour>${icon('play')}<span>${t('nav.tour')}</span></button>
      <button type="button" class="nav-item" data-sheet-theme>${icon(themeIcon(currentTheme()))}<span>${themeLabel(currentTheme())}</span></button>
    </div>`);

  for (const button of panel.querySelectorAll('[data-sheet-screen]')) {
    button.addEventListener('click', () => { closeLayer(); goTo(button.dataset.sheetScreen); });
  }
  panel.querySelector('[data-sheet-lang]').addEventListener('click', () => { closeLayer(); setLanguage(getLang() === 'sq' ? 'en' : 'sq'); });
  panel.querySelector('[data-sheet-tour]').addEventListener('click', () => { closeLayer(); startTour(app); });
  panel.querySelector('[data-sheet-theme]').addEventListener('click', () => { closeLayer(); setTheme(nextTheme(currentTheme())); });
}

function markActive() {
  for (const button of document.querySelectorAll('[data-screen]')) {
    const isActive = button.dataset.screen === current;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

// ---------- routeri ----------

function goTo(requested) {
  // "#/subscription?checkout=success": pjesa pas "?" i përket ekranit, jo routerit.
  let name = String(requested || '').split('?')[0];
  if (ALIASES[name]) {
    setConnectTab(name);
    name = ALIASES[name];
  }
  let screen = byId[name] && visible(byId[name]) ? byId[name] : byId.dashboard;
  current = screen.id;

  navigating = true;
  const wanted = `#/${requested && String(requested).startsWith(screen.id) ? requested : screen.id}`;
  if (location.hash !== wanted) location.hash = wanted;
  navigating = false;

  for (const item of SCREENS) {
    document.getElementById('screen-' + item.id).hidden = item.id !== screen.id;
  }
  const host = document.getElementById('screen-' + screen.id);
  host.innerHTML = '';
  // Ekranet e reja janë asinkrone; gabimi i tyre nuk duhet të rrëzojë aplikacionin.
  const fail = error => {
    // Vetëm gabimi teknik në console (pa të dhëna të përdoruesit), që të mund të gjendet shkaku.
    console.error('render', screen.id, error && error.message);
    host.innerHTML = `<section class="card"><p class="warn">${t('errors.generic')}</p></section>`;
  };
  try { Promise.resolve(screen.render(host, app)).catch(fail); } catch (error) { fail(error); }

  // Rishikimi i pamjes javore regjistrohet si fakt (për sfidat), pa asnjë vlerë.
  if ((screen.id === 'changed' || screen.id === 'normal') && app.profile) {
    recordActivity(app.profile, 'snapshotViews', app.today);
    saveProfile(app.profile);
  }

  document.getElementById('page-title').textContent = label(screen);
  document.title = `${label(screen)} · A JE MIRË? 2036`;
  markActive();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  refreshShell();
  drawTourBar();
  track('screen_opened', { screen: screen.id });
}

// Çdo buton me data-go në ekrane lundron vetë, pa pasur nevojë që çdo ekran ta lidhë.
document.getElementById('screens').addEventListener('click', event => {
  const target = event.target.closest('[data-go]');
  if (target) { event.preventDefault(); goTo(target.dataset.go); }
});

window.addEventListener('hashchange', () => {
  if (navigating || !app.profile) return;
  const name = location.hash.replace('#/', '');
  const base = name.split('?')[0];
  if ((byId[base] || ALIASES[base]) && base !== current) goTo(name);
});

// ---------- gjendja ----------

let shareTimer = null;

function save() {
  const stored = saveProfile(app.profile);
  refreshShell();
  // Nëse ka një ndarje me mentor që përfshin të ardhmen, dita e re dërgohet (pas një pauze të shkurtër).
  if (stored && isEnabled('mentor') && currentUser()) {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => import('./screens/mentor.js').then(module => module.syncFutureShares(app)).catch(() => {}), 1500);
  }
  return stored;
}

function refreshShell() {
  const badge = document.getElementById('mode-badge');
  const themeButton = document.getElementById('theme-button');
  if (themeButton) {
    themeButton.innerHTML = icon(themeIcon(currentTheme()));
    themeButton.setAttribute('aria-label', `${t('nav.theme')}: ${themeLabel(currentTheme())}`);
    themeButton.title = themeLabel(currentTheme());
  }
  if (!badge || !app.profile) return;
  const demo = app.profile.mode === 'demo';
  badge.innerHTML = `${icon(demo ? 'spark' : 'shield', 15)}
    <span><strong>${demo ? t('shell.demoProfile') : t('shell.privateProfile')}</strong>
    ${plural('shell.days', app.profile.checkins.length)} · ${t('shell.deviceOnly')}</span>`;
}

function acceptConsent(mode, aiChecked) {
  const consent = { store: true, ai: Boolean(aiChecked), acceptedAt: new Date().toISOString() };
  app.profile = mode === 'private' ? emptyProfile(consent) : generateProfile(consent);
  app.profile.settings.theme = temporaryTheme;
  app.profile.settings.lang = getLang();
  recordConsent(app.profile, 'local_storage', true);
  recordConsent(app.profile, 'text_help', aiChecked);
  saveProfile(app.profile);
  setAuthPersistence(true);
  showApp();
  // Gjuha mund të jetë ndërruar te ekrani i pëlqimit: navigimi ndërtohet sërish në të.
  buildShell();
  // Nëse erdhi nga një link emaili, pas consent-it vazhdon te Llogaria.
  goTo(pendingAccount ? 'account' : mode === 'private' ? 'checkin' : 'dashboard');
  pendingAccount = false;
  toast(mode === 'private' ? t('shell.privateCreated') : t('shell.demoLoaded'), 'ok');
}

function replaceProfile(profile) {
  app.profile = profile;
  saveProfile(app.profile);
  applyTheme(currentTheme());
  refreshShell();
}

function resetToDemo() {
  const consent = { ...app.profile.consent };
  const theme = currentTheme();
  app.profile = generateProfile(consent);
  app.profile.settings.theme = theme;
  app.profile.settings.lang = getLang();
  saveProfile(app.profile);
  goTo('dashboard');
}

function resetToPrivate() {
  const consent = { ...app.profile.consent };
  const theme = currentTheme();
  app.profile = emptyProfile(consent);
  app.profile.settings.theme = theme;
  app.profile.settings.lang = getLang();
  saveProfile(app.profile);
  goTo('checkin');
}

function deleteEverything() {
  clearAll();
  forgetPassphrase();
  setAuthPersistence(false);
  setAnalyticsConsent(false);
  stopTour();
  temporaryTheme = currentTheme();
  app.profile = null;
  showConsent();
  toast(t('shell.deleted'));
}

// ---------- nisja ----------

function showConsent() {
  document.getElementById('shell').hidden = true;
  const view = document.getElementById('consent-view');
  view.hidden = false;
  document.title = 'A JE MIRË? 2036 — Human Connection & Wellbeing Intelligence';
  renderConsent(view, app);
}

function showApp() {
  document.getElementById('consent-view').hidden = true;
  document.getElementById('consent-view').innerHTML = '';
  document.getElementById('shell').hidden = false;
}

// Sesioni nis vetëm nëse përdoruesi ka hyrë më parë në llogari (ose vjen nga një link emaili).
function hasStoredSession() {
  try { return Boolean(localStorage.getItem('ajemire.auth')); } catch (error) { return false; }
}

function boot() {
  const started = performance.now();
  if (app.profile && app.profile.settings.lang) setLang(app.profile.settings.lang);
  document.documentElement.lang = getLang();
  document.getElementById('brand-mark').innerHTML = logoMark(34);
  buildShell();
  applyTheme(currentTheme());
  document.getElementById('theme-button').addEventListener('click', () => setTheme(nextTheme(currentTheme())));
  document.getElementById('tour-button').addEventListener('click', () => startTour(app));
  document.getElementById('quick-checkin').addEventListener('click', () => goTo('checkin'));

  const hasConsent = app.profile !== null && app.profile.consent && app.profile.consent.store === true;
  setAuthPersistence(hasConsent);
  setAnalyticsConsent(Boolean(hasConsent && app.profile.settings.analytics));
  registerServiceWorker();

  // Linku i verifikimit ose i rivendosjes: lidhja me serverin nis vetëm në këtë rast.
  const fromEmail = isAuthRedirect();
  if (fromEmail) initAuth(app);

  if (!hasConsent) {
    pendingAccount = fromEmail;
    showConsent();
    return;
  }
  showApp();
  const requested = location.hash.replace('#/', '');
  if (fromEmail) goTo('account');
  else goTo(byId[requested.split('?')[0]] || ALIASES[requested] ? requested : 'dashboard');

  if (cloudConfigured() && hasStoredSession()) ensureSession();
  track('performance', { screen: 'boot', duration_ms: Math.round(performance.now() - started) });
}

// Kur ndryshojnë flamujt, sesioni ose gjuha, navigimi rindërtohet dhe ekrani aktual rivizatohet.
function rebuild() {
  if (!app.profile) return;
  buildShell();
  refreshShell();
  const screen = byId[current];
  if (screen && !visible(screen)) goTo('dashboard');
}
onFlagsChange(rebuild);
onSessionChange(rebuild);
onLangChange(() => {
  document.documentElement.lang = getLang();
  if (!app.profile) { showConsent(); return; }
  buildShell();
  goTo(current);
});

// ---------- offline (PWA) ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && !import.meta.env.PROD) return;
  // Rifreskimi bëhet vetëm kur përdoruesi e kërkon. Në vizitën e parë worker-i merr kontrollin
  // pa rifreskuar faqen — përndryshe humbet fjalëkalimi i sinkronizimit dhe çdo formë e plotësuar.
  let userAskedToRefresh = false;
  navigator.serviceWorker.register('/sw.js').then(registration => {
    const offer = worker => showUpdateNotice(registration, () => { userAskedToRefresh = true; worker.postMessage('SKIP_WAITING'); });
    if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
  }).catch(() => { /* pa offline, aplikacioni punon njësoj */ });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !userAskedToRefresh) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateNotice(registration, apply) {
  if (document.getElementById('update-notice')) return;
  const bar = document.createElement('div');
  bar.id = 'update-notice';
  bar.className = 'update-notice';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${icon('refresh', 16)} ${t('shell.updateAvailable')}</span>
    <button type="button" class="btn btn-sm btn-primary">${t('shell.refresh')}</button>`;
  bar.querySelector('button').addEventListener('click', apply);
  document.body.appendChild(bar);
  // Njoftim sistemi vetëm nëse përdoruesi e ka ndezur vetë këtë kategori dhe ka dhënë leje.
  if (app.profile && app.profile.settings.appUpdateNotice && 'Notification' in window && Notification.permission === 'granted') {
    registration.showNotification(t('shell.updateTitle'), { body: t('shell.updateAvailable'), tag: 'app_update' }).catch(() => {});
  }
}

// Tema e sistemit mund të ndryshojë ndërsa faqja është e hapur.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme() === 'auto') applyTheme('auto');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && isTourActive()) stopTour();
});

boot();

// Që të mund t'i provoj funksionet nga Console, p.sh. AJM.stats.mean([2,4,6]).
window.AJM = { app, stats, patterns };
