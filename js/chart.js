// Grafika SVG të shkruara me dorë. Pa librari.
// Çdo funksion kthen një varg HTML; vizatimi ndodh te ekranet.
// Të gjitha SVG-të ruajnë raportin e faqeve, prandaj një raport i vetëm
// (gjerësia e dukshme / gjerësia e viewBox-it) mjafton për të vendosur tooltip-in.

import { clean } from './stats.js';

export function scale(value, fromLow, fromHigh, toLow, toHigh) {
  if (fromHigh === fromLow) return (toLow + toHigh) / 2;
  return toLow + (value - fromLow) / (fromHigh - fromLow) * (toHigh - toLow);
}

// Ndan pikat në segmente aty ku mungon një ditë, që vija të mos kërcejë mbi boshllëk.
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

function pathLength(points) {
  let total = 0;
  for (const group of segments(points)) {
    for (let index = 1; index < group.length; index++) {
      total += Math.hypot(group[index].x - group[index - 1].x, group[index].y - group[index - 1].y);
    }
  }
  return Math.max(1, Math.round(total));
}

/**
 * Grafiku i trendit: vija kryesore, ditët e fundit me ngjyrë tjetër,
 * vija e ndërprerë në nivelin e baseline-it.
 */
export function trendChart(config) {
  const values = config.values;
  const dates = config.dates || [];
  const recentCount = config.recentCount || 0;
  const baseline = Number.isFinite(config.baseline) ? config.baseline : null;
  const unit = config.unit || '';
  const width = 600;
  const height = config.height || 180;
  const pad = { top: 14, right: 10, bottom: 24, left: 34 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const real = clean(values);
  if (real.length < 2) return '';

  let low = Math.min(...real, baseline === null ? Infinity : baseline);
  let high = Math.max(...real, baseline === null ? -Infinity : baseline);
  const margin = (high - low) * 0.18 || 0.5;
  low -= margin;
  high += margin;

  const points = values.map((value, index) => (
    Number.isFinite(value)
      ? {
          x: scale(index, 0, Math.max(1, values.length - 1), pad.left, pad.left + innerWidth),
          y: scale(value, low, high, pad.top + innerHeight, pad.top),
          value,
          index
        }
      : null
  ));

  const splitIndex = Math.max(1, values.length - recentCount);
  const basePoints = points.slice(0, splitIndex);
  const recentPoints = recentCount > 0 ? points.slice(splitIndex - 1) : [];

  const gridLines = [0, 0.5, 1].map(ratio => {
    const y = pad.top + innerHeight * ratio;
    const label = high - (high - low) * ratio;
    return `<line class="grid-line" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}"/>`
      + `<text class="axis-text" x="${pad.left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${label.toFixed(1)}</text>`;
  }).join('');

  let baseLine = '';
  if (baseline !== null) {
    const y = scale(baseline, low, high, pad.top + innerHeight, pad.top).toFixed(1);
    baseLine = `<line class="line-base" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>`;
  }

  const bandWidth = innerWidth / Math.max(1, values.length - 1);
  const hits = points.filter(Boolean).map(point => {
    const tip = `${shortDate(dates[point.index])} · ${point.value}${unit ? ' ' + unit : ''}`;
    return `<g><circle class="dot-mark" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"/>`
      + `<rect class="dot-hit" x="${(point.x - bandWidth / 2).toFixed(1)}" y="${pad.top}" width="${bandWidth.toFixed(1)}" height="${innerHeight}"`
      + ` data-tip="${escapeHtml(tip)}" data-x="${point.x.toFixed(1)}" data-y="${point.y.toFixed(1)}"></rect></g>`;
  }).join('');

  return `<div class="chart-wrap">
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(config.alt || 'Grafik trendi')}">
      <title>${escapeHtml(config.alt || 'Grafik trendi')}</title>
      ${gridLines}${baseLine}
      <path class="line-main draw-in" style="--len:${pathLength(basePoints)}" d="${drawLine(basePoints)}"/>
      ${recentPoints.length ? `<path class="line-recent draw-in" style="--len:${pathLength(recentPoints)}" d="${drawLine(recentPoints)}"/>` : ''}
      ${hits}
      <text class="axis-text" x="${pad.left}" y="${height - 6}">${shortDate(dates[0])}</text>
      <text class="axis-text" x="${width - pad.right}" y="${height - 6}" text-anchor="end">${shortDate(dates[dates.length - 1])}</text>
    </svg>
    <div class="chart-tip" role="status" aria-live="polite"></div>
  </div>`;
}

export function sparkline(values, options = {}) {
  const width = 100;
  const height = 26;
  const real = clean(values);
  if (real.length < 2) return '';
  const low = Math.min(...real);
  const high = Math.max(...real);
  const points = values.map((value, index) => (
    Number.isFinite(value)
      ? {
          x: scale(index, 0, Math.max(1, values.length - 1), 1, width - 1),
          y: scale(value, low, high, height - 3, 3)
        }
      : null
  ));
  const stroke = options.color || 'var(--cyan)';
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${drawLine(points)}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// Rreth progresi për ndërtimin e baseline-it.
export function ringProgress(ratio, centerText, subText) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(1, Math.max(0, ratio));
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(subText || 'Progres')}" style="width:120px;height:120px;display:block">
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--teal)" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="58" text-anchor="middle" fill="var(--text)" font-size="22" font-weight="700">${escapeHtml(centerText)}</text>
    <text x="60" y="78" text-anchor="middle" fill="var(--text-3)" font-size="10">${escapeHtml(subText || '')}</text>
  </svg>`;
}

/** Harta e lidhjeve mes metrikave. Nyjet në rreth, vijat sa më të trasha aq më e fortë lidhja. */
export function relationshipChart(links, labels) {
  const size = 300;
  const center = size / 2;
  const radius = 98;
  const names = Object.keys(labels);
  const positions = {};
  names.forEach((name, index) => {
    const angle = (index / names.length) * Math.PI * 2 - Math.PI / 2;
    positions[name] = { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });

  const edges = links.filter(link => link.strong).map(link => {
    const from = positions[link.a];
    const to = positions[link.b];
    const thickness = 1 + Math.abs(link.r) * 4;
    const color = link.r > 0 ? 'var(--teal)' : 'var(--lavender)';
    const tip = `${labels[link.a]} ↔ ${labels[link.b]} · r = ${link.r.toFixed(2)} · ${link.n} ditë`;
    return `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"
      stroke="${color}" stroke-width="${thickness.toFixed(2)}" stroke-linecap="round" opacity="0.8"
      data-tip="${escapeHtml(tip)}" data-x="${((from.x + to.x) / 2).toFixed(1)}" data-y="${((from.y + to.y) / 2).toFixed(1)}"/>`;
  }).join('');

  const nodes = names.map(name => {
    const position = positions[name];
    const above = position.y < center;
    return `<g><circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="7" fill="var(--surface)" stroke="var(--cyan)" stroke-width="2.5"/>
      <text x="${position.x.toFixed(1)}" y="${(position.y + (above ? -14 : 21)).toFixed(1)}" class="wall-label">${escapeHtml(labels[name])}</text></g>`;
  }).join('');

  return `<div class="chart-wrap" style="max-width:340px;margin:0 auto">
    <svg class="chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="Harta e lidhjeve mes gjashtë matjeve">
      <title>Harta e lidhjeve mes gjashtë matjeve</title>
      ${edges}${nodes}
    </svg>
    <div class="chart-tip" role="status" aria-live="polite"></div>
  </div>`;
}

/** Connection Wall: ti në qendër, deri në pesë persona rreth teje. */
export function wallChart(people, gaps) {
  const size = 340;
  const center = size / 2;
  const radius = 112;
  if (people.length === 0) return '';

  const nodes = people.map((person, index) => {
    const angle = (index / people.length) * Math.PI * 2 - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const gap = gaps[person.name];
    const fresh = gap !== null && gap !== undefined && gap <= 7;
    const gapText = gap === null || gap === undefined ? 'pa datë' : `${gap} ditë më parë`;
    const tip = `${person.name} · ${person.relation || 'i njohur'} · ${gapText}`;
    return `<g class="wall-node" data-tip="${escapeHtml(tip)}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}">
      <line class="wall-link${fresh ? ' is-fresh' : ''}" x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
            stroke-dasharray="${fresh ? '0' : '4 5'}"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" fill="${escapeHtml(person.color || '#0d9488')}"/>
      <text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">${escapeHtml(initials(person.name))}</text>
      <text class="wall-label" x="${x.toFixed(1)}" y="${(y + 38).toFixed(1)}">${escapeHtml(person.name)}</text>
      <text class="wall-sub" x="${x.toFixed(1)}" y="${(y + 50).toFixed(1)}">${escapeHtml(gapText)}</text>
    </g>`;
  }).join('');

  return `<div class="chart-wrap" style="max-width:380px;margin:0 auto">
    <svg class="wall-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Harta e lidhjeve të tua">
      <title>Harta e lidhjeve të tua</title>
      ${nodes}
      <circle cx="${center}" cy="${center}" r="29" fill="var(--surface)" stroke="var(--teal)" stroke-width="2.5"/>
      <text x="${center}" y="${center + 5}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700">TI</text>
    </svg>
    <div class="chart-tip" role="status" aria-live="polite"></div>
  </div>`;
}

// Yjësia dekorative e hero-s: pika të lidhura, motivi vizual i projektit.
export function constellation() {
  const dots = [[6, 72], [21, 40], [35, 60], [51, 28], [65, 48], [80, 22], [94, 54]];
  const lines = dots.slice(1).map((dot, index) =>
    `<line x1="${dots[index][0]}" y1="${dots[index][1]}" x2="${dot[0]}" y2="${dot[1]}" stroke="var(--teal)" stroke-width="0.35" opacity="0.45"/>`
  ).join('');
  const circles = dots.map(([x, y], index) =>
    `<circle cx="${x}" cy="${y}" r="${index % 3 === 0 ? 1.5 : 0.9}" fill="var(--teal)" opacity="0.6"/>`
  ).join('');
  return `<svg class="hero-constellation" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${lines}${circles}</svg>`;
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map(part => part.charAt(0).toUpperCase()).join('');
  return letters || '?';
}

export function shortDate(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : String(iso);
}

export function escapeHtml(text) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text === null || text === undefined ? '' : text)
    .replace(/[&<>"']/g, character => replacements[character]);
}
