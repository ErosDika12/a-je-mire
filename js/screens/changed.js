import { icon, mountChartTips } from '../ui.js';
import { constellation, escapeHtml } from '../chart.js';
import { round } from '../stats.js';
import {
  METRIC_LABELS, METRIC_RANGES, MIN_DAYS,
  somethingChanged, baselineProgress, splitPeriods
} from '../patterns.js';
import { emptyBlock } from './dashboard.js';

export function renderChanged(container, app) {
  const profile = app.profile;
  const progress = baselineProgress(profile.checkins, profile.settings);
  const result = somethingChanged(profile.checkins, profile.settings);
  const { baseline, recent } = splitPeriods(profile.checkins, profile.settings);

  if (!result.enough) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('shift', 'Ende nuk ka të dhëna të mjaftueshme',
        `Duhen të paktën ${MIN_DAYS.change} ditë për të krahasuar dy periudha. Ke ${progress.have}.`)}
        <div class="progress" style="max-width:320px;margin:0 auto"><div class="progress-bar" style="width:${(progress.have / MIN_DAYS.change * 100).toFixed(0)}%"></div></div>
        <div class="row" style="justify-content:center;margin-top:var(--s5)">
          <button type="button" class="btn btn-primary" data-go="checkin">${icon('check', 16)} Bëj check-in</button>
        </div>
      </section>`;
    wire(container, app);
    return;
  }

  container.innerHTML = `
    ${head()}
    ${result.signal ? signalCard(result, baseline, recent) : calmCard(baseline, recent)}
    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Të gjashtë matjet, me numrat e plotë</h2>
        <p class="card-sub">Normalja jote kundrejt ${recent.length} ditëve të fundit</p>
      </div></div>
      ${result.factors.map(compareRow).join('')}
      <p class="card-note">Shënohet një matje vetëm nëse lëvizi në drejtimin e vështirë për të <strong>dhe</strong> kaloi pragun: ndryshim mbi 15% ose z mbi 1.5. Sinjali ndizet vetëm me dy ose më shumë matje njëkohësisht.</p>
    </section>
    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="row" style="gap:var(--s3)">
        <span class="fact-ic">${icon('shield', 18)}</span>
        <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
          Kjo faqe raporton vetëm sa lëvizën numrat e tu. Nuk të vendos etiketë, nuk të krahason me askënd dhe nuk thotë se çfarë do të thotë kjo për ty. Kuptimin ia jep ti.
        </p>
      </div>
    </section>
    <div class="row" style="margin-top:var(--s5)">
      <button type="button" class="btn btn-primary" data-go="why">${icon('why', 16)} Pse? Shiko lidhjet</button>
      <button type="button" class="btn" data-go="helps">${icon('spark', 16)} What Helps Me?</button>
    </div>`;

  wire(container, app);
  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">Something Changed</h1>
    <p class="page-sub">Krahasuar me 30 ditët e tua — jo me askënd tjetër.</p>
  </header>`;
}

function signalCard(result, baseline, recent) {
  const largest = Math.max(...result.flagged.map(factor => Math.abs(factor.pct)));
  return `<section class="hero">
    ${constellation()}
    <div class="hero-body">
      <span class="pill pill-signal"><span class="pill-dot"></span>Sinjal i vërejtur</span>
      <h2 class="hero-title" style="margin-top:var(--s3)">
        ${result.flagged.length} nga 6 matjet e tua lëvizën më shumë se zakonisht gjatë ${recent.length} ditëve të fundit.
      </h2>
      <p class="hero-text">Krahasimi është mes ${baseline.length} ditëve të tua bazë dhe ${recent.length} ditëve të fundit. Më poshtë janë faktorët, të renditur sipas madhësisë së lëvizjes.</p>
      <ul style="margin-top:var(--s5)">
        ${result.flagged.map(factor => flaggedRow(factor, largest)).join('')}
      </ul>
    </div>
  </section>`;
}

