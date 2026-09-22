import { icon, metricIcon } from '../ui.js';
import { escapeHtml, fmtNum, fmtSigned, fmtPct, arrowFor, formatRange } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, somethingChanged, splitPeriods } from '../patterns.js';
import { emptyState, modePill } from '../components.js';

// Fjalia qendrore e projektit. Nuk ndryshohet.
const CENTRAL_SENTENCE = 'Krahasuar me 30 ditët e tua — jo me askënd tjetër';

export function renderChanged(container, app) {
  const profile = app.profile;
  const result = somethingChanged(profile.checkins, profile.settings);

  if (!result.enough) {
    container.innerHTML = `${head()}
      <section class="card">${emptyState('baseline', 'Ende nuk ka të dhëna të mjaftueshme',
        `Krahasimi kërkon të paktën ${MIN_DAYS.change} ditë check-in. Deri tani: ${profile.checkins.length}.`,
        { label: 'Bëj check-in', go: 'checkin' })}</section>`;
    return;
  }

  const periods = splitPeriods(profile.checkins, profile.settings);
  container.innerHTML = `
    ${head()}
    ${summaryPanel(result, periods, profile)}
    ${result.signal ? factorGrid(result.flagged) : calmCard(result, profile)}
    <div class="row mt-5">
      <button type="button" class="btn" data-go="why">${icon('why', 16)} Why? Numrat dhe rregulli</button>
      <button type="button" class="btn" data-go="patterns">${icon('patterns', 16)} Patterns</button>
    </div>
    <p class="card-note">Kjo faqe raporton vetëm sa lëvizën numrat e tu. Nuk vendos etiketa, nuk jep nivel rreziku dhe nuk krahason me askënd.</p>`;
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">Krahasimi me veten</span>
    <h1 class="page-title mt-2">Something Changed</h1>
  </header>`;
}

function summaryPanel(result, periods, profile) {
  const { baseline, recent } = periods;
  const count = result.flagged.length;
  const sentence = result.signal
    ? `nga 6 matje ndryshuan më shumë se zakonisht gjatë ${recent.length} ditëve të fundit.`
    : `nga 6 matje kaluan pragun. Nuk u identifikua ndryshim i kombinuar.`;
  return `<section class="summary-panel texture" aria-labelledby="summary-title">
    <div class="row-between" style="align-items:flex-start">
      <h2 class="eyebrow" id="summary-title">Përmbledhja e krahasimit</h2>
      ${profile.mode === 'demo' ? modePill(profile) : ''}
    </div>
    <div class="summary-count">
      <span class="display-num">${count}</span>
      <span class="summary-sentence" style="margin-top:0">${sentence}</span>
    </div>
    <p class="quote-line">${CENTRAL_SENTENCE}</p>
    <dl class="measure-list mt-4" style="max-width:520px">
      <div><dt>Normalja (baseline)</dt><dd>${escapeHtml(formatRange(baseline[0].date, baseline[baseline.length - 1].date))} · ${baseline.length} ditë</dd></div>
      <div><dt>Periudha e fundit</dt><dd>${escapeHtml(formatRange(recent[0].date, recent[recent.length - 1].date))} · ${recent.length} ditë</dd></div>
    </dl>
  </section>`;
}

function factorGrid(flagged) {
  // Renditja sipas madhësisë absolute të përqindjes vjen gati nga somethingChanged().
  const largest = Math.max(...flagged.map(factor => Math.abs(factor.pct)));
  return `<h2 class="sr-only">Faktorët që ndryshuan</h2>
    <div class="grid factor-grid mt-4">${flagged.map(factor => factorCard(factor, largest)).join('')}</div>`;
}

function factorCard(factor, largest) {
  const label = METRIC_LABELS[factor.metric];
  const unit = factor.metric === 'sleep' ? ' orë' : '';
  const width = (Math.abs(factor.pct) / largest * 100).toFixed(1);
  const went = factor.pct < 0 ? 'ra' : 'u rrit';
  return `<article class="factor-card" aria-label="${escapeHtml(`${label}: ${fmtPct(factor.pct)}`)}">
    <div class="factor-top">
      ${metricIcon(factor.metric, 'signal')}
      <h3 class="factor-name">${label}</h3>
      <span class="pill">${arrowFor(factor.pct)} ${went}</span>
    </div>
    <div class="factor-pct mt-3">${fmtPct(factor.pct)}</div>
    <p class="factor-flow">Normalja ${fmtNum(factor.base)}${unit} → 7 ditët e fundit ${fmtNum(factor.recent)}${unit}</p>
    <div class="bar" role="img" aria-label="${escapeHtml(`Madhësia e ndryshimit krahasuar me faktorin më të madh: ${Math.round(width)}%`)}"><i style="width:${width}%"></i></div>
    <details class="collapse">
      <summary>Shiko matjet</summary>
      <div class="collapse-body">
        <dl class="measure-list">
          <div><dt>Normalja · ${factor.baselineDays} ditë</dt><dd>${fmtNum(factor.base)}${unit}</dd></div>
          <div><dt>7 ditët e fundit · ${factor.recentDays} ditë</dt><dd>${fmtNum(factor.recent)}${unit}</dd></div>
          <div><dt>Dallimi</dt><dd>${fmtSigned(factor.delta)}${unit}</dd></div>
          <div><dt>Ndryshimi</dt><dd>${fmtPct(factor.pct)}</dd></div>
          <div><dt>z-score</dt><dd>${fmtSigned(factor.z, 2)}</dd></div>
        </dl>
        <p class="tiny mt-3">Metoda: ndryshimi = (mesatarja e 7 ditëve − normalja) ÷ normalja × 100.
          z = (mesatarja e 7 ditëve − normalja) ÷ devijimi standard i normales.
          Një matje shënohet kur lëviz në drejtimin që ndiqet dhe ndryshimi është të paktën 15% ose z të paktën 1.5.</p>
      </div>
    </details>
  </article>`;
}

function calmCard(result, profile) {
  return `<section class="card mt-4">
    ${emptyState('calm', 'Asnjë ndryshim i kombinuar i matshëm',
      `Matjet qëndruan afër normales sate gjatë ${profile.settings.recentDays} ditëve të fundit. Sinjali shfaqet vetëm kur dy ose më shumë matje e kalojnë pragun njëkohësisht; një e vetme trajtohet si zhurmë.`,
      { label: 'Shiko të gjitha numrat', go: 'why' })}
  </section>`;
}
