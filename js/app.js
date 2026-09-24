import { loadProfile, saveProfile, clearAll, todayIso, recordConsent } from './storage.js';
import { generateProfile, emptyProfile } from './seed.js';
import { icon, applyTheme, themeIcon, themeLabel, themeButtonsHtml, toast, openSheet, openModal, closeLayer, confirmDialog, CUSTOM_FIELDS, DEFAULT_CUSTOM, normalizeCustomThemes, isCustomThemeId, customThemeKey } from './ui.js';
import { escapeHtml } from './format.js';
import { startTour, stopTour, isTourActive, drawTourBar } from './tour.js';

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
import { isAuthRedirect, setAuthPersistence } from './cloud/client.js';
import { forgetPassphrase } from './cloud/sync.js';

import * as stats from './stats.js';
import * as patterns from './patterns.js';

const SCREENS = [
  { id: 'dashboard', label: 'Sot',                icon: 'today',    group: 'Ti',          render: renderDashboard, primary: true },
  { id: 'checkin',   label: 'Check-in',           icon: 'check',    group: 'Ti',          render: renderCheckin },
  { id: 'normal',    label: 'My Normal',          icon: 'normal',   group: 'Patternat',   render: renderNormal,    primary: true },
  { id: 'changed',   label: 'Something Changed',  icon: 'shift',    group: 'Patternat',   render: renderChanged },
  { id: 'why',       label: 'Why?',               icon: 'why',      group: 'Patternat',   render: renderWhy },
  { id: 'patterns',  label: 'Patterns',           icon: 'patterns', group: 'Patternat',   render: renderPatterns,  primary: true },
  { id: 'helps',     label: 'What Helps Me?',     icon: 'spark',    group: 'Patternat',   render: renderHelps },
  { id: 'connect',   label: 'Lidhjet',            icon: 'connect',  group: 'Lidhjet',     render: renderConnect,   primary: true },
  { id: 'data',      label: 'Të dhënat e mia',    icon: 'database', group: 'Privatësia',  render: renderData },
  { id: 'account',   label: 'Llogaria',           icon: 'cloud',    group: 'Privatësia',  render: renderAccount },
  { id: 'privacy',   label: 'Privatësia',         icon: 'privacy',  group: 'Privatësia',  render: renderPrivacy }
];

// Adresat e vjetra (#/my5, #/kafe, #/wall) dhe butonat data-go vazhdojnë të punojnë.
const ALIASES = { my5: 'connect', kafe: 'connect', wall: 'connect' };

const byId = Object.fromEntries(SCREENS.map(screen => [screen.id, screen]));

// Tema para consent-it rri vetëm në memorie: asgjë nuk shkruhet pa leje.
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
  rerender: () => goTo(current),
  startTour: () => startTour(app)
};

// ---------- tema ----------

function currentTheme() {
  return app.profile ? (app.profile.settings.theme || 'auto') : temporaryTheme;
}

function currentCustomThemes() {
  return normalizeCustomThemes(app.profile && app.profile.settings);
}

function migrateCustomThemes() {
  if (!app.profile || !app.profile.settings) return;
  const list = normalizeCustomThemes(app.profile.settings);
  if (!list.length) return;
  if (!Array.isArray(app.profile.settings.customThemes)) {
    app.profile.settings.customThemes = list;
  }
  if (app.profile.settings.theme === 'custom') {
    app.profile.settings.theme = `custom:${list[0].id}`;
    saveProfile(app.profile);
  }
}

function colorsForTheme(theme) {
  const list = currentCustomThemes();
  const key = customThemeKey(theme);
  if (!key) return null;
  const found = list.find(item => item.id === key);
  return found ? found.colors : (list[0] ? list[0].colors : DEFAULT_CUSTOM);
}

function paintTheme(theme) {
  applyTheme(theme, colorsForTheme(theme));
}

function persistCustomThemes(list, activeId) {
  if (!app.profile) return;
  app.profile.settings.customThemes = list;
  app.profile.settings.customTheme = activeId
    ? (list.find(item => item.id === activeId) || {}).colors || app.profile.settings.customTheme
    : app.profile.settings.customTheme;
  if (activeId) app.profile.settings.theme = `custom:${activeId}`;
  saveProfile(app.profile);
}

function setTheme(theme) {
  if (app.profile) {
    app.profile.settings.theme = theme;
    if (isCustomThemeId(theme)) {
      const colors = colorsForTheme(theme);
      if (colors) app.profile.settings.customTheme = colors;
    }
    saveProfile(app.profile);
  } else {
    temporaryTheme = theme;
  }
  paintTheme(theme);
  refreshShell();
}