function flaggedRow(factor, largest) {
  const down = factor.pct < 0;
  const width = (Math.abs(factor.pct) / largest * 100).toFixed(1);
  return `<li class="factor">
    <div class="factor-head">
      <span class="factor-name">${METRIC_LABELS[factor.metric]}</span>
      <span class="factor-pct" style="color:var(--signal)">${down ? '↓' : '↑'} ${Math.abs(Math.round(factor.pct))}%</span>
    </div>
    <div class="factor-track"><div class="factor-fill" style="--w:${width}%"></div></div>
    <div class="factor-detail">
      <span>normalja ${round(factor.base, 1)}</span>
      <span>tani ${round(factor.recent, 1)}</span>
      <span>z = ${round(factor.z, 2)}</span>
      <span>${factor.baselineDays} + ${factor.recentDays} ditë</span>
    </div>
  </li>`;
}

function calmCard(baseline, recent) {
  return `<section class="hero">
    ${constellation()}
    <div class="hero-body">
      <span class="pill pill-accent">${icon('check', 13)} Gjendje e qetë</span>
      <h2 class="hero-title" style="margin-top:var(--s3)">Asnjë matje nuk doli jashtë kufirit këto ${recent.length} ditë.</h2>
      <p class="hero-text">Të gjashtë numrat qëndrojnë afër mesatares sate nga ${baseline.length} ditët bazë. Sinjali shfaqet vetëm kur dy ose më shumë matje lëvizin njëkohësisht — një e vetme është zhurmë, jo pattern.</p>
    </div>
  </section>`;
}

// Shiriti nga minimumi te maksimumi i metrikës, me shenjë te normalja dhe pikë te tani.
function compareRow(factor) {
  const range = METRIC_RANGES[factor.metric];
  const toPercent = value => ((value - range.min) / (range.max - range.min) * 100);
  const basePercent = factor.base === null ? 0 : toPercent(factor.base);
  const recentPercent = factor.recent === null ? 0 : toPercent(factor.recent);
  const worse = factor.movedWorse;
  const color = factor.flagged ? 'var(--signal)' : worse ? 'var(--amber)' : 'var(--teal)';
  const pct = factor.pct === null ? null : Math.round(factor.pct);

  return `<div class="factor">
    <div class="factor-head">
      <span class="factor-name">${METRIC_LABELS[factor.metric]}
        ${factor.flagged ? '<span class="pill pill-signal" style="margin-left:6px">shënuar</span>' : ''}</span>
      <span class="factor-pct" style="color:${color}">${pct === null ? '—' : (pct < 0 ? '↓ ' : '↑ ') + Math.abs(pct) + '%'}</span>
    </div>
    <svg class="chart" viewBox="0 0 100 14" preserveAspectRatio="none" style="height:14px;margin:10px 0 6px" role="img"
         aria-label="${escapeHtml(`${METRIC_LABELS[factor.metric]}: normalja ${round(factor.base, 1)}, tani ${round(factor.recent, 1)}`)}">
      <rect x="0" y="5" width="100" height="4" rx="2" fill="var(--surface-3)"/>
      <rect x="${Math.min(basePercent, recentPercent).toFixed(1)}" y="5"
            width="${Math.abs(recentPercent - basePercent).toFixed(1)}" height="4" rx="2" fill="${color}" opacity="0.35"/>
      <rect x="${(basePercent - 0.4).toFixed(1)}" y="1" width="0.8" height="12" fill="var(--teal)"/>
      <circle cx="${recentPercent.toFixed(1)}" cy="7" r="3.2" fill="${color}" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="factor-detail">
      <span>normalja ${round(factor.base, 1)}</span>
      <span>tani ${round(factor.recent, 1)}</span>
      <span>z = ${round(factor.z, 2)}</span>
      <span>${factor.baselineDays} + ${factor.recentDays} ditë</span>
    </div>
  </div>`;
}

function wire(container, app) {
  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
}
