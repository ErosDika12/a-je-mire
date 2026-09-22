import { icon, metricIcon } from '../ui.js';
import { escapeHtml, fmtNum, fmtPct, fmtValue, arrowFor, formatWeekday } from '../format.js';
import { METRICS, METRIC_LABELS, MIN_DAYS, somethingChanged, normalReport, journeyDays } from '../patterns.js';
import { emptyState, weeklySnapshot, snapshotFooter, journeyBar, modePill } from '../components.js';

// "Sot": pamja e parë pas consent-it. Vetëm matje dhe statuse — asnjë interpretim.
export function renderDashboard(container, app) {
  const profile = app.profile;
  const todayEntry = profile.checkins.find(entry => entry.date === app.today) || null;
  const journey = journeyDays(profile.checkins, app.today);
  const changed = somethingChanged(profile.checkins, profile.settings);

  container.innerHTML = `
    ${header(profile, app.today)}
    <div class="g-12 mt-4">
      <section class="card span-7" aria-labelledby="journey-title">${journeyCard(journey, profile)}</section>
      <section class="card card-accent span-5" aria-labelledby="today-title">${todayCard(todayEntry)}</section>
      <section class="card span-7" aria-labelledby="changes-title">${changesCard(changed, profile)}</section>
      <section class="panel span-5" aria-labelledby="snap-title">${snapshotCard(changed, profile)}</section>
    </div>
    <div class="row-between mt-4 small muted">
      <span class="row" style="gap:var(--s2)">${icon('privacy', 16)} Të dhënat rrinë vetëm në këtë pajisje.</span>
      <button type="button" class="btn-link" data-go="privacy">Privatësia ${icon('next', 14)}</button>
    </div>`;

  container.querySelector('[data-tour]').addEventListener('click', () => app.startTour());
}

function header(profile, today) {
  return `<header class="panel texture" style="padding:var(--s6) var(--s5)">
    <div class="row-between" style="align-items:flex-start">
      <div>
        <span class="eyebrow">A JE MIRË? 2036 · ${escapeHtml(formatWeekday(today))}</span>
        <h1 class="page-title mt-2">Sot</h1>
      </div>
      <div class="row">
        ${profile.mode === 'demo' ? modePill(profile) : ''}
        <button type="button" class="btn btn-sm" data-go="data">${icon('database', 15)} Të dhënat e mia</button>
      </div>
    </div>
    <p class="page-sub">Udhëtimi yt 30-ditor dhe matjet më të fundit. Krahasohesh vetëm me veten.</p>
    <button type="button" class="btn btn-sm mt-4" data-tour>${icon('play', 14)} Prezantim i udhëhequr</button>
  </header>`;
}

function journeyCard(journey, profile) {
  return `<h2 class="eyebrow" id="journey-title">Udhëtimi 30-ditor</h2>
    <div class="summary-count">
      <span class="display-num">${journey.done}</span>
      <span class="muted">nga 30 ditë të regjistruara</span>
    </div>
    ${journeyBar(journey)}
    <p class="card-note">My Normal ndërtohet nga ${profile.settings.baselineDays} ditë bazë; krahasimi përdor ${profile.settings.recentDays} ditët e fundit. Ditët pa check-in nuk numërohen si zero — thjesht nuk numërohen.</p>`;
}

function todayCard(entry) {
  if (!entry) {
    return `<h2 class="eyebrow" id="today-title">Check-in i sotëm</h2>
      <p class="big-num mt-3">Sot ende pa check-in</p>
      <p class="muted small mt-2">Gjashtë rrëshqitës. Plotësohet për më pak se 20 sekonda.</p>
      <button type="button" class="btn btn-primary btn-block mt-5" data-go="checkin">${icon('check', 16)} Bëj check-in e sotëm</button>`;
  }
  const values = METRICS.map(metric => `<div class="day-metric">${metricIcon(metric)}<span>${METRIC_LABELS[metric]}</span>
    <b>${fmtValue(entry[metric])}${metric === 'sleep' && Number.isFinite(entry[metric]) ? ' orë' : ''}</b></div>`).join('');
  return `<h2 class="eyebrow" id="today-title">Check-in i sotëm</h2>
    <p class="big-num mt-3">Check-in i sotëm është regjistruar</p>
    <div class="day-metrics">${values}</div>
    <button type="button" class="btn btn-block mt-4" data-go="checkin">${icon('edit', 16)} Përditëso check-in</button>
    <p class="tiny mt-2">Përditësimi e zëvendëson të njëjtën ditë; nuk krijon një ditë të dytë.</p>`;
}

function changesCard(changed, profile) {
  const head = '<h2 class="eyebrow" id="changes-title">Something Changed · ndryshimet e fundit</h2>';
  if (!changed.enough) {
    return head + emptyState('baseline', 'Ende nuk ka të dhëna të mjaftueshme',
      `Krahasimi nis pasi të regjistrohen të paktën ${MIN_DAYS.change} ditë. Deri tani: ${profile.checkins.length}.`,
      { label: 'Bëj check-in', go: 'checkin' });
  }
  if (!changed.signal) {
    return `${head}
      <p class="big-num mt-3">Asnjë ndryshim i kombinuar</p>
      <p class="muted small mt-2">${changed.flagged.length} nga 6 matje kaluan pragun gjatë ${profile.settings.recentDays} ditëve të fundit. Sinjali shfaqet vetëm kur dy ose më shumë e kalojnë njëkohësisht.</p>
      <button type="button" class="btn-link mt-3" data-go="changed">Shiko të gjitha matjet ${icon('next', 14)}</button>`;
  }
  const rows = changed.flagged.slice(0, 2).map(factor => {
    const unit = factor.metric === 'sleep' ? ' orë' : '';
    return `<div class="snap-row is-flagged">
      ${metricIcon(factor.metric, 'signal')}
      <span class="snap-name">${METRIC_LABELS[factor.metric]}</span>
      <span class="snap-flow">${fmtNum(factor.base)}${unit} → ${fmtNum(factor.recent)}${unit}</span>
      <span class="snap-delta"><strong>${arrowFor(factor.pct)} ${fmtPct(factor.pct)}</strong></span>
    </div>`;
  }).join('');
  return `${head}
    <div class="summary-count">
      <span class="display-num">${changed.flagged.length}</span>
      <span class="muted">nga 6 matje kaluan pragun gjatë ${profile.settings.recentDays} ditëve të fundit</span>
    </div>
    <div class="snap mt-4">${rows}</div>
    <button type="button" class="btn-link mt-2" data-go="changed">Shiko të gjitha matjet ${icon('next', 14)}</button>`;
}

function snapshotCard(changed, profile) {
  const head = '<h2 class="eyebrow" id="snap-title">Përmbledhja 7-ditore</h2>';
  if (!changed.enough) {
    return head + emptyState('partial', 'Ende nuk ka të dhëna të mjaftueshme',
      `Përmbledhja plotësohet pasi të regjistrohen të paktën ${MIN_DAYS.change} ditë.`);
  }
  return `${head}
    <div class="mt-4">${weeklySnapshot(normalReport(profile.checkins, profile.settings), true)}</div>
    ${snapshotFooter(profile.settings.recentDays)}
    <button type="button" class="btn-link" data-go="why">Why? Numrat dhe rregulli ${icon('next', 14)}</button>`;
}
