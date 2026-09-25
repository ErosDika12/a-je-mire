// Mjetet për situata: 14 mjete interaktive. Çdo mjet ka të njëjtën strukturë, prandaj një ekran i vetëm
// i vizaton të gjitha nga përkthimet (i18n/screens/tool.js).
import { icon } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, tList } from '../i18n/index.js';
import { coachHtml, wireCoach } from '../coach-ui.js';

export const TOOLKITS = [
  { id: 'exams', coach: 'teacher' }, { id: 'procrastination', coach: 'ask_help' },
  { id: 'friendship_conflict', coach: 'argument' }, { id: 'excluded', coach: 'include' },
  { id: 'bullying', coach: 'ask_help', adult: true }, { id: 'cyberbullying', coach: 'boundary', adult: true },
  { id: 'family', coach: 'parent' }, { id: 'breakup', coach: 'ask_help' },
  { id: 'comparison', coach: 'ask_help' }, { id: 'confidence', coach: 'ask_help' },
  { id: 'anger', coach: 'apologize' }, { id: 'loneliness', coach: 'include' },
  { id: 'sleep', coach: 'parent' }, { id: 'overwhelmed', coach: 'ask_help' }
];

let open = null;
const answers = {};

export function renderToolkits(container, app) {
  const kit = TOOLKITS.find(k => k.id === open);
  container.innerHTML = kit ? kitView(kit, app) : listView();
  wire(container, app);
}

function listView() {
  return `<header class="page-head">
      <span class="eyebrow">${t('tool.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('tool.title')}</h1>
      <p class="page-sub">${t('tool.subtitle')}</p>
    </header>
    <div class="kit-grid">${TOOLKITS.map((k, i) => `
      <button type="button" class="kit-card kit-tone-${i % 4}" data-kit="${k.id}">
        <strong>${t(`tool.k.${k.id}.title`)}</strong>
        <span>${t(`tool.k.${k.id}.intro`)}</span>
        <span class="kit-open">${t('tool.open')} ${icon('next', 14)}</span>
      </button>`).join('')}</div>`;
}

