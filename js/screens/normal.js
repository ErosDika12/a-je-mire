import { icon, mountChartTips } from '../ui.js';
import { metricChart, sparkline, ringProgress } from '../chart.js';
import { movingAvg } from '../stats.js';
import { fmtNum, fmtPct, fmtValue, arrowFor, formatDateLong } from '../format.js';
import {
  METRICS, METRIC_LABELS, METRIC_RANGES, MIN_DAYS,
  baselineProgress, normalReport, metricValues, splitPeriods, baselineStats, timelineDays
} from '../patterns.js';
import { emptyState, sectionHead, dayTimeline, dayDetail, wireTimeline } from '../components.js';

let chosenMetric = 'mood';
let selectedDate = null;
let resizeWatcher = null;

export function renderNormal(container, app) {
  const profile = app.profile;
  if (resizeWatcher) { resizeWatcher.disconnect(); resizeWatcher = null; }

  if (profile.checkins.length < 3) {
    container.innerHTML = `${head(profile)}<section class="card">${emptyState('calendar',
      'Ende nuk ka të dhëna të mjaftueshme',
      'My Normal ndërtohet vetëm nga check-ins e tua. Numrat e parë shfaqen pas 3 ditësh.',
      { label: 'Bëj check-in e sotëm', go: 'checkin' })}</section>`;
    return;
  }

  const progress = baselineProgress(profile.checkins, profile.settings);
  const { baseline } = splitPeriods(profile.checkins, profile.settings);

  container.innerHTML = `
    ${head(profile)}
    ${progress.full ? '' : progressCard(progress)}
    <section class="card" aria-labelledby="six-title">
      ${sectionHead('Gjashtë numrat', 'Normalja jote dhe 7 ditët e fundit', `Baseline nga ${baseline.length} ditë`, '', 'six-title')}
      ${baseline.length === 0
        ? emptyState('baseline', 'Baseline-i ende nuk ekziston', 'Baseline-i formohet nga ditët para 7 ditëve të fundit. Shfaqet pasi të kesh më shumë se 7 check-ins.')
        : `<div class="stat-grid">${normalReport(profile.checkins, profile.settings).map(factor => statBox(factor, profile)).join('')}</div>`}
    </section>

    <section class="card mt-4" aria-labelledby="chart-title">
      <span class="eyebrow">Linja kohore e një matjeje</span>
      <h2 class="card-title" id="chart-title">${METRIC_LABELS[chosenMetric]} gjatë ${profile.checkins.length} ditëve</h2>
      <div class="seg-control mt-4" id="metric-picker" role="group" aria-label="Zgjidh matjen që shfaqet">
        ${METRICS.map(metric => `<button type="button" aria-pressed="${metric === chosenMetric}" data-metric="${metric}">${icon(metric, 16)}<span>${METRIC_LABELS[metric]}</span></button>`).join('')}
      </div>
      <div id="chart-host" class="mt-4"></div>
      ${legend(profile)}
      <p class="chart-summary" id="chart-summary"></p>
    </section>

    <section class="card mt-4" aria-labelledby="timeline-title">
      ${sectionHead('30 ditët e fundit', 'Një ditë, një katror', 'Zgjidh një ditë për të parë matjet, aktivitetet dhe shënimin e saj.', '', 'timeline-title')}
      ${dayLegend()}
      <div id="timeline-host" class="mt-3"></div>
    </section>

    <section class="panel mt-4" aria-labelledby="meaning-title">
      <span class="eyebrow">Si funksionon?</span>
      <h2 class="card-title" id="meaning-title">Çfarë do të thotë "normale" këtu</h2>
      <p class="muted small mt-2">My Normal është mesatarja jote e ${profile.settings.baselineDays} ditëve para periudhës së fundit.
        Nuk është përkufizim mjekësor, nuk është mesatare e njerëzve të tjerë dhe nuk është objektiv. Është vetëm një pikë krahasimi që e prodhojnë të dhënat e tua.</p>
    </section>`;

  drawChart(container, app);
  drawTimeline(container, app);
  wirePicker(container, app);

  // Grafiku vizatohet me gjerësinë e vërtetë të kontejnerit, që teksti të mbetet i qartë.
  if ('ResizeObserver' in window) {
    let lastWidth = container.querySelector('#chart-host').clientWidth;
    resizeWatcher = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (Math.abs(width - lastWidth) > 8) { lastWidth = width; drawChart(container, app); }
    });
    resizeWatcher.observe(container.querySelector('#chart-host'));
  }
}

