import { loadProfile, saveProfile, clearAll, todayIso, recordConsent } from './storage.js';
import { generateProfile, emptyProfile } from './seed.js';
import { icon, applyTheme, themeIcon, themeLabel, themeButtonsHtml, toast, openSheet, openModal, closeLayer, confirmDialog, CUSTOM_FIELDS, DEFAULT_CUSTOM, normalizeCustomThemes, isCustomThemeId, customThemeKey, contrastRatio } from './ui.js';
import { escapeHtml } from './format.js';
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
    <button type="button" data-act="apply">${icon('check', 14)} ${t('core.themeApply')}</button>
    <button type="button" data-act="edit">${icon('edit', 14)} ${t('core.themeEdit')}</button>
    <button type="button" data-act="duplicate">${icon('copy', 14)} ${t('core.themeDuplicate')}</button>
    <button type="button" class="is-danger" data-act="delete">${icon('trash', 14)} ${t('core.themeDelete')}</button>`;
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
    name: `${source.name} ${t('core.themeCopySuffix')}`.slice(0, 40),
    colors: { ...source.colors }
  };
  const next = list.concat(copy);
  persistCustomThemes(next, copy.id);
  paintTheme(`custom:${copy.id}`);
  refreshShell();
  toast(t('core.themeCopied'), 'ok');
}

function deleteCustomTheme(id) {
  const item = currentCustomThemes().find(theme => theme.id === id);
  if (!item) return;
  confirmDialog(t('core.themeDeleteTitle'), t('core.themeDeleteText', { name: item.name }), t('core.themeDelete'), () => {
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
    toast(t('core.themeDeleted'));
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

  const panel = openModal(existing ? t('core.themeEditTitle') : t('core.themeCreate'), `
    <label class="theme-field">
      <span>${t('core.themeName')}</span>
      <input type="text" id="custom-theme-name" maxlength="40" placeholder="${escapeHtml(t('core.themeNameHint'))}" value="${escapeHtml(draftName)}">
    </label>
    <div class="theme-preview mt-4">
      <span>${t('core.themePreview')}</span>
      <button type="button" class="btn btn-primary" tabindex="-1">${t('core.themeButton')}</button>
    </div>
    <div class="theme-fields">${fields}</div>
    <p class="small mt-3" id="theme-contrast" role="status" aria-live="polite"></p>
    <p class="muted small">${t('core.themeBackHint')}</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-reset>${t('core.themeReset')}</button>
      <button type="button" class="btn btn-primary" data-save>${t('core.themeSave')}</button>
    </div>`);

  // Paralajmërim i qartë kur ngjyrat e zgjedhura e bëjnë tekstin të vështirë për t'u lexuar (WCAG AA 4.5:1).
  const showContrast = () => {
    const pairs = [
      [t('core.contrastText'), draft.text, draft.bg], [t('core.contrastCards'), draft.text, draft.surface],
      [t('core.contrastButtons'), draft.buttonText, draft.button], [t('core.contrastAccent'), draft.accent, draft.surface]
    ].map(([name, fg, bg]) => ({ name, value: contrastRatio(fg, bg) }));
    const weak = pairs.filter(pair => pair.value < 4.5);
    panel.querySelector('#theme-contrast').innerHTML = weak.length
      ? `<span class="warn">${icon('info', 14)} ${escapeHtml(t('core.contrastWeak', { list: weak.map(pair => `${pair.name} ${pair.value.toFixed(1)}:1`).join(', ') }))}</span>`
      : `${icon('check', 14)} ${escapeHtml(t('core.contrastOk'))}`;
  };

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
      showContrast();
    }
    if (hex && /^#[0-9a-fA-F]{6}$/.test(hex.value)) {
      draft[hex.dataset.customHex] = hex.value;
      const twin = panel.querySelector(`[data-custom="${hex.dataset.customHex}"]`);
      if (twin) twin.value = hex.value;
      applyTheme('custom', draft);
      showContrast();
    }
  });

  panel.querySelector('[data-reset]').addEventListener('click', () => {
    draft = { ...DEFAULT_CUSTOM };
    fill(draft);
    applyTheme('custom', draft);
    showContrast();
  });
  showContrast();

  panel.querySelector('[data-save]').addEventListener('click', () => {
    const name = (draftName || '').trim() || (existing ? existing.name : t('core.themeCustom'));
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
    toast(existing ? t('core.themeUpdated') : t('core.themeSaved'), 'ok');
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
  document.getElementById('theme-choices').setAttribute('aria-label', t('core.themePick'));
  renderThemeChoices();
  markActive();
  bindShellOnce();
}

// Guaska rindërtohet kur ndryshojnë flamujt, sesioni ose gjuha; dëgjuesit lidhen vetëm një herë.
let shellBound = false;
function bindShellOnce() {
  if (shellBound) return;
  shellBound = true;
  const choices = document.getElementById('theme-choices');
  const toggle = document.getElementById('theme-button');
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

function openMoreSheet() {
  const extra = SCREENS.filter(screen => visible(screen) && !screen.primary);
  const panel = openSheet(t('nav.more'), `
    <div class="nav">
      ${extra.map(screen => `<button type="button" class="nav-item" data-sheet-screen="${screen.id}">${icon(screen.icon)}<span>${label(screen)}</span></button>`).join('')}
      <p class="nav-group">${t('nav.settings')}</p>
      <button type="button" class="nav-item" data-sheet-lang>${icon('auto')}<span>${getLang() === 'sq' ? 'English' : 'Shqip'}</span></button>
      <button type="button" class="nav-item" data-sheet-tour>${icon('play')}<span>${t('nav.tour')}</span></button>
      <p class="nav-group">${t('nav.theme')}</p>
      <div class="theme-choices is-sheet">${themeButtonsHtml(currentCustomThemes())}</div>
    </div>`);

  for (const button of panel.querySelectorAll('[data-sheet-screen]')) {
    button.addEventListener('click', () => { closeLayer(); goTo(button.dataset.sheetScreen); });
  }
  panel.querySelector('[data-sheet-lang]').addEventListener('click', () => { closeLayer(); setLanguage(getLang() === 'sq' ? 'en' : 'sq'); });
  panel.querySelector('[data-sheet-tour]').addEventListener('click', () => { closeLayer(); startTour(app); });
  markThemeChips(panel);
  bindThemeChoices(panel);
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
    const customs = currentCustomThemes();
    themeButton.innerHTML = icon(themeIcon(currentTheme()));
    themeButton.setAttribute('aria-label', `${t('nav.theme')}: ${themeLabel(currentTheme(), customs)}`);
    themeButton.title = themeLabel(currentTheme(), customs);
  }
  renderThemeChoices();
  markThemeChips(document);
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
  app.profile.settings.lang = getLang();
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
  app.profile.settings.lang = getLang();
  if (customThemes.length) app.profile.settings.customThemes = customThemes;
  if (customTheme) app.profile.settings.customTheme = customTheme;
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
  migrateCustomThemes();
  document.getElementById('brand-mark').innerHTML = logoMark(34);
  buildShell();
  paintTheme(currentTheme());

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
  if (currentTheme() === 'auto') paintTheme('auto');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && isTourActive()) stopTour();
});

boot();

// Që të mund t'i provoj funksionet nga Console, p.sh. AJM.stats.mean([2,4,6]).
window.AJM = { app, stats, patterns };
