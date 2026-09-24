// Grafika SVG të shkruara me dorë. Pa librari.
// Çdo funksion kthen HTML si tekst; ekranet e vendosin në faqe.
// Pikat që kanë tooltip mbajnë data-tip, data-x dhe data-y në koordinatat e viewBox-it.

import { clean } from './stats.js';
import { t } from './i18n/index.js';
import {
  escapeHtml, fmtNum, fmtValue, formatDateLong, formatDateShort, initials, truncate
} from './format.js';

export function scale(value, fromLow, fromHigh, toLow, toHigh) {
  if (fromHigh === fromLow) return (toLow + toHigh) / 2;
  return toLow + (value - fromLow) / (fromHigh - fromLow) * (toHigh - toLow);
}

// Ndan pikat në segmente aty ku mungon një vlerë, që vija të mos kërcejë mbi boshllëk.
function segments(points) {
  const result = [];
  let current = [];
  for (const point of points) {
    if (point === null) {
      if (current.length) result.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length) result.push(current);
  return result;
}

export function drawLine(points) {
  return segments(points)
    .map(group => group.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '))
    .join(' ');
}

// Katër shenja të barabarta nga minimumi te maksimumi i shkallës: 1·4·7·10 ose 3·6·9·12.
function ticksFor(range) {
  const step = (range.max - range.min) / 3;
  return [0, 1, 2, 3].map(index => range.min + step * index);
}

/* ---------- grafiku i My Normal ---------- */

/**
 * Një metrikë për 30 ditë: vija ditore me pika, mesatarja lëvizëse 7-ditore,
 * brezi i baseline-it (mesatarja ± devijimi), vija e saktë e mesatares
 * dhe zona e 7 ditëve të fundit. Boshti Y është gjithmonë shkalla e plotë e
 * metrikës, që ndryshimet të mos duken më të mëdha se ç'janë.
 */
export function metricChart(config) {
  const width = Math.max(280, Math.round(config.width));
  const height = Math.round(Math.min(320, Math.max(240, width * 0.46)));
  const frame = {
    width, height,
    left: 52, right: width - 14, top: 16, bottom: height - 46,
    count: config.values.length,
    range: config.range
  };
  if (clean(config.values).length < 2) return '';

  const x = index => (frame.count === 1
    ? (frame.left + frame.right) / 2
    : scale(index, 0, frame.count - 1, frame.left, frame.right));
  const y = value => scale(value, frame.range.min, frame.range.max, frame.bottom, frame.top);

  const body = [
    chartAxes(frame, config, x, y),
    baselineBand(frame, config, y),
    recentZone(frame, config, x),
    seriesLines(config, x, y),
    seriesPoints(config, x, y)
  ].join('');

  return `<div class="chart-wrap">
    <svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
         role="img" tabindex="0" aria-label="${escapeHtml(config.alt)}" aria-describedby="${config.summaryId}">
      <title>${escapeHtml(config.alt)}</title>${body}
    </svg>
    <div class="chart-tip" aria-hidden="true"></div>
  </div>`;
}

function chartAxes(frame, config, x, y) {
  const yTicks = ticksFor(frame.range).map(value => {
    const ty = y(value).toFixed(1);
    return `<line class="grid-line" x1="${frame.left}" y1="${ty}" x2="${frame.right}" y2="${ty}"/>
      <text class="axis-text" x="${frame.left - 8}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${fmtValue(value)}</text>`;
  }).join('');

  const last = frame.count - 1;
  const xIndexes = [...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last])];
  const xTicks = xIndexes.map(index => `
    <line class="axis-line" x1="${x(index).toFixed(1)}" y1="${frame.bottom}" x2="${x(index).toFixed(1)}" y2="${frame.bottom + 5}"/>
    <text class="axis-text" x="${x(index).toFixed(1)}" y="${frame.bottom + 18}"
          text-anchor="${index === 0 ? 'start' : index === last ? 'end' : 'middle'}">${escapeHtml(formatDateShort(config.dates[index]))}</text>`).join('');

  const middleY = ((frame.top + frame.bottom) / 2).toFixed(1);
  return `${yTicks}${xTicks}
    <line class="axis-line" x1="${frame.left}" y1="${frame.bottom}" x2="${frame.right}" y2="${frame.bottom}"/>
    <line class="axis-line" x1="${frame.left}" y1="${frame.top}" x2="${frame.left}" y2="${frame.bottom}"/>
    <text class="axis-title" x="14" y="${middleY}" text-anchor="middle" transform="rotate(-90 14 ${middleY})">${escapeHtml(config.yTitle)}</text>
    <text class="axis-title" x="${((frame.left + frame.right) / 2).toFixed(1)}" y="${frame.height - 6}" text-anchor="middle">Data</text>`;
}

