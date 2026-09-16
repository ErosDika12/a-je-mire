import { icon, mountChartTips } from '../ui.js';
import { trendChart, sparkline, ringProgress, escapeHtml } from '../chart.js';
import { round } from '../stats.js';
import {
  METRICS, METRIC_LABELS, METRIC_UNITS, MIN_DAYS,
  baselineProgress, normalReport, metricValues, splitPeriods
} from '../patterns.js';
import { emptyBlock } from './dashboard.js';

let chosenMetric = 'mood';

export function renderNormal(container, app) {
  const profile = app.profile;
  const progress = baselineProgress(profile.checkins, profile.settings);

  if (profile.checkins.length < 3) {
    container.innerHTML = `${head(profile)}<section class="card">${emptyBlock('pulse', 'Baseline-i nuk ka nisur ende',
      'Pas tre check-ins fillojnë të shfaqen numrat e tu. Asnjë përfundim nuk nxirret para kësaj.')}
      <div class="row" style="justify-content:center"><button type="button" class="btn btn-primary" data-go="checkin">${icon('check', 16)} Bëj check-in</button></div>
    </section>`;
    wire(container, app);
    return;
  }

  const report = normalReport(profile.checkins, profile.settings);
  const { baseline, recent } = splitPeriods(profile.checkins, profile.settings);

  container.innerHTML = `
    ${head(profile)}
    ${progress.full ? '' : progressCard(progress)}
    <section class="card">
      <div class="card-head"><div>
        <h2 class="card-title">Gjashtë numrat e tu</h2>
        <p class="card-sub">Baseline ${baseline.length} ditë · krahasim ${recent.length} ditë</p>
      </div></div>
      <div class="stat-grid">${report.map(factor => statBox(factor, profile)).join('')}</div>
      <p class="card-note">Kolona e madhe është mesatarja jote bazë. Poshtë saj është mesatarja e ditëve të fundit dhe sa lëvizi.</p>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Linja kohore ${profile.checkins.length}-ditore</h2>
        <p class="card-sub">Vija e ndërprerë është normalja jote; ngjyra e dytë janë ${profile.settings.recentDays} ditët e fundit</p>
      </div></div>
      <div class="tag-wrap" id="metric-picker" role="group" aria-label="Zgjidh matjen">
        ${METRICS.map(metric => `<button type="button" class="tag" aria-pressed="${metric === chosenMetric}" data-metric="${metric}">${METRIC_LABELS[metric]}</button>`).join('')}
      </div>
      <div id="timeline" style="margin-top:var(--s4)"></div>
    </section>

    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="card-head"><span class="fact-ic">${icon('info', 18)}</span><div>
        <h2 class="card-title">Çfarë do të thotë "normale" këtu</h2>
      </div></div>
      <p style="color:var(--text-2);font-size:var(--fs-sm)">
        "My Normal" është thjesht mesatarja jote e ${profile.settings.baselineDays} ditëve përpara periudhës së fundit.
        Nuk është përkufizim mjekësor, nuk është mesatare e njerëzve të tjerë dhe nuk është objektiv që duhet arritur.
        Është një pikë krahasimi që e prodhojnë vetëm të dhënat e tua.
      </p>
    </section>`;

  drawTimeline(container, app);
  wire(container, app);
}

function head(profile) {
  return `<header class="page-head">
    <h1 class="page-title">My Normal</h1>
    <p class="page-sub">Patterni yt i zakonshëm, i llogaritur nga ${profile.checkins.length} ditët e tua.</p>
  </header>`;
}

function progressCard(progress) {
  const left = Math.max(0, progress.need - progress.have);
  return `<section class="card" style="margin-bottom:var(--s4)">
    <div class="row" style="gap:var(--s5)">
      ${ringProgress(progress.ratio, `${progress.have}/${progress.need}`, 'ditë')}
      <div style="flex:1;min-width:180px">
        <h2 class="card-title">Baseline-i po ndërtohet</h2>
        <p style="margin-top:var(--s2);color:var(--text-2);font-size:var(--fs-sm)">
          ${progress.ready
            ? `Krahasimet janë aktive, por edhe ${left} ditë do ta bëjnë baseline-in më të qëndrueshëm.`
            : `Duhen edhe ${Math.max(0, MIN_DAYS.change - progress.have)} ditë para se të fillojnë krahasimet. Deri atëherë nuk nxirret asnjë përfundim.`}
        </p>
        <div class="progress" style="margin-top:var(--s3)"><div class="progress-bar" style="width:${(progress.ratio * 100).toFixed(0)}%"></div></div>
      </div>
    </div>
  </section>`;
}

