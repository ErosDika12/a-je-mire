// Pjesë të vogla të ndërfaqes që përdoren në disa ekrane.
// Çdo funksion kthen HTML si tekst dhe nuk mban gjendje.

import { icon, metricIcon } from './ui.js';
import {
  escapeHtml, fmtNum, fmtSigned, fmtPct, fmtValue, arrowFor,
  formatDateLong, dayOfMonth, weekdayShort
} from './format.js';
import { METRICS, METRIC_LABELS, tagLabel } from './patterns.js';

/* ---------- gjendjet bosh ---------- */

// Simbole të vogla të vizatuara me dorë, 64x48. Janë dekorative: teksti tregon kuptimin.
const SYMBOLS = {
  calendar: '<rect x="12" y="8" width="40" height="34" rx="4"/><path d="M12 17h40"/><path d="M20 24h4M30 24h4M40 24h4M20 32h4M30 32h4" stroke-dasharray="2 3"/>',
  partial: '<path d="M8 41h48"/><path d="M12 41V29M19 41V24M26 41V31"/><path d="M33 41v-6M40 41v-6M47 41v-6M54 41v-6" stroke-dasharray="1.5 3"/>',
  baseline: '<path d="M8 41h48M8 8v33"/><path d="M12 25h40" stroke-dasharray="4 4"/><circle cx="18" cy="25" r="2"/><circle cx="28" cy="25" r="2"/>',
  calm: '<path d="M8 41h48M8 8v33"/><rect x="10" y="19" width="44" height="12" rx="2" stroke-dasharray="3 3"/><path d="M12 25l8-1 8 2 8-1 8 1 8-1"/>',
  scatter: '<path d="M10 8v33h46"/><circle cx="22" cy="18" r="1.8"/><circle cx="40" cy="30" r="1.8"/><circle cx="30" cy="14" r="1.8"/><circle cx="46" cy="20" r="1.8"/><circle cx="18" cy="33" r="1.8"/>',
  tags: '<path d="M12 14h18l8 8-8 8H12z"/><path d="M30 22h14l6 6-6 6H30" stroke-dasharray="3 3"/><circle cx="17" cy="22" r="1.6"/>',
  people: '<circle cx="32" cy="24" r="6"/><circle cx="14" cy="16" r="4.5" stroke-dasharray="2 2.5"/><circle cx="50" cy="16" r="4.5" stroke-dasharray="2 2.5"/><circle cx="14" cy="36" r="4.5" stroke-dasharray="2 2.5"/><circle cx="50" cy="36" r="4.5" stroke-dasharray="2 2.5"/>',
  words: '<path d="M10 12h30M10 20h44M10 28h24M10 36h36" stroke-dasharray="4 3"/>',
  link: '<circle cx="16" cy="24" r="6"/><circle cx="48" cy="24" r="6"/><path d="M22 24h20" stroke-dasharray="3 3"/>'
};

/**
 * Gjendje bosh e njëjtë kudo: simbol, titull faktik, një shpjegim, një veprim.
 * action: { label, go, section } ose null.
 */
export function emptyState(symbol, title, text, action = null) {
  const button = action
    ? `<button type="button" class="btn btn-primary" data-go="${action.go}"${action.section ? ` data-section="${action.section}"` : ''}>${escapeHtml(action.label)}</button>`
    : '';
  return `<div class="empty">
    <svg class="empty-art" width="64" height="48" viewBox="0 0 64 48" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYMBOLS[symbol] || SYMBOLS.calendar}</svg>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    ${button}
  </div>`;
}

/* ---------- kreu i një seksioni ---------- */