function baselineBand(frame, config, y) {
  if (!Number.isFinite(config.baseMean)) return '';
  const spread = Number.isFinite(config.baseStd) ? config.baseStd : 0;
  const top = y(Math.min(frame.range.max, config.baseMean + spread));
  const bottom = y(Math.max(frame.range.min, config.baseMean - spread));
  const lineY = y(config.baseMean).toFixed(1);
  return `<rect class="band-base" x="${frame.left}" y="${top.toFixed(1)}" width="${frame.right - frame.left}" height="${Math.max(1, bottom - top).toFixed(1)}"/>
    <line class="line-base" x1="${frame.left}" y1="${lineY}" x2="${frame.right}" y2="${lineY}"/>`;
}

function recentZone(frame, config, x) {
  const recent = config.recentCount;
  if (!recent || frame.count <= recent) return '';
  const firstRecent = frame.count - recent;
  const start = (x(firstRecent - 1) + x(firstRecent)) / 2;
  return `<rect class="zone-recent" x="${start.toFixed(1)}" y="${frame.top}" width="${(frame.right - start).toFixed(1)}" height="${frame.bottom - frame.top}"/>
    <text class="axis-text" x="${(frame.right - 4).toFixed(1)}" y="${frame.top + 12}" text-anchor="end">${t('comp.chartRecent', { n: recent })}</text>`;
}

function seriesLines(config, x, y) {
  const daily = config.values.map((value, index) => (Number.isFinite(value) ? { x: x(index), y: y(value) } : null));
  const average = config.averages.map((value, index) => (Number.isFinite(value) ? { x: x(index), y: y(value) } : null));
  return `<path class="line-daily" d="${drawLine(daily)}"/>
    <path class="line-avg" d="${drawLine(average)}"/>`;
}

function seriesPoints(config, x, y) {
  const count = config.values.length;
  const band = count > 1 ? (x(1) - x(0)) : 40;
  return config.values.map((value, index) => {
    if (!Number.isFinite(value)) return '';
    const px = x(index).toFixed(1);
    const py = y(value).toFixed(1);
    const isRecent = index >= count - config.recentCount;
    const average = config.averages[index];
    const tip = `${formatDateLong(config.dates[index])} · ${config.metricLabel}: ${fmtValue(value)}${config.unit}`
      + ` · ${t('comp.chartAvg', { v: Number.isFinite(average) ? fmtNum(average) : t('comp.chartNoAvg') })}`;
    return `<g>
      <circle class="pt-focus" cx="${px}" cy="${py}" r="8"/>
      <circle class="pt${isRecent ? ' is-recent' : ''}" cx="${px}" cy="${py}" r="3.6"/>
      <rect class="hit" x="${(x(index) - band / 2).toFixed(1)}" y="0" width="${band.toFixed(1)}" height="100%"
            data-tip="${escapeHtml(tip)}" data-x="${px}" data-y="${py}"/>
    </g>`;
  }).join('');
}

/* ---------- të vegjël ---------- */

