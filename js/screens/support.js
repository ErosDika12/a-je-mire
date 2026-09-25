// "Kam nevojë për ndihmë": shtatë opsione, gjithmonë drejt njerëzve realë.
// Numrat e emergjencës vijnë vetëm nga support.js dhe shfaqen vetëm kur janë verifikuar.
import { icon } from '../ui.js';
import { escapeHtml, formatDateLong } from '../format.js';
import { t, tList } from '../i18n/index.js';
import { SUPPORT_OPTIONS, COUNTRY_CODES, resourcesFor } from '../support.js';
import { coachHtml, wireCoach } from '../coach-ui.js';
import { lastContact } from '../life.js';
import { openToolkit } from './toolkits.js';

let open = null;

export function renderSupport(container, app) {
  const country = app.profile.settings.country || 'XK';
  const urgent = open === 'unsafe' || open === 'immediate';
  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('sup.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('sup.title')}</h1>
      <p class="page-sub">${t('sup.subtitle')}</p>
    </header>
    ${urgent || !open ? urgentCard(country) : ''}
    ${open ? `<button type="button" class="btn btn-ghost btn-sm" data-back>${icon('back', 15)} ${t('sup.back')}</button>${detail(open, app)}` : optionsList()}`;
  wire(container, app);
}

function optionsList() {
  return `<div class="sup-options">${SUPPORT_OPTIONS.map(id => `
    <button type="button" class="sup-option ${id === 'immediate' || id === 'unsafe' ? 'is-urgent' : ''}" data-open="${id}">
      <span>${t(`sup.o.${id}`)}</span>${icon('next', 16)}</button>`).join('')}</div>`;
}

function urgentCard(country) {
  const res = resourcesFor(country);
  return `<section class="card card-signal sup-urgent" aria-labelledby="sup-urgent">
    <h2 id="sup-urgent" class="card-title">${t('sup.urgentTitle')}</h2>
    <ol class="mira-read">${tList('sup.urgentSteps').map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <label class="field mt-3" for="sup-country"><span class="card-sub">${t('sup.country')}</span>
      <select id="sup-country">${COUNTRY_CODES.map(c => `<option value="${c}" ${c === country ? 'selected' : ''}>${t(`sup.countryNames.${c}`)}</option>`).join('')}</select></label>
    ${res.emergency
      ? `<p class="sup-number mt-3">${escapeHtml(t('sup.emergency', { n: res.emergency }))}</p>
         <a class="btn btn-danger mt-2" href="tel:${escapeHtml(res.emergency)}">${escapeHtml(t('sup.call', { n: res.emergency }))}</a>`
      : `<p class="mt-3">${t('sup.notConfigured')}</p>`}
    <p class="card-note">${t('sup.configNote')}</p>
  </section>`;
}

function peopleList(app) {
  const people = app.profile.my5 || [];
  if (!people.length) return `<p class="card-sub">${t('sup.peopleEmpty')}</p><button type="button" class="btn btn-sm mt-2" data-go="my5">${t('sup.openMy5')}</button>`;
  return `<ul class="sup-people">${people.map(p => {
    const last = lastContact(app.profile, p.name);
    return `<li><span class="avatar" style="background:${escapeHtml(p.color)}" aria-hidden="true">${escapeHtml(p.name.charAt(0))}</span>
      <div><strong>${escapeHtml(p.name)}</strong><span class="card-sub">${escapeHtml(p.relation || '')}${last ? ` · ${escapeHtml(t('sup.lastContact', { date: formatDateLong(last) }))}` : ''}</span></div></li>`;
  }).join('')}</ul>`;
}

function detail(id, app) {
  const names = (app.profile.my5 || []).map(p => p.name);
  const who = `<h3 class="card-title mt-4">${t('sup.whoTitle')}</h3><ul class="mira-read">${tList('sup.who').map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
  const body = {
    trusted: `<p class="mira-voice">${t('sup.trustedText')}</p>${who}${peopleList(app)}${coachHtml({ scenario: 'ask_help', people: names })}`,
    prepare: coachHtml({ scenario: 'ask_help', people: names }),
    people: peopleList(app),
    bullying: `<p class="mira-voice">${t('sup.bullyingText')}</p>
      <div class="mira-actions"><button type="button" class="btn btn-primary" data-kit="bullying">${t('sup.openKit')}</button>
      <button type="button" class="btn" data-kit="cyberbullying">${t('sup.openCyber')}</button></div>
      ${coachHtml({ scenario: 'ask_help', people: names })}`,
    friend: `<ol class="mira-read">${tList('sup.friendSteps').map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>${coachHtml({ scenario: 'check_friend', people: names })}`,
    unsafe: `<p class="mira-voice">${t('sup.unsafeText')}</p>${who}${peopleList(app)}`,
    immediate: `${who}${peopleList(app)}`
  }[id];
  return `<section class="card mt-3" aria-labelledby="sup-detail"><h2 id="sup-detail" class="card-title">${t(`sup.o.${id}`)}</h2>${body}</section>`;
}

function wire(root, app) {
  const rerender = () => renderSupport(root, app);
  root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { open = b.dataset.open; rerender(); }));
  const back = root.querySelector('[data-back]');
  if (back) back.addEventListener('click', () => { open = null; rerender(); });
  const country = root.querySelector('#sup-country');
  if (country) country.addEventListener('change', () => { app.profile.settings.country = country.value; app.save(); rerender(); });
  root.querySelectorAll('[data-kit]').forEach(b => b.addEventListener('click', () => { openToolkit(b.dataset.kit); app.goTo('toolkits'); }));
  wireCoach(root);
}
