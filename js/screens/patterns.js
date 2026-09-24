import { mountChartTips } from '../ui.js';
import { scatterPlot, relationshipChart } from '../chart.js';
import { fmtNum, escapeHtml } from '../format.js';
import {
  METRIC_LABELS, METRIC_RANGES, MIN_DAYS,
  correlations, scatterPairs, laggedLink, conditionalInsight
} from '../patterns.js';
import { emptyState } from '../components.js';
import { t } from '../i18n/index.js';

// Kjo fjali jeton brenda çdo karte patterni. Asnjë kartë nuk vizatohet dot pa të.
const notCause = () => `<p class="disclaimer">${t('pat.notCause')}</p>`;

export function renderPatterns(container, app) {
  const checkins = app.profile.checkins;

  if (checkins.length < MIN_DAYS.patterns) {
    container.innerHTML = `${head()}<section class="card">${emptyState('scatter', t('pat.notEnough'),
      t('pat.need', { n: MIN_DAYS.patterns, have: checkins.length }),
      { label: t('pat.checkin'), go: 'checkin' })}</section>`;
    return;
  }

  const links = correlations(checkins);
  const strong = links.filter(link => link.strong).slice(0, 3);
  const lagged = laggedLink(checkins, 'sleep', 'mood');
  const conditional = conditionalInsight(checkins, app.profile.settings, ['sleep', 'social'], 'mood');

  container.innerHTML = `
    ${head()}
    <h2 class="eyebrow">${t('pat.clearest')}</h2>
    ${strong.length
      ? `<div class="grid pattern-grid mt-3">${strong.map(link => pairCard(link, checkins)).join('')}</div>`
      : `<section class="card mt-3">${emptyState('scatter', t('pat.noneTitle'), t('pat.noneText'))}</section>`}
    <div class="g-12 mt-4">
      <section class="card span-6">${laggedCard(lagged)}</section>
      <section class="card span-6">${conditionalCard(conditional)}</section>
    </div>
    <section class="panel mt-4 pattern-card" aria-labelledby="map-title">
      <span class="eyebrow">${t('pat.allPairs')}</span>
      <h2 class="card-title" id="map-title">${t('pat.mapTitle')}</h2>
      <p class="card-sub">${t('pat.mapHint')}</p>
      <div class="mt-3">${relationshipChart(links, METRIC_LABELS)}</div>
      ${notCause()}
    </section>`;

  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">${t('pat.eyebrow')}</span>
    <h1 class="page-title mt-2">${t('pat.title')}</h1>
    <p class="page-sub">${t('pat.subtitle')}</p>
  </header>`;
}

function axisTitle(metric) {
  return metric === 'sleep' ? t('pat.sleepAxis') : `${METRIC_LABELS[metric]} (1–10)`;
}

function strengthWord(r) {
  const size = Math.abs(r);
  if (size >= 0.6) return t('pat.strong');
  if (size >= 0.35) return t('pat.moderate');
  return t('pat.weak');
}

function directionText(r) {
  if (Math.abs(r) < 0.35) return t('pat.dirWeak');
  return r > 0 ? t('pat.dirPositive') : t('pat.dirNegative');
}

function pairCard(link, checkins) {
  const title = t('pat.pairTitle', { a: METRIC_LABELS[link.a], b: METRIC_LABELS[link.b].toLowerCase() });
  const strength = t('pat.linkStrength', { s: strengthWord(link.r) });
  return `<article class="card pattern-card" aria-label="${escapeHtml(title)}">
    <span class="eyebrow">${strength.charAt(0).toUpperCase() + strength.slice(1)}</span>
    <h3 class="card-title">${escapeHtml(title)}</h3>
    ${scatterPlot({
      points: scatterPairs(checkins, link.a, link.b),
      xRange: METRIC_RANGES[link.a], yRange: METRIC_RANGES[link.b],
      xLabel: METRIC_LABELS[link.a], yLabel: METRIC_LABELS[link.b],
      xTitle: axisTitle(link.a), yTitle: axisTitle(link.b),
      alt: t('pat.scatterAlt', { title, n: link.n, r: fmtNum(link.r, 2) })
    })}
    <div class="pattern-meta"><span>r = ${fmtNum(link.r, 2)}</span><span>${t('pat.days', { n: link.n })}</span></div>
    <p class="small muted mt-2">${directionText(link.r)}</p>
    ${notCause()}
  </article>`;
}

function laggedCard(lagged) {
  const head = `<span class="eyebrow">${t('pat.lagEyebrow')}</span>
    <h2 class="card-title">${t('pat.lagTitle')}</h2>`;
  if (!lagged) {
    return head + emptyState('scatter', t('pat.lagEmpty'), t('pat.lagNeed', { n: MIN_DAYS.tag + 1 }));
  }
  return `<div class="pattern-card">${head}
    ${scatterPlot({
      points: lagged.pairs,
      xRange: METRIC_RANGES.sleep, yRange: METRIC_RANGES.mood,
      xLabel: t('pat.lagX'), yLabel: t('pat.lagY'),
      xTitle: t('pat.lagXTitle'), yTitle: t('pat.lagYTitle'),
      alt: t('pat.lagAlt', { n: lagged.n, r: fmtNum(lagged.r, 2) })
    })}
    <div class="pattern-meta"><span>r = ${fmtNum(lagged.r, 2)}</span><span>${t('pat.lagPairs', { n: lagged.n })}</span></div>
    <p class="small muted mt-2">${directionText(lagged.r)} ${t('pat.lagOrder')}</p>
    ${notCause()}
  </div>`;
}

function conditionalCard(insight) {
  const head = `<span class="eyebrow">${t('pat.condEyebrow')}</span>
    <h2 class="card-title">${t('pat.condTitle')}</h2>`;
  if (!insight) {
    return head + emptyState('partial', t('pat.condEmpty'), t('pat.condNeed', { n: MIN_DAYS.tag }));
  }
  // Shiriti mbulon gjithë shkallën 1–10, që dallimi të mos duket më i madh se ç'është.
  const bar = (value, color) => `<div class="bar" style="height:10px"><i style="width:${(((value - 1) / 9) * 100).toFixed(1)}%;background:${color}"></i></div>`;
  return `<div class="pattern-card">${head}
    <p class="summary-sentence">${t('pat.condText', { with: fmtNum(insight.withMean), without: fmtNum(insight.withoutMean) })}</p>
    <div class="mt-4 small">
      <div class="row-between"><span>${t('pat.condWith', { n: insight.withDays })}</span><b class="num">${fmtNum(insight.withMean)}</b></div>
      ${bar(insight.withMean, 'var(--accent)')}
      <div class="row-between mt-3"><span>${t('pat.condOther', { n: insight.withoutDays })}</span><b class="num">${fmtNum(insight.withoutMean)}</b></div>
      ${bar(insight.withoutMean, 'var(--text-3)')}
      <p class="tiny mt-2">${t('pat.condScale')}</p>
    </div>
    ${notCause()}
  </div>`;
}
