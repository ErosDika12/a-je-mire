// "Java e një adoleshenti në 60 sekonda": prezantim interaktiv me të dhëna sintetike.
// Çdo pamje ka një buton "Provoje" që hap ekranin e vërtetë. Me "reduced motion" nuk kalon vetë.
import { icon } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, tList } from '../i18n/index.js';

const SLIDES = [
  { id: 'mira', go: 'mira', art: 'orb' },
  { id: 'path', go: 'mira', art: 'plan' },
  { id: 'friend', go: 'toolkits', art: 'chat' },
  { id: 'focus', go: 'focus', art: 'ring' },
  { id: 'stars', go: 'constellation', art: 'stars' },
  { id: 'people', go: 'connect', art: 'people' },
  { id: 'community', go: 'community', art: 'circles' },
  { id: 'week', go: 'week', art: 'mosaic' },
  { id: 'support', go: 'support', art: 'shield' }
];
const SECONDS = 6.5;
let index = 0;
let timer = null;
let playing = true;

export function renderDemo60(container, app) {
  clearInterval(timer);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) playing = false;
  const slide = SLIDES[index];
  container.innerHTML = `
    <section class="demo60" aria-roledescription="${escapeHtml(t('d60.carousel'))}" aria-label="${escapeHtml(t('d60.title'))}">
      <header class="demo60-head">
        <span class="eyebrow">${t('d60.eyebrow')}</span>
        <h1 class="page-title mt-2">${t('d60.title')}</h1>
        <p class="pill pill-amber pill-wrap mt-2"><span class="pill-dot"></span>${t('d60.synthetic')}</p>
      </header>
      <div class="demo60-progress" aria-hidden="true">${SLIDES.map((s, i) => `<span class="${i < index ? 'done' : i === index ? 'now' : ''}" style="${i === index && playing ? `--dur:${SECONDS}s` : ''}"></span>`).join('')}</div>
      <article class="demo60-slide demo60-${slide.art}" aria-live="polite">
        <div class="demo60-art" aria-hidden="true">${art(slide.art)}</div>
        <div class="demo60-text">
          <span class="eyebrow">${t('d60.day', { n: Math.min(7, index + 1) })} · ${t(`d60.s.${slide.id}.when`)}</span>
          <h2>${t(`d60.s.${slide.id}.title`)}</h2>
          <p>${t(`d60.s.${slide.id}.text`)}</p>
          <button type="button" class="btn btn-primary mt-3" data-go="${slide.go}">${t('d60.try')} ${icon('next', 14)}</button>
        </div>
      </article>
      <div class="demo60-controls">
        <button type="button" class="btn" data-prev ${index === 0 ? 'disabled' : ''}>${icon('back', 16)} ${t('d60.prev')}</button>
        <button type="button" class="btn" data-toggle>${playing ? t('d60.pause') : t('d60.play')}</button>
        <button type="button" class="btn btn-primary" data-next>${index === SLIDES.length - 1 ? t('d60.again') : t('d60.next')} ${icon('next', 16)}</button>
      </div>
      <p class="card-note">${t('d60.note')}</p>
    </section>`;

  const go = step => { index = (index + step + SLIDES.length) % SLIDES.length; renderDemo60(container, app); };
  container.querySelector('[data-prev]').addEventListener('click', () => go(-1));
  container.querySelector('[data-next]').addEventListener('click', () => go(1));
  container.querySelector('[data-toggle]').addEventListener('click', () => { playing = !playing; renderDemo60(container, app); });
  if (playing) {
    timer = setInterval(() => {
      if (container.closest('[hidden]') || !container.isConnected) { clearInterval(timer); return; }
      if (index === SLIDES.length - 1) { playing = false; clearInterval(timer); renderDemo60(container, app); return; }
      go(1);
    }, SECONDS * 1000);
  }
}

function art(kind) {
  const bubble = (y, text, me) => `<g transform="translate(${me ? 110 : 20},${y})"><rect width="170" height="34" rx="14" class="${me ? 'b-me' : 'b-mira'}"/><text x="12" y="22">${escapeHtml(text)}</text></g>`;
  const lines = tList('d60.art');
  if (kind === 'orb') return `<svg viewBox="0 0 300 220"><circle cx="150" cy="80" r="46" class="a-orb"/>${bubble(140, lines[0], false)}${bubble(180, lines[1], true)}</svg>`;
  if (kind === 'plan') return `<svg viewBox="0 0 300 220">${[0, 1, 2, 3].map(i => `<g transform="translate(24,${20 + i * 48})"><rect width="252" height="38" rx="10" class="a-card"/><circle cx="20" cy="19" r="7" class="a-dot a${i}"/><text x="38" y="24">${escapeHtml(lines[2 + i])}</text></g>`).join('')}</svg>`;
  if (kind === 'chat') return `<svg viewBox="0 0 300 220">${bubble(30, lines[6], true)}${bubble(80, lines[7], false)}${bubble(130, lines[8], true)}</svg>`;
  if (kind === 'ring') return `<svg viewBox="0 0 300 220"><circle cx="150" cy="110" r="70" class="a-ring-bg"/><circle cx="150" cy="110" r="70" class="a-ring" stroke-dasharray="440" stroke-dashoffset="150"/><text x="150" y="120" text-anchor="middle" class="a-big">17:24</text></svg>`;
  if (kind === 'stars') return `<svg viewBox="0 0 300 220"><rect width="300" height="220" rx="18" class="a-sky"/>${[[60, 50], [230, 60], [90, 170], [210, 160], [150, 40], [40, 120], [260, 120], [120, 90], [190, 100]].map(([x, y], i) => `<line x1="150" y1="110" x2="${x}" y2="${y}" class="a-link"/><circle cx="${x}" cy="${y}" r="${3 + (i % 3) * 2}" class="a-star a${i % 4}"/>`).join('')}<circle cx="150" cy="110" r="12" fill="#fff"/></svg>`;
  if (kind === 'people') return `<svg viewBox="0 0 300 220">${['A', 'B', 'D', 'E', 'R'].map((c, i) => `<g transform="translate(${40 + i * 55},90)"><circle r="22" class="a-p a${i % 4}"/><text y="7" text-anchor="middle" class="a-init">${c}</text></g>`).join('')}<text x="150" y="170" text-anchor="middle">${escapeHtml(lines[9])}</text></svg>`;
  if (kind === 'circles') return `<svg viewBox="0 0 300 220">${[[80, 80, 'a0'], [170, 70, 'a1'], [120, 150, 'a2'], [220, 150, 'a3']].map(([x, y, c], i) => `<circle cx="${x}" cy="${y}" r="${46 - i * 4}" class="a-circle ${c}"/>`).join('')}</svg>`;
  if (kind === 'mosaic') return `<svg viewBox="0 0 300 220"><rect x="20" y="20" width="150" height="180" rx="12" class="a-ph a0"/><rect x="180" y="20" width="100" height="85" rx="12" class="a-ph a1"/><rect x="180" y="115" width="100" height="85" rx="12" class="a-ph a2"/></svg>`;
  return `<svg viewBox="0 0 300 220"><path d="M150 30 l70 28 v50 c0 45 -30 70 -70 84 c-40 -14 -70 -39 -70 -84 v-50z" class="a-shield"/><text x="150" y="125" text-anchor="middle" class="a-big">?</text></svg>`;
}