function markThemeChips(root) {
  const active = currentTheme();
  for (const button of (root || document).querySelectorAll('[data-theme-id]')) {
    const on = button.dataset.themeId === active;
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function renderThemeChoices() {
  const choices = document.getElementById('theme-choices');
  if (!choices) return;
  choices.innerHTML = themeButtonsHtml(currentCustomThemes());
  markThemeChips(choices);
}

function closeThemePanel() {
  const box = document.getElementById('theme-switcher');
  const toggle = document.getElementById('theme-button');
  if (box) box.classList.remove('is-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  closeThemeMenu();
}

function closeThemeMenu() {
  const menu = document.getElementById('theme-menu');
  if (menu) menu.remove();
}

function openCustomMenu(anchor, id) {
  closeThemeMenu();
  const item = currentCustomThemes().find(theme => theme.id === id);
  if (!item) return;
  const menu = document.createElement('div');
  menu.id = 'theme-menu';
  menu.className = 'theme-menu';
  menu.innerHTML = `
    <button type="button" data-act="apply">${icon('check', 14)} Aktivizo</button>
    <button type="button" data-act="edit">${icon('edit', 14)} Ndrysho</button>
    <button type="button" data-act="duplicate">${icon('copy', 14)} Kopjo</button>
    <button type="button" class="is-danger" data-act="delete">${icon('trash', 14)} Fshi</button>`;
  const wrap = anchor.closest('.theme-custom-item') || anchor.parentElement;
  wrap.appendChild(menu);
  menu.addEventListener('click', event => {
    const act = event.target.closest('[data-act]');
    if (!act) return;
    event.stopPropagation();
    closeThemeMenu();
    if (act.dataset.act === 'apply') setTheme(`custom:${id}`);
    if (act.dataset.act === 'edit') openCustomEditor(id);
    if (act.dataset.act === 'duplicate') duplicateCustomTheme(id);
    if (act.dataset.act === 'delete') deleteCustomTheme(id);
  });
}

function bindThemeChoices(root) {
  root.addEventListener('click', event => {
    const create = event.target.closest('[data-theme-create]');
    if (create) {
      event.stopPropagation();
      closeThemePanel();
      openCustomEditor();
      return;
    }
    const menuBtn = event.target.closest('[data-custom-menu]');
    if (menuBtn) {
      event.stopPropagation();
      const open = document.getElementById('theme-menu');
      if (open && open.parentElement.contains(menuBtn)) closeThemeMenu();
      else openCustomMenu(menuBtn, menuBtn.dataset.customMenu);
      return;
    }
    const button = event.target.closest('[data-theme-id]');
    if (!button) return;
    const id = button.dataset.themeId;
    setTheme(id);
    closeThemePanel();
    if (root.classList.contains('sheet') && !isCustomThemeId(id)) closeLayer();
  });
}

function newCustomId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function duplicateCustomTheme(id) {
  const list = currentCustomThemes();
  const source = list.find(item => item.id === id);
  if (!source) return;
  const copy = {
    id: newCustomId(),
    name: (source.name + ' (kopje)').slice(0, 40),
    colors: { ...source.colors }
  };
  const next = list.concat(copy);
  persistCustomThemes(next, copy.id);
  paintTheme(`custom:${copy.id}`);
  refreshShell();
  toast('Tema u kopjua', 'ok');
}

function deleteCustomTheme(id) {
  const item = currentCustomThemes().find(theme => theme.id === id);
  if (!item) return;
  confirmDialog('Fshi temën', `Të fshihet “${item.name}”?`, 'Fshi', () => {
    const next = currentCustomThemes().filter(theme => theme.id !== id);
    if (app.profile) {
      app.profile.settings.customThemes = next;
      if (customThemeKey(currentTheme()) === id) {
        app.profile.settings.theme = 'light';
        app.profile.settings.customTheme = next[0] ? next[0].colors : undefined;
      }
      saveProfile(app.profile);
    }
    paintTheme(currentTheme());
    refreshShell();
    toast('Tema u fshi');
  });
}

function openCustomEditor(editId) {
  const list = currentCustomThemes();
  const existing = editId ? list.find(item => item.id === editId) : null;
  const saved = { ...DEFAULT_CUSTOM, ...(existing ? existing.colors : {}) };
  let draft = { ...saved };
  let draftName = existing ? existing.name : '';
  let committed = false;
  applyTheme(existing ? `custom:${existing.id}` : 'custom', draft);

  const fields = CUSTOM_FIELDS.map(field => `
    <label class="theme-field">
      <span>${escapeHtml(field.label)}</span>
      <span class="theme-field-row">
        <input type="color" data-custom="${field.key}" value="${saved[field.key]}">
        <input type="text" data-custom-hex="${field.key}" value="${saved[field.key]}" maxlength="7" spellcheck="false">
      </span>
    </label>`).join('');

  const panel = openModal(existing ? 'Ndrysho Custom Theme' : 'Krijo Custom Theme', `
    <label class="theme-field">
      <span>Emri i temës</span>
      <input type="text" id="custom-theme-name" maxlength="40" placeholder="p.sh. Relax Theme" value="${escapeHtml(draftName)}">
    </label>
    <div class="theme-preview mt-4">
      <span>Preview</span>
      <button type="button" class="btn btn-primary" tabindex="-1">Buton</button>
    </div>
    <div class="theme-fields">${fields}</div>
    <p class="muted small">Zgjidh një temë tjetër nga shiriti për t'u kthyer te një temë e gatshme.</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-reset>Rivendos ngjyrat</button>
      <button type="button" class="btn btn-primary" data-save>Ruaj temën</button>
    </div>`);

  const fill = palette => {
    for (const field of CUSTOM_FIELDS) {
      const color = panel.querySelector(`[data-custom="${field.key}"]`);
      const hex = panel.querySelector(`[data-custom-hex="${field.key}"]`);
      if (color) color.value = palette[field.key];
      if (hex) hex.value = palette[field.key];
    }
  };

  panel.addEventListener('input', event => {
    if (event.target.id === 'custom-theme-name') {
      draftName = event.target.value;
      return;
    }
    const color = event.target.closest('[data-custom]');
    const hex = event.target.closest('[data-custom-hex]');
    if (color) {
      draft[color.dataset.custom] = color.value;
      const twin = panel.querySelector(`[data-custom-hex="${color.dataset.custom}"]`);
      if (twin) twin.value = color.value;
      applyTheme('custom', draft);
    }
    if (hex && /^#[0-9a-fA-F]{6}$/.test(hex.value)) {
      draft[hex.dataset.customHex] = hex.value;
      const twin = panel.querySelector(`[data-custom="${hex.dataset.customHex}"]`);
      if (twin) twin.value = hex.value;
      applyTheme('custom', draft);
    }
  });

  panel.querySelector('[data-reset]').addEventListener('click', () => {
    draft = { ...DEFAULT_CUSTOM };
    fill(draft);
    applyTheme('custom', draft);
  });

  panel.querySelector('[data-save]').addEventListener('click', () => {
    const name = (draftName || '').trim() || (existing ? existing.name : 'Custom Theme');
    const next = currentCustomThemes().slice();
    let id = existing ? existing.id : newCustomId();
    if (existing) {
      const index = next.findIndex(item => item.id === id);
      if (index !== -1) next[index] = { id, name: name.slice(0, 40), colors: { ...draft } };
    } else {
      next.push({ id, name: name.slice(0, 40), colors: { ...draft } });
    }
    committed = true;
    persistCustomThemes(next, id);
    paintTheme(`custom:${id}`);
    closeLayer();
    refreshShell();
    toast(existing ? 'Tema u përditësua' : 'Tema custom u ruajt', 'ok');
  });

  const revert = () => {
    if (!committed) paintTheme(currentTheme());
    document.removeEventListener('keydown', onEscape);
  };
  const onEscape = event => {
    if (event.key === 'Escape') revert();
  };
  panel.querySelector('[data-close]').addEventListener('click', revert);
  const backdrop = document.querySelector('.sheet-backdrop');
  if (backdrop) backdrop.addEventListener('click', revert);
  document.addEventListener('keydown', onEscape);
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
  const choices = document.getElementById('theme-choices');
  const toggle = document.getElementById('theme-button');
  renderThemeChoices();
  bindThemeChoices(choices);
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const box = document.getElementById('theme-switcher');
    const open = box.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) closeThemeMenu();
  });
  document.addEventListener('click', event => {
    const box = document.getElementById('theme-switcher');
    if (box && !box.contains(event.target)) closeThemePanel();
  });
  document.getElementById('quick-checkin').addEventListener('click', () => goTo('checkin'));
  document.getElementById('tour-button').addEventListener('click', () => startTour(app));
}

