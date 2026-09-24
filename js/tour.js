import { icon } from './ui.js';
import { escapeHtml } from './format.js';
import { t } from './i18n/index.js';

// Prezantimi i udhëhequr: tetë ndalesa, dy deri tre minuta. Tekstet janë te comp.tour.<ekrani>.
const STEPS = ['data', 'normal', 'changed', 'why', 'helps', 'kafe', 'wall', 'privacy'].map(screen => ({
  screen,
  get title() { return t(`comp.tour.${screen}.title`); },
  get note() { return t(`comp.tour.${screen}.note`); }
}));

let index = 0;
let active = false;
let appRef = null;

export function isTourActive() {
  return active;
}

export function startTour(app) {
  appRef = app;
  index = 0;
  active = true;
  go();
}

export function stopTour() {
  active = false;
  const bar = document.getElementById('tour-bar');
  if (bar) bar.remove();
}

function go() {
  if (!active) return;
  appRef.goTo(STEPS[index].screen);
  draw();
}

export function drawTourBar() {
  if (active) draw();
}

function draw() {
  const host = document.getElementById('tour-host');
  if (!host) return;
  const step = STEPS[index];
  host.innerHTML = `<div class="tour-bar" id="tour-bar" role="region" aria-label="${t('comp.tourLabel')}">
    <div class="tour-text">
      <p class="tour-step">${escapeHtml(t('comp.tourStep', { n: index + 1, total: STEPS.length, title: step.title }))}</p>
      <p class="tour-note">${escapeHtml(step.note)}</p>
      <div class="tour-dots" aria-hidden="true">
        ${STEPS.map((item, position) => `<i class="${position <= index ? 'is-on' : ''}"></i>`).join('')}
      </div>
    </div>
    <div class="tour-nav">
      <button type="button" class="icon-btn" data-prev ${index === 0 ? 'disabled' : ''} aria-label="${t('comp.tourPrev')}">${icon('back', 18)}</button>
      <button type="button" class="icon-btn" data-next aria-label="${index === STEPS.length - 1 ? t('comp.tourClose') : t('comp.tourNext')}">
        ${index === STEPS.length - 1 ? icon('close', 18) : icon('next', 18)}
      </button>
    </div>
  </div>`;

  host.querySelector('[data-prev]').addEventListener('click', () => {
    if (index > 0) { index -= 1; go(); }
  });
  host.querySelector('[data-next]').addEventListener('click', () => {
    if (index === STEPS.length - 1) { stopTour(); return; }
    index += 1;
    go();
  });
}
