import { icon, metricIcon } from '../ui.js';
import { escapeHtml, fmtNum, fmtPct, fmtValue, arrowFor, formatWeekday } from '../format.js';
import { METRICS, METRIC_LABELS, MIN_DAYS, somethingChanged, normalReport, journeyDays } from '../patterns.js';
import { emptyState, weeklySnapshot, snapshotFooter, journeyBar, modePill } from '../components.js';
import { t } from '../i18n/index.js';

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
      <span class="row" style="gap:var(--s2)">${icon('privacy', 16)} ${t('dash.localOnly')}</span>
      <button type="button" class="btn-link" data-go="privacy">${t('dash.privacy')} ${icon('next', 14)}</button>
    </div>`;

  container.querySelector('[data-tour]').addEventListener('click', () => app.startTour());
}

function header(profile, today) {
  return `<header class="panel texture" style="padding:var(--s6) var(--s5)">
    <div class="row-between" style="align-items:flex-start">
      <div>
        <span class="eyebrow">A JE MIRË? 2036 · ${escapeHtml(formatWeekday(today))}</span>
        <h1 class="page-title mt-2">${t('dash.title')}</h1>
      </div>
      <div class="row">
        ${profile.mode === 'demo' ? modePill(profile) : ''}
        <button type="button" class="btn btn-sm" data-go="data">${icon('database', 15)} ${t('dash.myData')}</button>
      </div>
    </div>
    <p class="page-sub">${t('dash.subtitle')}</p>
    <button type="button" class="btn btn-sm mt-4" data-tour>${icon('play', 14)} ${t('dash.tour')}</button>
  </header>`;
}

function journeyCard(journey, profile) {
  return `<h2 class="eyebrow" id="journey-title">${t('dash.journeyTitle')}</h2>
    <div class="summary-count">
      <span class="display-num">${journey.done}</span>
      <span class="muted">${t('dash.journeyOf')}</span>
    </div>
    ${journeyBar(journey)}
    <p class="card-note">${t('dash.journeyNote', { base: profile.settings.baselineDays, recent: profile.settings.recentDays })}</p>`;
}

function todayCard(entry) {
  if (!entry) {
    return `<h2 class="eyebrow" id="today-title">${t('dash.todayTitle')}</h2>
      <p class="big-num mt-3">${t('dash.noCheckin')}</p>
      <p class="muted small mt-2">${t('dash.quick')}</p>
      <button type="button" class="btn btn-primary btn-block mt-5" data-go="checkin">${icon('check', 16)} ${t('dash.doCheckin')}</button>`;
  }
  const values = METRICS.map(metric => `<div class="day-metric">${metricIcon(metric)}<span>${METRIC_LABELS[metric]}</span>
    <b>${fmtValue(entry[metric])}${metric === 'sleep' && Number.isFinite(entry[metric]) ? ` ${t('core.hoursShort')}` : ''}</b></div>`).join('');
  return `<h2 class="eyebrow" id="today-title">${t('dash.todayTitle')}</h2>
    <p class="big-num mt-3">${t('dash.recorded')}</p>
    <div class="day-metrics">${values}</div>
    <button type="button" class="btn btn-block mt-4" data-go="checkin">${icon('edit', 16)} ${t('dash.update')}</button>
    <p class="tiny mt-2">${t('dash.replaceNote')}</p>`;
}

function changesCard(changed, profile) {
  const head = `<h2 class="eyebrow" id="changes-title">${t('dash.changesTitle')}</h2>`;
  if (!changed.enough) {
    return head + emptyState('baseline', t('dash.notEnough'),
      t('dash.changesNeed', { n: MIN_DAYS.change, have: profile.checkins.length }),
      { label: t('dash.checkin'), go: 'checkin' });
  }
  if (!changed.signal) {
    return `${head}
      <p class="big-num mt-3">${t('dash.noCombined')}</p>
      <p class="muted small mt-2">${t('dash.noCombinedNote', { n: changed.flagged.length, recent: profile.settings.recentDays })}</p>
      <button type="button" class="btn-link mt-3" data-go="changed">${t('dash.seeAll')} ${icon('next', 14)}</button>`;
  }
  const rows = changed.flagged.slice(0, 2).map(factor => {
    const unit = factor.metric === 'sleep' ? ` ${t('core.hoursShort')}` : '';
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
      <span class="muted">${t('dash.flaggedOf', { recent: profile.settings.recentDays })}</span>
    </div>
    <div class="snap mt-4">${rows}</div>
    <button type="button" class="btn-link mt-2" data-go="changed">${t('dash.seeAll')} ${icon('next', 14)}</button>`;
}

function snapshotCard(changed, profile) {
  const head = `<h2 class="eyebrow" id="snap-title">${t('dash.snapTitle')}</h2>`;
  if (!changed.enough) {
    return head + emptyState('partial', t('dash.notEnough'), t('dash.snapNeed', { n: MIN_DAYS.change }));
  }
  return `${head}
    <div class="mt-4">${weeklySnapshot(normalReport(profile.checkins, profile.settings), true)}</div>
    ${snapshotFooter(profile.settings.recentDays)}
    <button type="button" class="btn-link" data-go="why">${t('dash.whyLink')} ${icon('next', 14)}</button>`;
}
