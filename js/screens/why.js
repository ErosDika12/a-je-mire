import { icon, metricIcon } from '../ui.js';
import { fmtSigned, fmtPct } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, WORSE, somethingChanged, normalReport } from '../patterns.js';
import { emptyState, sectionHead, weeklySnapshot, snapshotFooter } from '../components.js';
import { t } from '../i18n/index.js';

// Why?: numrat e plotë pas çdo shënimi dhe rregulli i saktë. Pa interpretim.
export function renderWhy(container, app) {
  const profile = app.profile;
  const changed = somethingChanged(profile.checkins, profile.settings);

  if (!changed.enough) {
    container.innerHTML = `${head()}<section class="card">${emptyState('baseline', t('why.notEnough'),
      t('why.need', { n: MIN_DAYS.change }),
      { label: t('why.checkin'), go: 'checkin' })}</section>`;
    return;
  }

  const report = normalReport(profile.checkins, profile.settings);
  container.innerHTML = `
    ${head()}
    ${changed.flagged.length >= 2 ? togetherCard(changed.flagged, profile) : ''}
    <div class="g-12 mt-4">
      <section class="card span-7" aria-labelledby="snap-full-title">
        ${sectionHead(t('why.snapEyebrow'), t('why.snapTitle'), '', '', 'snap-full-title')}
        ${weeklySnapshot(report)}
        ${snapshotFooter(profile.settings.recentDays)}
      </section>
      <section class="panel span-5" aria-labelledby="rule-title">
        ${sectionHead(t('why.ruleEyebrow'), t('why.ruleTitle'), '', '', 'rule-title')}
        <div>${report.map(ruleRow).join('')}</div>
      </section>
    </div>
    <section class="card mt-4" aria-labelledby="method-title">
      ${sectionHead(t('why.methodEyebrow'), t('why.methodTitle'), '', '', 'method-title')}
      <ol class="facts" style="list-style:decimal;padding-left:20px">
        <li class="small muted">${t('why.step1', { n: profile.settings.baselineDays })}</li>
        <li class="small muted">${t('why.step2', { n: profile.settings.recentDays })}</li>
        <li class="small muted">${t('why.step3')}</li>
        <li class="small muted">${t('why.step4')}</li>
        <li class="small muted">${t('why.step5')}</li>
      </ol>
      <button type="button" class="btn-link mt-3" data-go="patterns">${t('why.patternsLink')} ${icon('next', 14)}</button>
    </section>`;
}

function head() {
  return `<header class="page-head">
    <span class="eyebrow">${t('why.eyebrow')}</span>
    <h1 class="page-title mt-2">${t('why.title')}</h1>
    <p class="page-sub">${t('why.subtitle')}</p>
  </header>`;
}

function togetherCard(flagged, profile) {
  const down = flagged.filter(factor => factor.pct < 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const up = flagged.filter(factor => factor.pct > 0).map(factor => METRIC_LABELS[factor.metric].toLowerCase());
  const parts = [];
  if (down.length) parts.push(t('why.below', { list: joinWords(down) }));
  if (up.length) parts.push(t('why.above', { list: joinWords(up) }));
  const text = parts.join(t('why.joinAnd'));
  return `<section class="card card-signal pattern-card" aria-labelledby="together-title">
    <span class="eyebrow" id="together-title">${t('why.togetherTitle')}</span>
    <p class="summary-sentence">${t('why.togetherText', { text: text.charAt(0).toUpperCase() + text.slice(1), n: profile.settings.recentDays })}</p>
    <p class="disclaimer">${t('why.notCause')}</p>
  </section>`;
}

function ruleRow(factor) {
  const label = METRIC_LABELS[factor.metric];
  const watched = WORSE[factor.metric] === 1 ? t('why.rise') : t('why.fall');
  let reason;
  if (factor.flagged) {
    const byPct = Math.abs(factor.pct) >= 15;
    reason = byPct ? t('why.markedPct', { dir: watched }) : t('why.markedZ', { dir: watched });
  } else if (!factor.movedWorse) {
    reason = t('why.notMarkedDir', { dir: watched });
  } else {
    reason = t('why.notMarkedSmall');
  }
  return `<div class="rule-row">
    ${metricIcon(factor.metric, factor.flagged ? 'signal' : '')}
    <div class="rule-head"><span>${label}</span><span class="pill ${factor.flagged ? 'pill-signal' : ''}">${factor.flagged ? t('why.marked') : t('why.notMarked')}</span></div>
    <p class="rule-text">${t('why.ruleText', { pct: fmtPct(factor.pct), z: fmtSigned(factor.z, 2), reason })}</p>
  </div>`;
}

function joinWords(words) {
  if (words.length <= 1) return words[0] || '';
  return `${words.slice(0, -1).join(', ')} ${t('why.and')} ${words[words.length - 1]}`;
}
