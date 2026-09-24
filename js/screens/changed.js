import { icon, metricIcon } from '../ui.js';
import { escapeHtml, fmtNum, fmtSigned, fmtPct, arrowFor, formatRange } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, somethingChanged, splitPeriods } from '../patterns.js';
import { emptyState, modePill } from '../components.js';
import { t } from '../i18n/index.js';

// Fjalia qendrore e projektit (changed.central). Nuk ndryshohet.

export function renderChanged(container, app) {
  const profile = app.profile;
  const result = somethingChanged(profile.checkins, profile.settings);

  if (!result.enough) {
    container.innerHTML = `${head()}
      <section class="card">${emptyState('baseline', t('changed.notEnough'),
        t('changed.need', { n: MIN_DAYS.change, have: profile.checkins.length }),
        { label: t('changed.checkin'), go: 'checkin' })}</section>`;
    return;
  }

  const periods = splitPeriods(profile.checkins, profile.settings);
  container.innerHTML = `
    ${head()}
    ${summaryPanel(result, periods, profile)}
    ${result.signal ? factorGrid(result.flagged) : calmCard(result, profile)}
    <div class="row mt-5">
      <button type="button" class="btn" data-go="why">${icon('why', 16)} ${t('changed.whyLink')}</button>
      <button type="button" class="btn" data-go="patterns">${icon('patterns', 16)} ${t('changed.patterns')}</button>
    </div>
    <p class="card-note">${t('changed.pageNote')}</p>`;
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">${t('changed.eyebrow')}</span>
    <h1 class="page-title mt-2">${t('changed.title')}</h1>
  </header>`;
}

function summaryPanel(result, periods, profile) {
  const { baseline, recent } = periods;
  const count = result.flagged.length;
  const sentence = result.signal
    ? t('changed.sentenceSignal', { n: recent.length })
    : t('changed.sentenceCalm');
  return `<section class="summary-panel texture" aria-labelledby="summary-title">
    <div class="row-between" style="align-items:flex-start">
      <h2 class="eyebrow" id="summary-title">${t('changed.summaryTitle')}</h2>
      ${profile.mode === 'demo' ? modePill(profile) : ''}
    </div>
    <div class="summary-count">
      <span class="display-num">${count}</span>
      <span class="summary-sentence" style="margin-top:0">${sentence}</span>
    </div>
    <p class="quote-line">${t('changed.central')}</p>
    <dl class="measure-list mt-4" style="max-width:520px">
      <div><dt>${t('changed.baseline')}</dt><dd>${escapeHtml(formatRange(baseline[0].date, baseline[baseline.length - 1].date))} · ${baseline.length} ${t('changed.days')}</dd></div>
      <div><dt>${t('changed.recent')}</dt><dd>${escapeHtml(formatRange(recent[0].date, recent[recent.length - 1].date))} · ${recent.length} ${t('changed.days')}</dd></div>
    </dl>
  </section>`;
}

function factorGrid(flagged) {
  // Renditja sipas madhësisë absolute të përqindjes vjen gati nga somethingChanged().
  const largest = Math.max(...flagged.map(factor => Math.abs(factor.pct)));
  return `<h2 class="sr-only">${t('changed.factorsTitle')}</h2>
    <div class="grid factor-grid mt-4">${flagged.map(factor => factorCard(factor, largest)).join('')}</div>`;
}

function factorCard(factor, largest) {
  const label = METRIC_LABELS[factor.metric];
  const unit = factor.metric === 'sleep' ? ` ${t('core.hoursShort')}` : '';
  const width = (Math.abs(factor.pct) / largest * 100).toFixed(1);
  const went = factor.pct < 0 ? t('changed.wentDown') : t('changed.wentUp');
  return `<article class="factor-card" aria-label="${escapeHtml(`${label}: ${fmtPct(factor.pct)}`)}">
    <div class="factor-top">
      ${metricIcon(factor.metric, 'signal')}
      <h3 class="factor-name">${label}</h3>
      <span class="pill">${arrowFor(factor.pct)} ${went}</span>
    </div>
    <div class="factor-pct mt-3">${fmtPct(factor.pct)}</div>
    <p class="factor-flow">${t('changed.flow', { base: fmtNum(factor.base), recent: fmtNum(factor.recent), unit })}</p>
    <div class="bar" role="img" aria-label="${escapeHtml(t('changed.barLabel', { n: Math.round(width) }))}"><i style="width:${width}%"></i></div>
    <details class="collapse">
      <summary>${t('changed.seeMeasures')}</summary>
      <div class="collapse-body">
        <dl class="measure-list">
          <div><dt>${t('changed.normalDays', { n: factor.baselineDays })}</dt><dd>${fmtNum(factor.base)}${unit}</dd></div>
          <div><dt>${t('changed.recentDays', { n: factor.recentDays })}</dt><dd>${fmtNum(factor.recent)}${unit}</dd></div>
          <div><dt>${t('changed.difference')}</dt><dd>${fmtSigned(factor.delta)}${unit}</dd></div>
          <div><dt>${t('changed.change')}</dt><dd>${fmtPct(factor.pct)}</dd></div>
          <div><dt>z-score</dt><dd>${fmtSigned(factor.z, 2)}</dd></div>
        </dl>
        <p class="tiny mt-3">${t('changed.method')}</p>
      </div>
    </details>
  </article>`;
}

function calmCard(result, profile) {
  return `<section class="card mt-4">
    ${emptyState('calm', t('changed.calmTitle'),
      t('changed.calmText', { n: profile.settings.recentDays }),
      { label: t('changed.seeAllNumbers'), go: 'why' })}
  </section>`;
}
