import { loadProfile, saveProfile, clearAll, todayIso } from './storage.js';
import { generateProfile, emptyProfile } from './seed.js';
import { icon, applyTheme, nextTheme, themeIcon, themeLabel, toast, openSheet, closeLayer } from './ui.js';
import { startTour, stopTour, isTourActive, drawTourBar } from './tour.js';

import { renderConsent, logoMark } from './screens/consent.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderCheckin } from './screens/checkin.js';
import { renderNormal } from './screens/normal.js';
import { renderChanged } from './screens/changed.js';
import { renderWhy } from './screens/why.js';
import { renderPatterns } from './screens/patterns.js';
import { renderHelps } from './screens/helps.js';
import { renderMy5 } from './screens/my5.js';
import { renderKafe } from './screens/kafe.js';
import { renderWall } from './screens/wall.js';
import { renderData } from './screens/data.js';

import * as stats from './stats.js';
import * as patterns from './patterns.js';

const SCREENS = [
  { id: 'dashboard', label: 'Sot',                icon: 'today',    group: 'Ti',          render: renderDashboard, primary: true },
  { id: 'checkin',   label: 'Check-in',           icon: 'check',    group: 'Ti',          render: renderCheckin,   primary: true },
  { id: 'normal',    label: 'My Normal',          icon: 'normal',   group: 'Patternat',   render: renderNormal,    primary: true },
  { id: 'changed',   label: 'Something Changed',  icon: 'shift',    group: 'Patternat',   render: renderChanged,   primary: true },
  { id: 'why',       label: 'Why?',               icon: 'why',      group: 'Patternat',   render: renderWhy },
  { id: 'patterns',  label: 'Patterns',           icon: 'patterns', group: 'Patternat',   render: renderPatterns },
  { id: 'helps',     label: 'What Helps Me?',     icon: 'spark',    group: 'Patternat',   render: renderHelps },
  { id: 'my5',       label: 'MY 5',               icon: 'users',    group: 'Lidhjet',     render: renderMy5 },
  { id: 'kafe',      label: 'KAFE?',              icon: 'coffee',   group: 'Lidhjet',     render: renderKafe },
  { id: 'wall',      label: 'Connection Wall',    icon: 'connect',  group: 'Lidhjet',     render: renderWall },
  { id: 'data',      label: 'Të dhënat e mia',    icon: 'database', group: 'Privatësia',  render: renderData }
];

const byId = Object.fromEntries(SCREENS.map(screen => [screen.id, screen]));

// Tema para consent-it rri vetëm në memorie: asgjë nuk shkruhet pa leje.
let temporaryTheme = 'auto';
let current = 'dashboard';
let navigating = false;

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
  rerender: () => goTo(current),
  startTour: () => startTour(app)
};

// ---------- tema ----------

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

// ---------- ndërtimi i guaskës ----------

function buildShell() {
  const sidebar = document.getElementById('sidebar');
  const bottomnav = document.getElementById('bottomnav');

  let lastGroup = '';
  sidebar.querySelector('.nav').innerHTML = SCREENS.map(screen => {
    const header = screen.group !== lastGroup ? `<p class="nav-group">${screen.group}</p>` : '';
    lastGroup = screen.group;
    return `${header}<button type="button" class="nav-item" data-screen="${screen.id}">${icon(screen.icon)}<span>${screen.label}</span></button>`;
  }).join('');

  const primary = SCREENS.filter(screen => screen.primary);
  bottomnav.innerHTML = primary.map(screen =>
    `<button type="button" class="bottomnav-item" data-screen="${screen.id}">
      <i class="bn-dot" aria-hidden="true"></i>${icon(screen.icon, 20)}<span>${shortLabel(screen.label)}</span>
    </button>`).join('')
    + `<button type="button" class="bottomnav-item" data-more>
        <i class="bn-dot" aria-hidden="true"></i>${icon('more', 20)}<span>Më shumë</span>
      </button>`;

  document.getElementById('screens').innerHTML = SCREENS.map(screen =>
    `<section class="screen" id="screen-${screen.id}" role="tabpanel" aria-label="${screen.label}" hidden></section>`).join('');

  for (const button of document.querySelectorAll('[data-screen]')) {
    button.addEventListener('click', () => goTo(button.dataset.screen));
  }
  document.querySelector('[data-more]').addEventListener('click', openMoreSheet);
  document.getElementById('theme-button').addEventListener('click', () => setTheme(nextTheme(currentTheme())));
  document.getElementById('quick-checkin').addEventListener('click', () => goTo('checkin'));
  document.getElementById('tour-button').addEventListener('click', () => startTour(app));
}

function shortLabel(label) {
  const map = { 'Sot': 'Sot', 'Check-in': 'Check-in', 'My Normal': 'Normalja', 'Something Changed': 'Changed' };
  return map[label] || label;
}