function head(profile) {
  return `<header class="page-head">
    <span class="eyebrow">Normalja</span>
    <h1 class="page-title mt-2">My Normal</h1>
    <p class="page-sub">Patterni yt i zakonshëm, i llogaritur nga ${profile.checkins.length} ditët e tua.</p>
  </header>`;
}

function progressCard(progress) {
  return `<section class="card card-accent" style="margin-bottom:var(--s4)">
    <div class="row" style="gap:var(--s5)">
      ${ringProgress(progress.ratio, `${progress.have}/${progress.need}`, 'ditë')}
      <div style="flex:1;min-width:190px">
        <span class="eyebrow">Baseline-i po ndërtohet</span>
        <p class="muted small mt-2">${progress.ready
          ? `Krahasimet janë aktive. Edhe ${progress.need - progress.have} ditë e bëjnë baseline-in të plotë.`
          : `Krahasimet nisin pas ${MIN_DAYS.change} ditësh. Deri atëherë nuk nxirret asnjë përfundim.`}</p>
      </div>
    </div>
  </section>`;
}

function statBox(factor, profile) {
  const unit = factor.metric === 'sleep' ? 'orë' : '1–10';
  return `<div class="stat">
    <span class="stat-label">${icon(factor.metric, 15)} ${METRIC_LABELS[factor.metric]}</span>
    <div class="stat-value">${fmtNum(factor.base)}<span class="stat-unit">${unit}</span></div>
    <div class="stat-spark">${sparkline(metricValues(profile.checkins, factor.metric), { color: factor.flagged ? 'var(--signal)' : 'var(--cyan)' })}</div>
    <div class="stat-foot">tani ${fmtNum(factor.recent)} · ${arrowFor(factor.pct)} ${fmtPct(factor.pct)}</div>
    <div class="stat-foot">${factor.baselineDays} + ${factor.recentDays} ditë</div>
  </div>`;
}

function legend(profile) {
  return `<div class="legend" aria-hidden="true">
    <span style="color:var(--cyan)"><i class="l-line"></i>vlera ditore</span>
    <span style="color:var(--lavender)"><i class="l-dash"></i>mesatarja lëvizëse 7-ditore</span>
    <span><i class="l-band"></i>brezi i normales (± devijimi)</span>
    <span style="color:var(--accent)"><i class="l-line"></i>mesatarja e baseline-it</span>
    <span style="color:var(--signal)"><i class="l-band" style="background:var(--signal-soft)"></i>${profile.settings.recentDays} ditët e fundit</span>
  </div>`;
}

function dayLegend() {
  return `<div class="legend" aria-hidden="true">
    <span><i class="l-base"></i>baseline</span>
    <span><i class="l-recent"></i>7 ditët e fundit</span>
    <span><i class="l-missing"></i>pa check-in</span>
    <span>● sot</span>
  </div>`;
}

