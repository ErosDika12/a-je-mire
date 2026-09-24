import { icon, mountChartTips } from '../ui.js';
import { metricChart, sparkline, ringProgress } from '../chart.js';
import { movingAvg } from '../stats.js';
import { fmtNum, fmtPct, fmtValue, arrowFor, formatDateLong } from '../format.js';
import {
  METRICS, METRIC_LABELS, METRIC_RANGES, MIN_DAYS,
  baselineProgress, normalReport, metricValues, splitPeriods, baselineStats, timelineDays
} from '../patterns.js';
import { emptyState, sectionHead, dayTimeline, dayDetail, wireTimeline } from '../components.js';
import { t } from '../i18n/index.js';

let chosenMetric = 'mood';
let selectedDate = null;
let resizeWatcher = null;

export function renderNormal(container, app) {
  const profile = app.profile;
  if (resizeWatcher) { resizeWatcher.disconnect(); resizeWatcher = null; }

  if (profile.checkins.length < 3) {
    container.innerHTML = `${head(profile)}<section class="card">${emptyState('calendar',
      t('normal.notEnough'), t('normal.needThree'),
      { label: t('normal.doCheckin'), go: 'checkin' })}</section>`;
    return;
  }

  const progress = baselineProgress(profile.checkins, profile.settings);
  const { baseline } = splitPeriods(profile.checkins, profile.settings);

  container.innerHTML = `
    ${head(profile)}
    ${progress.full ? '' : progressCard(progress)}
    <section class="card" aria-labelledby="six-title">
      ${sectionHead(t('normal.sixEyebrow'), t('normal.sixTitle'), t('normal.sixMeta', { n: baseline.length }), '', 'six-title')}
      ${baseline.length === 0
        ? emptyState('baseline', t('normal.noBaseline'), t('normal.noBaselineText'))
        : `<div class="stat-grid">${normalReport(profile.checkins, profile.settings).map(factor => statBox(factor, profile)).join('')}</div>`}
    </section>

    <section class="card mt-4" aria-labelledby="chart-title">
      <span class="eyebrow">${t('normal.chartEyebrow')}</span>
      <h2 class="card-title" id="chart-title">${t('normal.chartTitle', { label: METRIC_LABELS[chosenMetric], n: profile.checkins.length })}</h2>
      <div class="seg-control mt-4" id="metric-picker" role="group" aria-label="${t('normal.pickMetric')}">
        ${METRICS.map(metric => `<button type="button" aria-pressed="${metric === chosenMetric}" data-metric="${metric}">${icon(metric, 16)}<span>${METRIC_LABELS[metric]}</span></button>`).join('')}
      </div>
      <div id="chart-host" class="mt-4"></div>
      ${legend(profile)}
      <p class="chart-summary" id="chart-summary"></p>
    </section>

    <section class="card mt-4" aria-labelledby="timeline-title">
      ${sectionHead(t('normal.timelineEyebrow'), t('normal.timelineTitle'), t('normal.timelineHint'), '', 'timeline-title')}
      ${dayLegend()}
      <div id="timeline-host" class="mt-3"></div>
    </section>

    <section class="panel mt-4" aria-labelledby="meaning-title">
      <span class="eyebrow">${t('normal.howEyebrow')}</span>
      <h2 class="card-title" id="meaning-title">${t('normal.howTitle')}</h2>
      <p class="muted small mt-2">${t('normal.howText', { n: profile.settings.baselineDays })}</p>
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
    <span class="eyebrow">${t('normal.eyebrow')}</span>
    <h1 class="page-title mt-2">${t('normal.title')}</h1>
    <p class="page-sub">${t('normal.subtitle', { n: profile.checkins.length })}</p>
  </header>`;
}

function progressCard(progress) {
  return `<section class="card card-accent" style="margin-bottom:var(--s4)">
    <div class="row" style="gap:var(--s5)">
      ${ringProgress(progress.ratio, `${progress.have}/${progress.need}`, t('normal.days'))}
      <div style="flex:1;min-width:190px">
        <span class="eyebrow">${t('normal.buildingEyebrow')}</span>
        <p class="muted small mt-2">${progress.ready
          ? t('normal.buildingActive', { n: progress.need - progress.have })
          : t('normal.buildingWait', { n: MIN_DAYS.change })}</p>
      </div>
    </div>
  </section>`;
}