function shortLabel(label) {
  const map = { 'My Normal': 'Normalja' };
  return map[label] || label;
}

function openMoreSheet() {
  const extra = SCREENS.filter(screen => !screen.primary);
  const panel = openSheet('Më shumë', `
    <div class="nav">
      ${extra.map(screen => `<button type="button" class="nav-item" data-sheet-screen="${screen.id}">${icon(screen.icon)}<span>${screen.label}</span></button>`).join('')}
      <p class="nav-group">Prezantimi</p>
      <button type="button" class="nav-item" data-sheet-tour>${icon('play')}<span>Prezantim i udhëhequr</span></button>
      <p class="nav-group">Tema</p>
      <div class="theme-choices is-sheet">${themeButtonsHtml(currentCustomThemes())}</div>
    </div>`);

  for (const button of panel.querySelectorAll('[data-sheet-screen]')) {
    button.addEventListener('click', () => { closeLayer(); goTo(button.dataset.sheetScreen); });
  }
  panel.querySelector('[data-sheet-tour]').addEventListener('click', () => { closeLayer(); startTour(app); });
  markThemeChips(panel);
  bindThemeChoices(panel);
}

// ---------- routeri ----------

function goTo(name) {
  if (ALIASES[name]) {
    setConnectTab(name);
    name = ALIASES[name];
  }
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
  if ((byId[name] || ALIASES[name]) && name !== current) goTo(name);
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
    const customs = currentCustomThemes();
    themeButton.innerHTML = icon(themeIcon(currentTheme()));
    themeButton.setAttribute('aria-label', `Tema: ${themeLabel(currentTheme(), customs)}`);
    themeButton.title = themeLabel(currentTheme(), customs);
  }
  renderThemeChoices();
  markThemeChips(document);
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
  recordConsent(app.profile, 'local_storage', true);
  recordConsent(app.profile, 'text_help', aiChecked);
  saveProfile(app.profile);
  setAuthPersistence(true);
  showApp();
  // Nëse erdhi nga një link emaili, pas consent-it vazhdon te Llogaria.
  goTo(pendingAccount ? 'account' : mode === 'private' ? 'checkin' : 'dashboard');
  pendingAccount = false;
  toast(mode === 'private' ? 'Profili privat u krijua' : 'Profili sintetik u ngarkua', 'ok');
}

