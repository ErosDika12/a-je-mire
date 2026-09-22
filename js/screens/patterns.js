import { mountChartTips } from '../ui.js';
import { scatterPlot, relationshipChart } from '../chart.js';
import { fmtNum, escapeHtml } from '../format.js';
import {
  METRIC_LABELS, METRIC_RANGES, MIN_DAYS,
  correlations, scatterPairs, laggedLink, conditionalInsight
} from '../patterns.js';
import { emptyState } from '../components.js';

// Kjo fjali jeton brenda çdo karte patterni. Asnjë kartë nuk vizatohet dot pa të.
const NOT_CAUSE = 'Ky është pattern në të dhënat e tua, jo shkak.';

export function renderPatterns(container, app) {
  const checkins = app.profile.checkins;

  if (checkins.length < MIN_DAYS.patterns) {
    container.innerHTML = `${head()}<section class="card">${emptyState('scatter', 'Ende nuk ka të dhëna të mjaftueshme',
      `Lidhjet llogariten mbi të paktën ${MIN_DAYS.patterns} ditë. Deri tani: ${checkins.length}. Deri atëherë nuk shfaqet asnjë lidhje.`,
      { label: 'Bëj check-in', go: 'checkin' })}</section>`;
    return;
  }

  const links = correlations(checkins);
  const strong = links.filter(link => link.strong).slice(0, 3);
  const lagged = laggedLink(checkins, 'sleep', 'mood');
  const conditional = conditionalInsight(checkins, app.profile.settings, ['sleep', 'social'], 'mood');

  container.innerHTML = `
    ${head()}
    <h2 class="eyebrow">Lidhjet më të qarta</h2>
    ${strong.length
      ? `<div class="grid pattern-grid mt-3">${strong.map(link => pairCard(link, checkins)).join('')}</div>`
      : `<section class="card mt-3">${emptyState('scatter', 'Asnjë lidhje e qartë',
          'Asnjë çift matjesh nuk lëvizi bashkë mjaftueshëm (|r| ≥ 0.35). Edhe ky është rezultat i vlefshëm.')}</section>`}
    <div class="g-12 mt-4">
      <section class="card span-6">${laggedCard(lagged)}</section>
      <section class="card span-6">${conditionalCard(conditional)}</section>
    </div>
    <section class="panel mt-4 pattern-card" aria-labelledby="map-title">
      <span class="eyebrow">Të gjitha çiftet</span>
      <h2 class="card-title" id="map-title">Harta e lidhjeve</h2>
      <p class="card-sub">Vija e gjelbër: lëvizin bashkë. Vija vjollcë: lëvizin në drejtime të kundërta. Shfaqen vetëm lidhjet me |r| ≥ 0.35.</p>
      <div class="mt-3">${relationshipChart(links, METRIC_LABELS)}</div>
      <p class="disclaimer">${NOT_CAUSE}</p>
    </section>`;

  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">Pattern Intelligence</span>
    <h1 class="page-title mt-2">Patterns</h1>
    <p class="page-sub">Cilat matje kanë lëvizur bashkë në ditët e tua. Shoqërim në të dhëna, jo shkak.</p>
  </header>`;
}

function axisTitle(metric) {
  return metric === 'sleep' ? 'Gjumi (orë)' : `${METRIC_LABELS[metric]} (1–10)`;
}

function strengthWord(r) {
  const size = Math.abs(r);
  if (size >= 0.6) return 'e fortë';
  if (size >= 0.35) return 'e moderuar';
  return 'e dobët';
}

function directionText(r) {
  if (Math.abs(r) < 0.35) return 'Lidhje e dobët: dy matjet nuk lëvizën qartë bashkë.';
  return r > 0
    ? 'Lidhje pozitive: ditët me vlerë më të lartë në njërën kishin zakonisht vlerë më të lartë edhe në tjetrën.'
    : 'Lidhje negative: ditët me vlerë më të lartë në njërën kishin zakonisht vlerë më të ulët në tjetrën.';
}

function pairCard(link, checkins) {
  const title = `${METRIC_LABELS[link.a]} dhe ${METRIC_LABELS[link.b].toLowerCase()}`;
  return `<article class="card pattern-card" aria-label="${escapeHtml(title)}">
    <span class="eyebrow">Lidhje ${strengthWord(link.r)}</span>
    <h3 class="card-title">${escapeHtml(title)}</h3>
    ${scatterPlot({
      points: scatterPairs(checkins, link.a, link.b),
      xRange: METRIC_RANGES[link.a], yRange: METRIC_RANGES[link.b],
      xLabel: METRIC_LABELS[link.a], yLabel: METRIC_LABELS[link.b],
      xTitle: axisTitle(link.a), yTitle: axisTitle(link.b),
      alt: `${title}: grafik shpërndarjeje me ${link.n} ditë, r = ${fmtNum(link.r, 2)}`
    })}
    <div class="pattern-meta"><span>r = ${fmtNum(link.r, 2)}</span><span>${link.n} ditë</span></div>
    <p class="small muted mt-2">${directionText(link.r)}</p>
    <p class="disclaimer">${NOT_CAUSE}</p>
  </article>`;
}

function laggedCard(lagged) {
  const head = `<span class="eyebrow">Me një ditë vonesë</span>
    <h2 class="card-title">Gjumi i një dite dhe humori i ditës tjetër</h2>`;
  if (!lagged) {
    return head + emptyState('scatter', 'Ende nuk ka mjaft ditë radhazi',
      `Kjo lidhje kërkon të paktën ${MIN_DAYS.tag + 1} çifte ditësh të njëpasnjëshme në kalendar.`);
  }
  return `<div class="pattern-card">${head}
    ${scatterPlot({
      points: lagged.pairs,
      xRange: METRIC_RANGES.sleep, yRange: METRIC_RANGES.mood,
      xLabel: 'Gjumi (dita N)', yLabel: 'Humori (dita N+1)',
      xTitle: 'Gjumi i ditës N (orë)', yTitle: 'Humori i ditës N+1',
      alt: `Gjumi i ditës N kundrejt humorit të ditës N+1, ${lagged.n} çifte, r = ${fmtNum(lagged.r, 2)}`
    })}
    <div class="pattern-meta"><span>r = ${fmtNum(lagged.r, 2)}</span><span>${lagged.n} çifte ditësh radhazi</span></div>
    <p class="small muted mt-2">${directionText(lagged.r)} Radha në kohë nuk tregon se njëra e sjell tjetrën.</p>
    <p class="disclaimer">${NOT_CAUSE}</p>
  </div>`;
}

function conditionalCard(insight) {
  const head = `<span class="eyebrow">Mesatare me kusht</span>
    <h2 class="card-title">Ditët me gjumë dhe lidhje mbi normalen</h2>`;
  if (!insight) {
    return head + emptyState('partial', 'Ende nuk ka mjaft ditë në të dy grupet',
      `Duhen të paktën ${MIN_DAYS.tag} ditë në secilin grup për ta llogaritur këtë krahasim.`);
  }
  // Shiriti mbulon gjithë shkallën 1–10, që dallimi të mos duket më i madh se ç'është.
  const bar = (value, color) => `<div class="bar" style="height:10px"><i style="width:${(((value - 1) / 9) * 100).toFixed(1)}%;background:${color}"></i></div>`;
  return `<div class="pattern-card">${head}
    <p class="summary-sentence">Në ditët ku gjumi dhe lidhja sociale ishin mbi normalen tënde, humori mesatar ishte
      <strong>${fmtNum(insight.withMean)}</strong>, kundrejt <strong>${fmtNum(insight.withoutMean)}</strong> në ditët e tjera.</p>
    <div class="mt-4 small">
      <div class="row-between"><span>Me kusht · ${insight.withDays} ditë</span><b class="num">${fmtNum(insight.withMean)}</b></div>
      ${bar(insight.withMean, 'var(--accent)')}
      <div class="row-between mt-3"><span>Ditët e tjera · ${insight.withoutDays} ditë</span><b class="num">${fmtNum(insight.withoutMean)}</b></div>
      ${bar(insight.withoutMean, 'var(--text-3)')}
      <p class="tiny mt-2">Shiriti tregon shkallën e plotë 1–10 të humorit.</p>
    </div>
    <p class="disclaimer">${NOT_CAUSE}</p>
  </div>`;
}