function statBox(factor, profile) {
  const unit = factor.metric === 'sleep' ? t('core.hours') : '1–10';
  return `<div class="stat">
    <span class="stat-label">${icon(factor.metric, 15)} ${METRIC_LABELS[factor.metric]}</span>
    <div class="stat-value">${fmtNum(factor.base)}<span class="stat-unit">${unit}</span></div>
    <div class="stat-spark">${sparkline(metricValues(profile.checkins, factor.metric), { color: factor.flagged ? 'var(--signal)' : 'var(--cyan)' })}</div>
    <div class="stat-foot">${t('normal.now')} ${fmtNum(factor.recent)} · ${arrowFor(factor.pct)} ${fmtPct(factor.pct)}</div>
    <div class="stat-foot">${factor.baselineDays} + ${factor.recentDays} ${t('normal.days')}</div>
  </div>`;
}

function legend(profile) {
  return `<div class="legend" aria-hidden="true">
    <span style="color:var(--cyan)"><i class="l-line"></i>${t('normal.lgDaily')}</span>
    <span style="color:var(--lavender)"><i class="l-dash"></i>${t('normal.lgAvg')}</span>
    <span><i class="l-band"></i>${t('normal.lgBand')}</span>
    <span style="color:var(--accent)"><i class="l-line"></i>${t('normal.lgBase')}</span>
    <span style="color:var(--signal)"><i class="l-band" style="background:var(--signal-soft)"></i>${t('normal.lgRecent', { n: profile.settings.recentDays })}</span>
  </div>`;
}

function dayLegend() {
  return `<div class="legend" aria-hidden="true">
    <span><i class="l-base"></i>${t('normal.lgBaseline')}</span>
    <span><i class="l-recent"></i>${t('normal.lgLast7')}</span>
    <span><i class="l-missing"></i>${t('normal.lgMissing')}</span>
    <span>● ${t('normal.lgToday')}</span>
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
    yTitle: chosenMetric === 'sleep' ? t('core.sleepHours') : `${label} (1–10)`,
    metricLabel: label,
    unit: chosenMetric === 'sleep' ? ` ${t('core.hoursShort')}` : '',
    alt: t('normal.chartAlt', { label, n: checkins.length }),
    summaryId: 'chart-summary'
  });
  container.querySelector('#chart-title').textContent = t('normal.chartTitle', { label, n: checkins.length });
  container.querySelector('#chart-summary').textContent = chartSummary(checkins, values, averages, stats, recent, label);
  mountChartTips(host);
}

function chartSummary(checkins, values, averages, stats, recent, label) {
  const unit = chosenMetric === 'sleep' ? ` ${t('core.hoursShort')}` : '';
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
  const parts = [t('normal.sumIntro', { label })];
  parts.push(Number.isFinite(stats.mean)
    ? t('normal.sumNormal', { mean: fmtNum(stats.mean), unit, std: fmtNum(stats.std), n: stats.n })
    : t('normal.sumNoNormal'));
  parts.push(t('normal.sumRecent', { n: recent.length, value: fmtNum(recentMean), unit }));
  parts.push(Number.isFinite(latestAverage) ? t('normal.sumAvg', { value: fmtNum(latestAverage), unit }) : t('normal.sumNoAvg'));
  if (low && high) parts.push(t('normal.sumRange', { low: fmtValue(low.value), unit, lowDate: formatDateLong(low.date), high: fmtValue(high.value), highDate: formatDateLong(high.date) }));
  return parts.join(' ');
}

function drawTimeline(container, app) {
  const host = container.querySelector('#timeline-host');
  if (!host) return;
  const days = timelineDays(app.profile.checkins, app.today, app.profile.settings);
  const selected = days.find(day => day.date === selectedDate) || null;
  host.innerHTML = `${dayTimeline(days, selected ? selected.date : null)}
    ${selected ? dayDetail(selected) : `<p class="tiny mt-3">${t('normal.noDay')}</p>`}`;
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