function drawChart(container, app) {
  const host = container.querySelector('#chart-host');
  if (!host) return;
  const profile = app.profile;
  const checkins = profile.checkins;
  const { baseline, recent } = splitPeriods(checkins, profile.settings);
  const values = metricValues(checkins, chosenMetric);
  const averages = movingAvg(values, 7);
  const stats = baselineStats(checkins, profile.settings, chosenMetric);
  const label = METRIC_LABELS[chosenMetric];

  host.innerHTML = metricChart({
    width: host.clientWidth || 320,
    values,
    averages,
    dates: checkins.map(entry => entry.date),
    recentCount: baseline.length > 0 ? recent.length : 0,
    baseMean: stats.mean,
    baseStd: stats.std,
    range: METRIC_RANGES[chosenMetric],
    yTitle: chosenMetric === 'sleep' ? 'Orë gjumi' : `${label} (1–10)`,
    metricLabel: label,
    unit: chosenMetric === 'sleep' ? ' orë' : '',
    alt: `${label} gjatë ${checkins.length} ditëve të regjistruara`,
    summaryId: 'chart-summary'
  });
  container.querySelector('#chart-title').textContent = `${label} gjatë ${checkins.length} ditëve`;
  container.querySelector('#chart-summary').textContent = chartSummary(checkins, values, averages, stats, recent, label);
  mountChartTips(host);
}

function chartSummary(checkins, values, averages, stats, recent, label) {
  const unit = chosenMetric === 'sleep' ? ' orë' : '';
  const recentValues = metricValues(recent, chosenMetric).filter(Number.isFinite);
  const recentMean = recentValues.length ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length : null;
  let low = null;
  let high = null;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    if (!low || value < low.value) low = { value, date: checkins[index].date };
    if (!high || value > high.value) high = { value, date: checkins[index].date };
  });
  const latestAverage = [...averages].reverse().find(Number.isFinite);
  const parts = [`Përmbledhje me tekst: ${label}.`];
  parts.push(Number.isFinite(stats.mean)
    ? `Normalja ${fmtNum(stats.mean)}${unit} (± ${fmtNum(stats.std)}), nga ${stats.n} ditë.`
    : 'Normalja ende nuk ekziston.');
  parts.push(`${recent.length} ditët e fundit: ${fmtNum(recentMean)}${unit}.`);
  parts.push(Number.isFinite(latestAverage) ? `Mesatarja lëvizëse 7-ditore më e fundit: ${fmtNum(latestAverage)}${unit}.` : 'Mesatarja lëvizëse kërkon të paktën 7 ditë.');
  if (low && high) parts.push(`Më e ulëta ${fmtValue(low.value)}${unit} më ${formatDateLong(low.date)}; më e larta ${fmtValue(high.value)}${unit} më ${formatDateLong(high.date)}.`);
  return parts.join(' ');
}

function drawTimeline(container, app) {
  const host = container.querySelector('#timeline-host');
  if (!host) return;
  const days = timelineDays(app.profile.checkins, app.today, app.profile.settings);
  const selected = days.find(day => day.date === selectedDate) || null;
  host.innerHTML = `${dayTimeline(days, selected ? selected.date : null)}
    ${selected ? dayDetail(selected) : '<p class="tiny mt-3">Asnjë ditë e zgjedhur. Shënimet shfaqen vetëm pasi zgjidhet një ditë.</p>'}`;
  wireTimeline(host, date => {
    selectedDate = selectedDate === date ? null : date;
    drawTimeline(container, app);
    const again = host.querySelector(`.day[data-date="${date}"]`);
    if (again) again.focus();
  });
}

function wirePicker(container, app) {
  const picker = container.querySelector('#metric-picker');
  picker.addEventListener('click', event => {
    const button = event.target.closest('[data-metric]');
    if (!button || button.dataset.metric === chosenMetric) return;
    chosenMetric = button.dataset.metric;
    for (const item of picker.querySelectorAll('[data-metric]')) {
      item.setAttribute('aria-pressed', String(item.dataset.metric === chosenMetric));
    }
    drawChart(container, app);
  });
}

export function resetNormalView() {
  selectedDate = null;
  if (resizeWatcher) { resizeWatcher.disconnect(); resizeWatcher = null; }
}