export function sparkline(values, options = {}) {
  const width = 100;
  const height = 26;
  const real = clean(values);
  if (real.length < 2) return '';
  const low = Math.min(...real);
  const high = Math.max(...real);
  const points = values.map((value, index) => (
    Number.isFinite(value)
      ? { x: scale(index, 0, Math.max(1, values.length - 1), 1, width - 1), y: scale(value, low, high, height - 3, 3) }
      : null
  ));
  const stroke = options.color || 'var(--cyan)';
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" style="height:26px">
    <path d="${drawLine(points)}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"
          stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// Rreth progresi për ndërtimin e baseline-it.
export function ringProgress(ratio, centerText, subText) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(1, Math.max(0, ratio));
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(`${centerText} ${subText || ''}`)}" style="width:112px;height:112px;display:block;flex-shrink:0">
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="9"/>
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="58" text-anchor="middle" fill="var(--text)" font-size="21" font-weight="700" font-family="system-ui, sans-serif">${escapeHtml(centerText)}</text>
    <text x="60" y="78" text-anchor="middle" fill="var(--text-3)" font-size="11" font-family="system-ui, sans-serif">${escapeHtml(subText || '')}</text>
  </svg>`;
}

/* ---------- Patterns ---------- */

/** Harta e lidhjeve mes metrikave: sa më e trashë vija, aq më e fortë lidhja. */
export function relationshipChart(links, labels) {
  const size = 300;
  const center = size / 2;
  const radius = 96;
  const names = Object.keys(labels);
  const positions = {};
  names.forEach((name, index) => {
    const angle = (index / names.length) * Math.PI * 2 - Math.PI / 2;
    positions[name] = { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });

  const edges = links.filter(link => link.strong).map(link => {
    const from = positions[link.a];
    const to = positions[link.b];
    const color = link.r > 0 ? 'var(--accent)' : 'var(--lavender)';
    const tip = `${labels[link.a]} ↔ ${labels[link.b]} · r = ${fmtNum(link.r, 2)} · ${t('comp.chartDays', { n: link.n })}`;
    return `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"
      stroke="${color}" stroke-width="${(1 + Math.abs(link.r) * 4).toFixed(2)}" stroke-linecap="round" opacity="0.85"
      data-tip="${escapeHtml(tip)}" data-x="${((from.x + to.x) / 2).toFixed(1)}" data-y="${((from.y + to.y) / 2).toFixed(1)}"/>`;
  }).join('');

  const nodes = names.map(name => {
    const position = positions[name];
    const above = position.y < center;
    return `<circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="6.5" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/>
      <text x="${position.x.toFixed(1)}" y="${(position.y + (above ? -13 : 21)).toFixed(1)}" class="wall-label">${escapeHtml(labels[name])}</text>`;
  }).join('');

  return `<div class="chart-wrap" style="max-width:360px;margin:0 auto">
    <svg class="chart" viewBox="0 0 ${size} ${size}" role="img" tabindex="0" aria-label="${t('comp.mapLabel')}">
      <title>${t('comp.mapLabel')}</title>${edges}${nodes}
    </svg>
    <div class="chart-tip" aria-hidden="true"></div>
  </div>`;
}

/**
 * Grafik shpërndarjeje për dy metrika. Ditët me të njëjtat vlera nuk mbulojnë njëra-tjetrën:
 * bashkohen në një rreth më të madh dhe tooltip-i tregon sa ditë janë.
 */
export function scatterPlot(config) {
  if (config.points.length < 3) return '';
  const width = 300;
  const height = 236;
  const frame = { left: 46, right: width - 12, top: 12, bottom: height - 46 };
  const x = value => scale(value, config.xRange.min, config.xRange.max, frame.left, frame.right);
  const y = value => scale(value, config.yRange.min, config.yRange.max, frame.bottom, frame.top);

  const groups = new Map();
  for (const point of config.points) {
    const key = `${point.x}|${point.y}`;
    groups.set(key, { x: point.x, y: point.y, count: (groups.get(key) || { count: 0 }).count + 1 });
  }

  const dots = [...groups.values()].map(group => {
    const px = x(group.x).toFixed(1);
    const py = y(group.y).toFixed(1);
    const radius = 3.5 + 2 * Math.sqrt(group.count - 1);
    const tip = `${config.xLabel}: ${fmtValue(group.x)} · ${config.yLabel}: ${fmtValue(group.y)} · ${t('comp.chartDays', { n: group.count })}`;
    return `<g><circle class="pt-focus" cx="${px}" cy="${py}" r="${(radius + 4).toFixed(1)}"/>
      <circle class="scatter-pt" cx="${px}" cy="${py}" r="${radius.toFixed(1)}" data-tip="${escapeHtml(tip)}" data-x="${px}" data-y="${py}"/></g>`;
  }).join('');

  return `<div class="chart-wrap">
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="${escapeHtml(config.alt)}">
      <title>${escapeHtml(config.alt)}</title>
      ${scatterAxes(frame, config, x, y, width, height)}${dots}
    </svg>
    <div class="chart-tip" aria-hidden="true"></div>
  </div>`;
}

function scatterAxes(frame, config, x, y, width, height) {
  const xTicks = [config.xRange.min, (config.xRange.min + config.xRange.max) / 2, config.xRange.max];
  const yTicks = [config.yRange.min, (config.yRange.min + config.yRange.max) / 2, config.yRange.max];
  const middleY = ((frame.top + frame.bottom) / 2).toFixed(1);
  return `
    <line class="axis-line" x1="${frame.left}" y1="${frame.bottom}" x2="${frame.right}" y2="${frame.bottom}"/>
    <line class="axis-line" x1="${frame.left}" y1="${frame.top}" x2="${frame.left}" y2="${frame.bottom}"/>
    ${xTicks.map(value => `<text class="axis-text" x="${x(value).toFixed(1)}" y="${frame.bottom + 16}" text-anchor="middle">${fmtValue(value)}</text>`).join('')}
    ${yTicks.map(value => `<text class="axis-text" x="${frame.left - 7}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${fmtValue(value)}</text>`).join('')}
    <text class="axis-title" x="${((frame.left + frame.right) / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${escapeHtml(config.xTitle)}</text>
    <text class="axis-title" x="13" y="${middleY}" text-anchor="middle" transform="rotate(-90 13 ${middleY})">${escapeHtml(config.yTitle)}</text>`;
}

/* ---------- Connection Wall ---------- */

/**
 * Ti në qendër, deri në pesë persona rreth teje. Të gjitha vijat janë të njëjta:
 * muri vetëm organizon, nuk mat as nuk krahason lidhjet.
 */
export function wallChart(people) {
  if (people.length === 0) return '';
  const width = 520;
  const height = 450;
  const center = { x: width / 2, y: 196 };
  const radius = 148;

  const nodes = people.map((person, index) => {
    const angle = (index / people.length) * Math.PI * 2 - Math.PI / 2;
    const nx = center.x + Math.cos(angle) * radius;
    const ny = center.y + Math.sin(angle) * radius;
    const tip = `${person.name} · ${person.relation || t('comp.noRelation')} · ${person.lastLabel}`;
    return `<line class="wall-line" x1="${center.x}" y1="${center.y}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"/>
      <g data-tip="${escapeHtml(tip)}" data-x="${nx.toFixed(1)}" data-y="${(ny - 26).toFixed(1)}">
        <circle class="pt-focus" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="30"/>
        <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="24" fill="${escapeHtml(person.color)}"/>
        <text x="${nx.toFixed(1)}" y="${(ny + 5).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${escapeHtml(initials(person.name))}</text>
        <text class="wall-label" x="${nx.toFixed(1)}" y="${(ny + 42).toFixed(1)}">${escapeHtml(truncate(person.name, 16))}</text>
        <text class="wall-sub" x="${nx.toFixed(1)}" y="${(ny + 56).toFixed(1)}">${escapeHtml(truncate(person.relation || '—', 20))}</text>
        <text class="wall-sub" x="${nx.toFixed(1)}" y="${(ny + 69).toFixed(1)}">${escapeHtml(person.lastLabel)}</text>
      </g>`;
  }).join('');

  return `<div class="chart-wrap">
    <svg class="wall-svg" viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="${escapeHtml(t('comp.wallLabel', { n: people.length, people: people.length === 1 ? t('comp.person') : t('comp.persons') }))}">
      <title>Connection Wall</title>
      ${nodes}
      <circle class="wall-center" cx="${center.x}" cy="${center.y}" r="30"/>
      <text x="${center.x}" y="${center.y + 5}" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${t('comp.you')}</text>
    </svg>
    <div class="chart-tip" aria-hidden="true"></div>
  </div>`;
}
