import { icon, mountChartTips } from '../ui.js';
import { relationshipChart, escapeHtml } from '../chart.js';
import { round } from '../stats.js';
import {
  METRIC_LABELS, MIN_DAYS, correlations, laggedLink, conditionalInsight, somethingChanged
} from '../patterns.js';
import { noteKeywords } from '../nlp.js';
import { emptyBlock } from './dashboard.js';

// Kjo fjali është pjesë e vetë kartës. Asnjë kartë patterni nuk renderohet dot pa të.
const NOT_CAUSE = 'Ky është pattern në të dhënat e tua, jo shkak.';

export function renderWhy(container, app) {
  const profile = app.profile;
  const checkins = profile.checkins;

  if (checkins.length < MIN_DAYS.patterns) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('why', 'Ende nuk mjaftojnë ditët',
        `Lidhjet llogariten mbi të paktën ${MIN_DAYS.patterns} ditë. Ke ${checkins.length}. Deri atëherë nuk shpikim asnjë shpjegim.`)}
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn-primary" data-go="checkin">${icon('check', 16)} Bëj check-in</button>
        </div>
      </section>`;
    wire(container, app);
    return;
  }

  const links = correlations(checkins);
  const strong = links.filter(link => link.strong).slice(0, 4);
  const lagged = laggedLink(checkins, 'sleep', 'mood');
  const conditional = conditionalInsight(checkins, profile.settings, ['sleep', 'social'], 'mood');
  const keywords = noteKeywords(checkins, profile.settings, 'mood');

  container.innerHTML = `
    ${head()}
    ${headlineCard(checkins, profile)}
    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Harta e lidhjeve</h2>
        <p class="card-sub">Sa më e trashë vija, aq më e fortë lidhja mes dy matjeve gjatë ${checkins.length} ditëve</p>
      </div></div>
      ${relationshipChart(links, METRIC_LABELS)}
      <div class="chart-legend" style="justify-content:center">
        <span style="color:var(--teal)"><i class="legend-swatch"></i>lëvizin bashkë</span>
        <span style="color:var(--lavender)"><i class="legend-swatch"></i>lëvizin në drejtime të kundërta</span>
      </div>
      <p class="card-note">${NOT_CAUSE} Vija tregon vetëm se dy matje kanë lëvizur së bashku në ditët e tua.</p>
    </section>

    ${strong.length > 0 ? `<div class="grid grid-2" style="margin-top:var(--s4)">
      ${strong.map(linkCard).join('')}
    </div>` : `<section class="card" style="margin-top:var(--s4)">${emptyBlock('why', 'Asnjë lidhje e fortë',
      'Asnjë çift matjesh nuk lëvizi bashkë mjaftueshëm për ta veçuar. Kjo është një rezultat i vlefshëm, jo një gabim.')}</section>`}

    ${conditional ? conditionalCard(conditional) : ''}
    ${lagged ? laggedCard(lagged) : ''}
    ${keywords ? keywordCard(keywords) : ''}

    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="card-head"><span class="fact-ic">${icon('info', 18)}</span>
        <div><h2 class="card-title">Si llogariten</h2></div></div>
      <ul class="facts">
        <li class="fact"><span class="fact-ic">${icon('pulse', 16)}</span><span><strong>Korrelacion Pearson (r)</strong> mes çdo çifti matjesh, mbi të gjitha ditët e shënuara. r afër 1 do të thotë lëvizin bashkë, afër −1 në drejtime të kundërta, afër 0 pa lidhje.</span></li>
        <li class="fact"><span class="fact-ic">${icon('calendar', 16)}</span><span><strong>Lidhje me vonesë:</strong> vlera e ditës N krahasohet me vlerën e ditës N+1, për të parë nëse njëra i paraprin tjetrës në kohë.</span></li>
        <li class="fact"><span class="fact-ic">${icon('spark', 16)}</span><span><strong>Mesatare me kusht:</strong> ditët ku dy matje ishin mbi normalen tënde, kundrejt ditëve të tjera.</span></li>
        <li class="fact"><span class="fact-ic">${icon('shield', 16)}</span><span>Çdo rezultat shfaqet me numrin e ditëve pas tij. Pa ditë të mjaftueshme, nuk shfaqet fare.</span></li>
      </ul>
    </section>`;

  wire(container, app);
  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">Why?</h1>
    <p class="page-sub">Cilat matje kanë lëvizur së bashku në ditët e tua. Shoqërim, jo shkak.</p>
  </header>`;
}