function statBox(factor, profile) {
  const values = metricValues(profile.checkins, factor.metric);
  const pct = factor.pct === null ? null : Math.round(factor.pct);
  const flat = pct === null || Math.abs(pct) < 1;
  const arrow = pct === null ? '' : pct < 0 ? '↓' : '↑';
  // Ngjyra e sinjalit përdoret vetëm për matjet e shënuara. Një lëvizje nën prag
  // mbetet neutrale, që asgjë të mos duket më alarmante nga sa është.
  const tone = factor.flagged ? 'delta-worse' : flat || factor.movedWorse ? 'delta-flat' : 'delta-better';

  return `<div class="stat">
    <span class="stat-label">${METRIC_LABELS[factor.metric]}
      ${factor.flagged ? '<span class="pill-dot" style="background:var(--signal)"></span>' : ''}</span>
    <div class="stat-value">${round(factor.base, 1) ?? '—'}<span class="stat-unit">${METRIC_UNITS[factor.metric]}</span></div>
    <div class="stat-spark">${sparkline(values, { color: factor.flagged ? 'var(--coral)' : 'var(--cyan)' })}</div>
    <div class="stat-foot">
      tani ${round(factor.recent, 1) ?? '—'} ·
      <span class="delta ${tone}">${arrow} ${pct === null ? '—' : Math.abs(pct) + '%'}</span>
    </div>
    <div class="stat-foot">${factor.baselineDays} + ${factor.recentDays} ditë</div>
  </div>`;
}

function drawTimeline(container, app) {
  const host = container.querySelector('#timeline');
  if (!host) return;
  const profile = app.profile;
  const report = normalReport(profile.checkins, profile.settings);
  const factor = report.find(item => item.metric === chosenMetric);
  const values = metricValues(profile.checkins, chosenMetric);

  host.innerHTML = `${trendChart({
    values,
    dates: profile.checkins.map(entry => entry.date),
    recentCount: Math.min(profile.settings.recentDays, Math.max(1, profile.checkins.length - 1)),
    baseline: factor.base,
    unit: chosenMetric === 'sleep' ? 'orë' : '',
    height: 190,
    alt: `${METRIC_LABELS[chosenMetric]} gjatë ${profile.checkins.length} ditëve`
  })}
  <div class="chart-legend">
    <span style="color:var(--cyan)"><i class="legend-swatch"></i>ditët bazë</span>
    <span style="color:var(--coral)"><i class="legend-swatch"></i>${profile.settings.recentDays} ditët e fundit</span>
    <span style="color:var(--teal)"><i class="legend-swatch dashed"></i>normalja jote (${round(factor.base, 1)})</span>
  </div>
  <p class="card-note">Teksti alternativ: ${escapeHtml(METRIC_LABELS[chosenMetric])} — normalja ${round(factor.base, 1)},
    ${profile.settings.recentDays} ditët e fundit ${round(factor.recent, 1)},
    ndryshim ${factor.pct === null ? '—' : Math.round(factor.pct) + '%'} mbi ${factor.baselineDays + factor.recentDays} ditë të matura.</p>`;
  mountChartTips(host);
}

function wire(container, app) {
  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
  const picker = container.querySelector('#metric-picker');
  if (!picker) return;
  picker.addEventListener('click', event => {
    const button = event.target.closest('[data-metric]');
    if (!button) return;
    chosenMetric = button.dataset.metric;
    for (const item of picker.querySelectorAll('[data-metric]')) {
      item.setAttribute('aria-pressed', String(item.dataset.metric === chosenMetric));
    }
    drawTimeline(container, app);
  });
}