function kitView(kit, app) {
  const base = `tool.k.${kit.id}`;
  const a = answers[kit.id] || (answers[kit.id] = { q: null, q2: null, can: [], follow: null });
  const options = tList(`${base}.o`);
  const tips = tList(`${base}.tip`);
  return `<button type="button" class="btn btn-ghost btn-sm" data-kit-back>${icon('back', 15)} ${t('tool.back')}</button>
    <header class="page-head mt-2">
      <span class="eyebrow">${t('tool.eyebrow')}</span>
      <h1 class="page-title mt-2">${t(`${base}.title`)}</h1>
      <p class="page-sub">${t(`${base}.intro`)}</p>
    </header>

    <section class="card kit-step" aria-labelledby="kit-q">
      <span class="kit-num" aria-hidden="true">1</span>
      <h2 id="kit-q" class="card-title">${t('tool.questions')}</h2>
      <p class="mt-2">${t(`${base}.q`)}</p>
      <div class="mira-choices mt-2" role="group" aria-label="${escapeHtml(t(`${base}.q`))}">
        ${options.map((o, i) => `<button type="button" class="mira-choice" data-q="${i}" aria-pressed="${a.q === i}">${escapeHtml(o)}</button>`).join('')}
      </div>
      ${a.q !== null ? `<p class="kit-tip mt-3" role="status"><strong>${t('tool.tipFor')}</strong> ${escapeHtml(tips[a.q] || '')}</p>` : ''}
      <p class="mt-4">${t(`${base}.q2`)}</p>
      <div class="tag-wrap mt-2" role="group" aria-label="${escapeHtml(t(`${base}.q2`))}">
        ${tList(`${base}.o2`).map((o, i) => `<button type="button" class="tag tag-sm" data-q2="${i}" aria-pressed="${a.q2 === i}">${escapeHtml(o)}</button>`).join('')}
      </div>
    </section>

    <section class="card kit-step" aria-labelledby="kit-can">
      <span class="kit-num" aria-hidden="true">2</span>
      <h2 id="kit-can" class="card-title">${t('tool.canTitle')}</h2>
      <p class="card-sub">${t('tool.canHint')}</p>
      <ul class="kit-can">${tList(`${base}.can`).map((c, i) => `<li><label><input type="checkbox" data-can="${i}" ${a.can.includes(i) ? 'checked' : ''}> ${escapeHtml(c)}</label></li>`).join('')}</ul>
    </section>

    <section class="card card-accent kit-step" aria-labelledby="kit-act">
      <span class="kit-num" aria-hidden="true">3</span>
      <h2 id="kit-act" class="card-title">${t('tool.actionTitle')}</h2>
      <p class="mira-voice mt-2">${t(`${base}.action`)}</p>
    </section>

    <section class="card kit-step" aria-labelledby="kit-draft">
      <span class="kit-num" aria-hidden="true">4</span>
      <h2 id="kit-draft" class="card-title">${t('tool.draftTitle')}</h2>
      ${coachHtml({ scenario: kit.coach, people: (app.profile.my5 || []).map(p => p.name) })}
    </section>

    <section class="card ${kit.adult ? 'card-signal' : 'card-amber'} kit-step" aria-labelledby="kit-adult">
      <span class="kit-num" aria-hidden="true">5</span>
      <h2 id="kit-adult" class="card-title">${t('tool.adultTitle')}</h2>
      <p class="mt-2">${t(`${base}.adult`)}</p>
      <div class="mira-actions">
        <button type="button" class="btn ${kit.adult ? 'btn-danger' : ''}" data-go="support">${t('tool.toSupport')}</button>
        <button type="button" class="btn btn-ghost" data-go="mira">${t('tool.toMira')}</button>
      </div>
    </section>

    <section class="card card-lav kit-step" aria-labelledby="kit-follow">
      <span class="kit-num" aria-hidden="true">6</span>
      <h2 id="kit-follow" class="card-title">${t('tool.followTitle')}</h2>
      <p class="mt-2">${t(`${base}.follow`)}</p>
      <div class="tag-wrap mt-2" role="group" aria-label="${escapeHtml(t(`${base}.follow`))}">
        ${['followYes', 'followSome', 'followNo'].map(k => `<button type="button" class="tag tag-sm" data-follow="${k}" aria-pressed="${a.follow === k}">${t(`tool.${k}`)}</button>`).join('')}
      </div>
      ${a.follow ? `<p class="card-sub mt-3" role="status">${t('tool.followThanks')}</p>` : ''}
    </section>`;
}

function wire(root, app) {
  const rerender = () => renderToolkits(root, app);
  const a = open && answers[open];
  root.querySelectorAll('[data-kit]').forEach(b => b.addEventListener('click', () => {
    open = b.dataset.kit; rerender();
    const title = root.querySelector('.page-title'); if (title) { title.setAttribute('tabindex', '-1'); title.focus(); }
  }));
  const back = root.querySelector('[data-kit-back]');
  if (back) back.addEventListener('click', () => { open = null; rerender(); });
  root.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { a.q = Number(b.dataset.q); rerender(); }));
  root.querySelectorAll('[data-q2]').forEach(b => b.addEventListener('click', () => { a.q2 = Number(b.dataset.q2); rerender(); }));
  root.querySelectorAll('[data-can]').forEach(box => box.addEventListener('change', () => {
    const i = Number(box.dataset.can);
    a.can = box.checked ? [...a.can, i] : a.can.filter(x => x !== i);
  }));
  root.querySelectorAll('[data-follow]').forEach(b => b.addEventListener('click', () => { a.follow = b.dataset.follow; rerender(); }));
  wireCoach(root);
}

// Lejon ekranet e tjera (p.sh. "Kam nevojë për ndihmë") të hapin direkt një mjet.
export function openToolkit(id) {
  open = TOOLKITS.some(k => k.id === id) ? id : null;
}
