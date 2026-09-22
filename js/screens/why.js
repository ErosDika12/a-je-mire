import { icon, metricIcon } from '../ui.js';
import { fmtSigned, fmtPct } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, WORSE, somethingChanged, normalReport } from '../patterns.js';
import { emptyState, sectionHead, weeklySnapshot, snapshotFooter } from '../components.js';

const NOT_CAUSE = 'Ky është pattern në të dhënat e tua, jo shkak.';

// Why?: numrat e plotë pas çdo shënimi dhe rregulli i saktë. Pa interpretim.
export function renderWhy(container, app) {
  const profile = app.profile;
  const changed = somethingChanged(profile.checkins, profile.settings);

  if (!changed.enough) {
    container.innerHTML = `${head()}<section class="card">${emptyState('baseline', 'Ende nuk ka të dhëna të mjaftueshme',
      `Numrat e krahasimit shfaqen pasi të regjistrohen të paktën ${MIN_DAYS.change} ditë.`,
      { label: 'Bëj check-in', go: 'checkin' })}</section>`;
    return;
  }

  const report = normalReport(profile.checkins, profile.settings);
  container.innerHTML = `
    ${head()}
    ${changed.flagged.length >= 2 ? togetherCard(changed.flagged, profile) : ''}
    <div class="g-12 mt-4">
      <section class="card span-7" aria-labelledby="snap-full-title">
        ${sectionHead('Përmbledhja 7-ditore', 'Normalja kundrejt 7 ditëve të fundit', '', '', 'snap-full-title')}
        ${weeklySnapshot(report)}
        ${snapshotFooter(profile.settings.recentDays)}
      </section>
      <section class="panel span-5" aria-labelledby="rule-title">
        ${sectionHead('Rregulli', 'Pse u shënua, ose jo, secila matje', '', '', 'rule-title')}
        <div>${report.map(ruleRow).join('')}</div>
      </section>
    </div>
    <section class="card mt-4" aria-labelledby="method-title">
      ${sectionHead('Si funksionon?', 'Llogaritja, hap pas hapi', '', '', 'method-title')}
      <ol class="facts" style="list-style:decimal;padding-left:20px">
        <li class="small muted">Normalja = mesatarja e ${profile.settings.baselineDays} ditëve para periudhës së fundit.</li>
        <li class="small muted">7 ditët e fundit = mesatarja e ${profile.settings.recentDays} check-ins më të fundit.</li>
        <li class="small muted">Ndryshimi = (7 ditët − normalja) ÷ normalja × 100. z = (7 ditët − normalja) ÷ devijimi standard i normales.</li>
        <li class="small muted">Një matje shënohet kur lëviz në drejtimin që ndiqet (rënie për pesë matje, rritje për ngarkesën) dhe ndryshimi është ≥ 15% ose z ≥ 1.5.</li>
        <li class="small muted">Sinjali shfaqet vetëm kur shënohen dy ose më shumë matje njëkohësisht.</li>
      </ol>
      <button type="button" class="btn-link mt-3" data-go="patterns">Patterns: lidhjet mes matjeve ${icon('next', 14)}</button>
    </section>`;
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">Numrat pas çdo shënimi</span>
    <h1 class="page-title mt-2">Why?</h1>
    <p class="page-sub">Për secilën matje: normalja, 7 ditët e fundit, ndryshimi dhe rregulli që vendosi. Vetëm matje, pa interpretim.</p>
  </header>`;
}

function togetherCard(flagged, profile) {
  const down = flagged.filter(factor => factor.pct < 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const up = flagged.filter(factor => factor.pct > 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const parts = [];
  if (down.length) parts.push(`${joinWords(down)} më poshtë se normalja`);
  if (up.length) parts.push(`${joinWords(up)} më lart se normalja`);
  const text = parts.join(', dhe ');
  return `<section class="card card-signal pattern-card" aria-labelledby="together-title">
    <span class="eyebrow" id="together-title">Çfarë doli bashkë</span>
    <p class="summary-sentence">${text.charAt(0).toUpperCase() + text.slice(1)} — u shfaqën në të njëjtat ${profile.settings.recentDays} ditë.</p>
    <p class="disclaimer">${NOT_CAUSE}</p>
  </section>`;
}

function ruleRow(factor) {
  const label = METRIC_LABELS[factor.metric];
  const watched = WORSE[factor.metric] === 1 ? 'rritja' : 'rënia';
  let reason;
  if (factor.flagged) {
    const byPct = Math.abs(factor.pct) >= 15;
    reason = byPct ? `U shënua: ${watched} dhe ndryshimi ≥ 15%.` : `U shënua: ${watched} dhe z ≥ 1.5.`;
  } else if (!factor.movedWorse) {
    reason = `Nuk u shënua: për këtë matje ndiqet ${watched}, dhe lëvizja ishte në drejtimin tjetër ose zero.`;
  } else {
    reason = 'Nuk u shënua: ndryshimi nën 15% dhe z nën 1.5.';
  }
  return `<div class="rule-row">
    ${metricIcon(factor.metric, factor.flagged ? 'signal' : '')}
    <div class="rule-head"><span>${label}</span><span class="pill ${factor.flagged ? 'pill-signal' : ''}">${factor.flagged ? 'u shënua' : 'nuk u shënua'}</span></div>
    <p class="rule-text">Ndryshimi ${fmtPct(factor.pct)} · z ${fmtSigned(factor.z, 2)}. ${reason}</p>
  </div>`;
}

function joinWords(words) {
  if (words.length <= 1) return words[0] || '';
  return `${words.slice(0, -1).join(', ')} dhe ${words[words.length - 1]}`;
}
