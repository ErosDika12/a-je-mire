import { icon } from './ui.js';
import { escapeHtml } from './chart.js';

// Prezantimi i udhëhequr: shtatë ndalesa, dy deri tre minuta.
const STEPS = [
  { screen: 'data',    title: 'Profili sintetik',   note: '30 ditë të gjeneruara nga kodi. Asnjë e dhënë e një personi të vërtetë.' },
  { screen: 'normal',  title: 'My Normal',          note: 'Mesatarja jote nga 23 ditët bazë. Pika e krahasimit, jo një normë e përgjithshme.' },
  { screen: 'changed', title: 'Something Changed',  note: 'Katër nga gjashtë matjet lëvizën më shumë se zakonisht gjatë shtatë ditëve të fundit.' },
  { screen: 'why',     title: 'Why?',               note: 'Cilat matje lëvizën bashkë. Shoqërim në të dhënat e tua, jo shkak.' },
  { screen: 'helps',   title: 'What Helps Me?',     note: 'Aktivitetet e renditura sipas ditëve reale pas tyre, jo sipas sugjerimeve të përgjithshme.' },
  { screen: 'kafe',    title: 'KAFE?',              note: 'Një hap i vogël social. Sistemi përgatit draftin; dërgimin e bën vetë njeriu.' },
  { screen: 'wall',    title: 'Connection Wall',    note: 'Njerëzit e zgjedhur vetë, pa pikë dhe pa renditje sipas rëndësisë.' }
];

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
  host.innerHTML = `<div class="tour-bar" id="tour-bar" role="region" aria-label="Prezantim i udhëhequr">
    <div class="tour-text">
      <p class="tour-step">Hapi ${index + 1} nga ${STEPS.length} · ${escapeHtml(step.title)}</p>
      <p class="tour-note">${escapeHtml(step.note)}</p>
      <div class="tour-dots" aria-hidden="true">
        ${STEPS.map((item, position) => `<i class="${position <= index ? 'is-on' : ''}"></i>`).join('')}
      </div>
    </div>
    <div class="tour-nav">
      <button type="button" class="icon-btn" data-prev ${index === 0 ? 'disabled' : ''} aria-label="Hapi i mëparshëm">${icon('back', 18)}</button>
      <button type="button" class="icon-btn" data-next aria-label="${index === STEPS.length - 1 ? 'Mbyll prezantimin' : 'Hapi tjetër'}">
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