function headlineCard(checkins, profile) {
  const changed = somethingChanged(checkins, profile.settings);
  if (changed.flagged.length < 2) {
    return `<section class="card">
      <div class="card-head"><div><h2 class="card-title">Asnjë grup faktorësh këtë javë</h2>
        <p class="card-sub">Matjet e tua nuk lëvizën bashkë mjaftueshëm për të përshkruar një grup</p></div></div>
      <p style="color:var(--text-2);font-size:var(--fs-sm)">Harta më poshtë tregon lidhjet e përgjithshme mbi të gjitha ditët e tua.</p>
      <p class="card-note">${NOT_CAUSE}</p>
    </section>`;
  }
  const down = changed.flagged.filter(factor => factor.pct < 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const up = changed.flagged.filter(factor => factor.pct > 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const parts = [];
  if (down.length) parts.push(`${joinWords(down)} më poshtë se normalja jote`);
  if (up.length) parts.push(`${joinWords(up)} më lart se normalja jote`);

  return `<section class="card">
    <div class="card-head"><div>
      <h2 class="card-title">Çfarë doli bashkë</h2>
      <p class="card-sub">${changed.flagged.length} matje të shënuara gjatë ${profile.settings.recentDays} ditëve të fundit</p>
    </div></div>
    <p style="font-size:var(--fs-lg);line-height:1.45">${capitalize(parts.join(', dhe '))} — këto u shfaqën në të njëjtën periudhë.</p>
    <p class="card-note">${NOT_CAUSE} Që dy gjëra ndodhin bashkë nuk do të thotë se njëra e shkakton tjetrën.</p>
  </section>`;
}

function linkCard(link) {
  const strength = Math.min(100, Math.abs(link.r) * 100);
  const positive = link.r > 0;
  return `<section class="link-card">
    <div class="link-head">
      <span>${METRIC_LABELS[link.a]}</span>
      <span class="link-arrow">${positive ? '↔' : '↮'}</span>
      <span>${METRIC_LABELS[link.b]}</span>
    </div>
    <div class="link-strength ${positive ? 'link-pos' : 'link-neg'}"><i style="width:${strength.toFixed(0)}%"></i></div>
    <p class="link-meta">r = ${link.r.toFixed(2)} · ${link.n} ditë · ${positive ? 'lëvizin bashkë' : 'lëvizin në drejtime të kundërta'}</p>
    <p class="card-note">${NOT_CAUSE}</p>
  </section>`;
}

function conditionalCard(insight) {
  const names = insight.conditionMetrics.map(metric => METRIC_LABELS[metric].toLowerCase());
  const difference = round(Math.abs(insight.withMean - insight.withoutMean), 1);
  const higher = insight.withMean > insight.withoutMean;
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Mesatare me kusht</h2>
      <p class="card-sub">Ditët ku ${joinWords(names)} ishin më mirë se normalja jote</p>
    </div></div>
    <p style="font-size:var(--fs-lg);line-height:1.45">
      Në ditët ku <strong>${joinWords(names)}</strong> ishin më mirë se normalja jote,
      ${METRIC_LABELS[insight.targetMetric].toLowerCase()} mesatar ishte
      <strong style="color:var(--teal)">${round(insight.withMean, 1)}</strong>,
      kundrejt <strong>${round(insight.withoutMean, 1)}</strong> në ditët e tjera.
    </p>
    <div class="factor-detail" style="margin-top:var(--s3)">
      <span>${insight.withDays} ditë me kusht</span>
      <span>${insight.withoutDays} ditë të tjera</span>
      <span>dallim ${higher ? '+' : '−'}${difference} pikë</span>
    </div>
    <p class="card-note">${NOT_CAUSE}</p>
  </section>`;
}

function laggedCard(lagged) {
  const positive = lagged.r > 0;
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Lidhje me vonesë një ditë</h2>
      <p class="card-sub">${METRIC_LABELS[lagged.fromMetric]} i ditës sotme kundrejt ${METRIC_LABELS[lagged.toMetric].toLowerCase()}t të nesërm</p>
    </div></div>
    <p style="font-size:var(--fs-md);color:var(--text-2)">
      Mbi ${lagged.n} çifte ditësh radhazi, r = <strong>${lagged.r.toFixed(2)}</strong>.
      ${Math.abs(lagged.r) < 0.25
        ? 'Kjo është e dobët — nuk mjafton për të thënë asgjë.'
        : positive
          ? 'Ditët me gjumë më të gjatë janë ndjekur nga ditë me humor më të lartë.'
          : 'Ditët me gjumë më të gjatë janë ndjekur nga ditë me humor më të ulët.'}
    </p>
    <p class="card-note">${NOT_CAUSE} Radha në kohë nuk provon shkakun.</p>
  </section>`;
}

function keywordCard(keywords) {
  const list = items => items.length
    ? items.map(item => `<span class="pill">${escapeHtml(item.word)} <strong>${item.count}</strong></span>`).join(' ')
    : '<span style="color:var(--text-3);font-size:var(--fs-sm)">asnjë fjalë e veçantë</span>';
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Fjalët e shënimeve</h2>
      <p class="card-sub">Ditët mbi normalen (${keywords.aboveDays}) kundrejt ditëve nën normalen (${keywords.belowDays})</p>
    </div></div>
    <div class="stack">
      <div>
        <p class="sheet-title">Vetëm në ditët mbi normalen</p>
        <div class="tag-wrap">${list(keywords.onlyAbove)}</div>
      </div>
      <div>
        <p class="sheet-title">Vetëm në ditët nën normalen</p>
        <div class="tag-wrap">${list(keywords.onlyBelow)}</div>
      </div>
    </div>
    <p class="card-note">${NOT_CAUSE} Numërohen fjalët e shënimeve të tua, lokalisht, pa i dërguar askund.</p>
  </section>`;
}

function joinWords(words) {
  if (words.length <= 1) return words[0] || '';
  return `${words.slice(0, -1).join(', ')} dhe ${words[words.length - 1]}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function wire(container, app) {
  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
}