function replaceProfile(profile) {
  app.profile = profile;
  saveProfile(app.profile);
  paintTheme(currentTheme());
  refreshShell();
}

function resetToDemo() {
  const consent = { ...app.profile.consent };
  const theme = currentTheme();
  const customThemes = currentCustomThemes();
  const customTheme = colorsForTheme(theme);
  app.profile = generateProfile(consent);
  app.profile.settings.theme = theme;
  if (customThemes.length) app.profile.settings.customThemes = customThemes;
  if (customTheme) app.profile.settings.customTheme = customTheme;
  saveProfile(app.profile);
  goTo('dashboard');
}

function resetToPrivate() {
  const consent = { ...app.profile.consent };
  const theme = currentTheme();
  const customThemes = currentCustomThemes();
  const customTheme = colorsForTheme(theme);
  app.profile = emptyProfile(consent);
  app.profile.settings.theme = theme;
  if (customThemes.length) app.profile.settings.customThemes = customThemes;
  if (customTheme) app.profile.settings.customTheme = customTheme;
  saveProfile(app.profile);
  goTo('checkin');
}

function deleteEverything() {
  clearAll();
  forgetPassphrase();
  setAuthPersistence(false);
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
  migrateCustomThemes();
  document.getElementById('brand-mark').innerHTML = logoMark(34);
  buildShell();
  paintTheme(currentTheme());

  const hasConsent = app.profile !== null && app.profile.consent && app.profile.consent.store === true;
  setAuthPersistence(hasConsent);
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
  else goTo(byId[requested] || ALIASES[requested] ? requested : 'dashboard');
}

// ---------- offline (PWA) ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && !import.meta.env.PROD) return;
  navigator.serviceWorker.register('/sw.js').then(registration => {
    const offer = worker => showUpdateNotice(() => worker.postMessage('SKIP_WAITING'));
    if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // Vetëm kur një version i vjetër po kontrollon faqen ka kuptim njoftimi "version i ri".
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
  }).catch(() => { /* pa offline, aplikacioni punon njësoj */ });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateNotice(apply) {
  if (document.getElementById('update-notice')) return;
  const bar = document.createElement('div');
  bar.id = 'update-notice';
  bar.className = 'update-notice';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${icon('refresh', 16)} Ka një version të ri të aplikacionit.</span>
    <button type="button" class="btn btn-sm btn-primary">Rifresko</button>`;
  bar.querySelector('button').addEventListener('click', apply);
  document.body.appendChild(bar);
}

// Tema e sistemit mund të ndryshojë ndërsa faqja është e hapur.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme() === 'auto') paintTheme('auto');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && isTourActive()) stopTour();
});

boot();

// Që të mund t'i provoj funksionet nga Console, p.sh. AJM.stats.mean([2,4,6]).
window.AJM = { app, stats, patterns };