function openMoreSheet() {
  const extra = SCREENS.filter(screen => !screen.primary);
  const panel = openSheet('Më shumë', `
    <div class="nav">
      ${extra.map(screen => `<button type="button" class="nav-item" data-sheet-screen="${screen.id}">${icon(screen.icon)}<span>${screen.label}</span></button>`).join('')}
      <p class="nav-group">Prezantimi</p>
      <button type="button" class="nav-item" data-sheet-tour>${icon('play')}<span>Prezantim i udhëhequr</span></button>
      <button type="button" class="nav-item" data-sheet-theme>${icon(themeIcon(currentTheme()))}<span>${themeLabel(currentTheme())}</span></button>
    </div>`);

  for (const button of panel.querySelectorAll('[data-sheet-screen]')) {
    button.addEventListener('click', () => { closeLayer(); goTo(button.dataset.sheetScreen); });
  }
  panel.querySelector('[data-sheet-tour]').addEventListener('click', () => { closeLayer(); startTour(app); });
  panel.querySelector('[data-sheet-theme]').addEventListener('click', () => { closeLayer(); setTheme(nextTheme(currentTheme())); });
}

// ---------- routeri ----------

function goTo(name) {
  const screen = byId[name] || byId.dashboard;
  current = screen.id;

  navigating = true;
  if (location.hash !== `#/${screen.id}`) location.hash = `#/${screen.id}`;
  navigating = false;

  for (const item of SCREENS) {
    document.getElementById('screen-' + item.id).hidden = item.id !== screen.id;
  }
  const host = document.getElementById('screen-' + screen.id);
  host.innerHTML = '';
  screen.render(host, app);

  document.getElementById('page-title').textContent = screen.label;
  document.title = `${screen.label} · A JE MIRË? 2036`;
  for (const button of document.querySelectorAll('[data-screen]')) {
    const isActive = button.dataset.screen === screen.id;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  refreshShell();
  drawTourBar();
}

// Çdo buton me data-go në ekrane lundron vetë, pa pasur nevojë që çdo ekran ta lidhë.
document.getElementById('screens').addEventListener('click', event => {
  const target = event.target.closest('[data-go]');
  if (target) goTo(target.dataset.go);
});

window.addEventListener('hashchange', () => {
  if (navigating || !app.profile) return;
  const name = location.hash.replace('#/', '');
  if (byId[name] && name !== current) goTo(name);
});

// ---------- gjendja ----------

function save() {
  const stored = saveProfile(app.profile);
  refreshShell();
  return stored;
}

function refreshShell() {
  const badge = document.getElementById('mode-badge');
  const themeButton = document.getElementById('theme-button');
  if (themeButton) {
    themeButton.innerHTML = icon(themeIcon(currentTheme()));
    themeButton.setAttribute('aria-label', `Tema: ${themeLabel(currentTheme())}`);
    themeButton.title = themeLabel(currentTheme());
  }
  if (!badge || !app.profile) return;
  const demo = app.profile.mode === 'demo';
  badge.innerHTML = `${icon(demo ? 'spark' : 'shield', 15)}
    <span><strong>${demo ? 'Profil sintetik demo' : 'Profil privat'}</strong>
    ${app.profile.checkins.length} ditë · vetëm në këtë pajisje</span>`;
}

function acceptConsent(mode, aiChecked) {
  const consent = { store: true, ai: Boolean(aiChecked), acceptedAt: new Date().toISOString() };
  app.profile = mode === 'private' ? emptyProfile(consent) : generateProfile(consent);
  app.profile.settings.theme = temporaryTheme;
  saveProfile(app.profile);
  showApp();
  goTo(mode === 'private' ? 'checkin' : 'dashboard');
  toast(mode === 'private' ? 'Profili privat u krijua' : 'Profili sintetik u ngarkua', 'ok');
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
  saveProfile(app.profile);
  goTo('dashboard');
}

function resetToPrivate() {
  const consent = { ...app.profile.consent };
  const theme = currentTheme();
  app.profile = emptyProfile(consent);
  app.profile.settings.theme = theme;
  saveProfile(app.profile);
  goTo('checkin');
}

function deleteEverything() {
  clearAll();
  stopTour();
  temporaryTheme = currentTheme();
  app.profile = null;
  showConsent();
  toast('Të gjitha të dhënat u fshinë');
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

function boot() {
  document.getElementById('brand-mark').innerHTML = logoMark(34);
  buildShell();
  applyTheme(currentTheme());

  const hasConsent = app.profile !== null && app.profile.consent && app.profile.consent.store === true;
  if (!hasConsent) {
    showConsent();
    return;
  }
  showApp();
  const requested = location.hash.replace('#/', '');
  goTo(byId[requested] ? requested : 'dashboard');
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
