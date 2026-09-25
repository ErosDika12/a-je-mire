// Profili: gjuha, tema dhe hyrja te të gjitha mjetet që nuk janë në navigimin kryesor.
// Këtu erdhi zgjedhja e temës (më parë në kokën e faqes) dhe zona "Insights" me analizat e vjetra.
import { icon } from '../ui.js';
import { t, getLang, LANGUAGES } from '../i18n/index.js';

const TOOLS = ['checkin', 'focus', 'toolkits', 'support', 'connect', 'challenges'];
const INSIGHTS = ['normal', 'changed', 'why', 'patterns', 'helps'];
const PRIVACY = ['data', 'account', 'privacy'];
const ICONS = {
  checkin: 'check', focus: 'play', toolkits: 'leaf', support: 'shield', connect: 'connect', challenges: 'spark',
  normal: 'normal', changed: 'shift', why: 'why', patterns: 'patterns', helps: 'spark',
  data: 'database', account: 'cloud', privacy: 'privacy'
};

const links = ids => `<div class="prof-links">${ids.map(id => `
  <button type="button" class="prof-link" data-go="${id}">${icon(ICONS[id], 18)}<span>${t(`nav.${id}`)}</span>${icon('next', 14)}</button>`).join('')}</div>`;

export function renderProfile(container, app) {
  const profile = app.profile;
  const demo = profile.mode === 'demo';
  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('prof.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('prof.title')}</h1>
      <p class="page-sub">${t('prof.subtitle')}</p>
    </header>

    <section class="card prof-mode" aria-labelledby="prof-mode">
      <h2 id="prof-mode" class="card-title">${demo ? t('shell.demoProfile') : t('shell.privateProfile')}</h2>
      <p class="card-sub">${demo ? t('prof.demoNote') : t('prof.privateNote')}</p>
      <div class="mira-actions">
        <button type="button" class="btn btn-sm" data-go="demo60">${icon('play', 14)} ${t('prof.demo60')}</button>
        <button type="button" class="btn btn-sm" data-tour>${icon('help', 14)} ${t('nav.tour')}</button>
      </div>
    </section>

    <section class="card" aria-labelledby="prof-lang">
      <h2 id="prof-lang" class="card-title">${t('prof.language')}</h2>
      <div class="lang-row mt-3" role="group" aria-labelledby="prof-lang">
        ${Object.keys(LANGUAGES).map(code => `<button type="button" class="btn" data-lang="${code}" lang="${code}" aria-pressed="${code === getLang()}">${LANGUAGES[code].core.languageName}</button>`).join('')}
      </div>
    </section>

    <section class="card" aria-labelledby="prof-theme">
      <h2 id="prof-theme" class="card-title">${t('nav.theme')}</h2>
      <div class="theme-choices is-sheet mt-3" id="theme-choices" role="group" aria-label="${t('core.themePick')}"></div>
    </section>

    <section class="card" aria-labelledby="prof-tools"><h2 id="prof-tools" class="card-title">${t('prof.tools')}</h2>${links(TOOLS)}</section>
    <section class="card" aria-labelledby="prof-ins">
      <h2 id="prof-ins" class="card-title">${t('prof.insights')}</h2>
      <p class="card-sub">${t('prof.insightsNote')}</p>${links(INSIGHTS)}
    </section>
    <section class="card" aria-labelledby="prof-priv"><h2 id="prof-priv" class="card-title">${t('prof.privacy')}</h2>${links(PRIVACY)}</section>`;

  app.mountThemePicker(container.querySelector('#theme-choices'));
  for (const button of container.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => app.setLanguage(button.dataset.lang));
  }
  container.querySelector('[data-tour]').addEventListener('click', () => app.startTour());
}