export function sectionHead(eyebrow, title, subtitle = '', extra = '', id = '') {
  return `<div class="card-head">
    <div>
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      <h2 class="card-title"${id ? ` id="${id}"` : ''}>${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="card-sub">${escapeHtml(subtitle)}</p>` : ''}
    </div>${extra}
  </div>`;
}

/* ---------- përmbledhja 7-ditore ---------- */

/**
 * Për çdo metrikë: normalja → 7 ditët e fundit, dallimi dhe përqindja.
 * Shigjeta tregon drejtimin numerik. Metrikat që kaluan pragun (sipas WORSE,
 * pra për ngarkesën kur rritet) marrin vetëm një shenjë të lehtë.
 */
export function weeklySnapshot(report, compact = false) {
  const rows = report.map(factor => snapshotRow(factor, compact)).join('');
  return `<div class="snap ${compact ? 'is-compact' : ''}" role="list">${rows}</div>`;
}

function snapshotRow(factor, compact) {
  const unit = factor.metric === 'sleep' ? ' orë' : '';
  const label = METRIC_LABELS[factor.metric];
  const spoken = `${label}: ${fmtNum(factor.base)}${unit} deri ${fmtNum(factor.recent)}${unit}, ndryshim ${fmtPct(factor.pct)}`;
  return `<div class="snap-row ${factor.flagged ? 'is-flagged' : ''}" role="listitem" aria-label="${escapeHtml(spoken)}">
    ${metricIcon(factor.metric, factor.flagged ? 'signal' : '')}
    <span class="snap-name">${label}${factor.flagged && !compact ? ' <span class="pill pill-signal">kaloi pragun</span>' : ''}</span>
    <span class="snap-flow">${fmtNum(factor.base)}${unit} → ${fmtNum(factor.recent)}${unit}${compact ? '' : ` · dallimi ${fmtSigned(factor.delta)}`}</span>
    <span class="snap-delta" aria-hidden="true"><strong>${arrowFor(factor.pct)} ${fmtPct(factor.pct)}</strong>${compact ? '' : '<span>ndryshim</span>'}</span>
  </div>`;
}

export function snapshotFooter(recentDays) {
  return `<p class="card-note">Bazuar në ${recentDays} ditët e fundit, krahasuar me normalen tënde.
    Për pesë matje shënohet rënia; për ngarkesën shënohet rritja — ky është i vetmi dallim, dhe është i njëjtë kudo në aplikacion.</p>`;
}

/* ---------- udhëtimi 30-ditor ---------- */

export function journeyBar(journey) {
  const labels = { done: 'regjistruar', missing: 'pa check-in', pending: 'sot, ende pa check-in', future: 'ende përpara' };
  const segments = journey.days.map(day =>
    `<i class="journey-seg is-${day.state === 'pending' ? 'future' : day.state}${day.isToday ? ' is-today' : ''}"
        title="${escapeHtml(`${formatDateLong(day.date)} · ${labels[day.state]}`)}"></i>`).join('');
  const summary = `${journey.done} ditë të regjistruara, ${journey.missing} pa check-in, ${journey.remaining} ende përpara, nga 30`;
  return `<div class="journey" role="img" aria-label="${escapeHtml(summary)}">${segments}</div>
    <div class="legend" aria-hidden="true">
      <span><i class="l-done"></i>regjistruar (${journey.done})</span>
      <span><i class="l-missing"></i>pa check-in (${journey.missing})</span>
      <span><i class="l-future"></i>ende përpara (${journey.remaining})</span>
    </div>`;
}

/* ---------- linja kohore 30-ditore ---------- */

export function dayTimeline(days, selectedDate) {
  const focusDate = selectedDate || days[days.length - 1].date;
  const cells = days.map(day => dayCell(day, day.date === selectedDate, day.date === focusDate)).join('');
  return `<div class="timeline" role="group" aria-label="30 ditët e fundit. Përdor shigjetat për të lëvizur, Enter për të hapur një ditë.">${cells}</div>`;
}

function dayCell(day, isSelected, isFocusable) {
  const classes = ['day'];
  if (!day.entry) classes.push('is-missing');
  else if (day.period === 'recent') classes.push('is-recent');
  else if (day.period === 'baseline') classes.push('is-base');
  if (day.isToday) classes.push('is-today');

  const parts = [formatDateLong(day.date), day.entry ? 'check-in i regjistruar' : 'pa check-in'];
  if (day.period === 'baseline') parts.push('pjesë e baseline-it');
  if (day.period === 'recent') parts.push('pjesë e 7 ditëve të fundit');
  if (day.isToday) parts.push('sot');

  return `<button type="button" class="${classes.join(' ')}" data-date="${day.date}"
    aria-pressed="${isSelected}" tabindex="${isFocusable ? '0' : '-1'}" aria-label="${escapeHtml(parts.join(', '))}">
    <small aria-hidden="true">${weekdayShort(day.date)}</small><span aria-hidden="true">${dayOfMonth(day.date)}</span>
  </button>`;
}

// Detajet e një dite shfaqen vetëm kur dita zgjidhet qëllimisht — edhe shënimi.
export function dayDetail(day) {
  if (!day) return '';
  if (!day.entry) {
    return `<div class="day-detail" role="region" aria-live="polite" aria-label="Detajet e ditës">
      <span class="eyebrow">${escapeHtml(formatDateLong(day.date))}</span>
      <p class="muted small mt-2">Nuk ka check-in për këtë ditë. Dita nuk numërohet në asnjë mesatare.</p>
    </div>`;
  }
  const entry = day.entry;
  const metrics = METRICS.map(metric => `<div class="day-metric">${metricIcon(metric)}<span>${METRIC_LABELS[metric]}</span>
    <b>${fmtValue(entry[metric])}${metric === 'sleep' && Number.isFinite(entry[metric]) ? ' orë' : ''}</b></div>`).join('');
  const tags = (entry.activities || []).length
    ? entry.activities.map(tag => `<span class="pill">${escapeHtml(tagLabel(tag))}</span>`).join(' ')
    : '<span class="tiny">Pa aktivitete të shënuara</span>';
  return `<div class="day-detail" role="region" aria-live="polite" aria-label="Detajet e ditës">
    <div class="row-between">
      <span class="eyebrow">${escapeHtml(formatDateLong(day.date))}</span>
      <span class="pill ${day.period === 'recent' ? 'pill-signal' : day.period === 'baseline' ? 'pill-accent' : ''}">${day.period === 'recent' ? '7 ditët e fundit' : day.period === 'baseline' ? 'baseline' : 'jashtë periudhave'}</span>
    </div>
    <div class="day-metrics">${metrics}</div>
    <div class="tag-wrap mt-3">${tags}</div>
    ${entry.note ? `<p class="day-note">${escapeHtml(entry.note)}</p>` : ''}
  </div>`;
}

// Tastiera: shigjetat lëvizin mes ditëve, lart/poshtë kalojnë një rresht të plotë.
export function wireTimeline(root, onSelect) {
  const grid = root.querySelector('.timeline');
  if (!grid) return;
  grid.addEventListener('click', event => {
    const cell = event.target.closest('.day');
    if (cell) onSelect(cell.dataset.date);
  });
  grid.addEventListener('keydown', event => {
    const cells = [...grid.querySelectorAll('.day')];
    const current = cells.indexOf(document.activeElement);
    if (current === -1) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next = current;
    if (event.key in moves) next = current + moves[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cells.length - 1;
    else return;
    event.preventDefault();
    next = Math.max(0, Math.min(cells.length - 1, next));
    cells[current].tabIndex = -1;
    cells[next].tabIndex = 0;
    cells[next].focus();
  });
}

/* ---------- etiketa e profilit ---------- */

export function modePill(profile) {
  return profile.mode === 'demo'
    ? `<span class="pill pill-lav">${icon('spark', 13)} Profil sintetik</span>`
    : `<span class="pill pill-accent">${icon('shield', 13)} Profil privat</span>`;
}
