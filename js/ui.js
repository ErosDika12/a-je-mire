// Pjesët e përbashkëta të ndërfaqes: ikona, toast, temë, tooltip, dialogje.
import { escapeHtml } from './format.js';

// ---------- ikonat ----------
// Të gjitha 24x24, e njëjta trashësi vije, ngjyra vjen nga teksti përreth (currentColor).
const ICON_PATHS = {
  // gjashtë metrikat
  mood: '<path d="M4 16.5a8 8 0 0 1 16 0"/><path d="m12 16.5 3.4-4"/><circle cx="12" cy="16.5" r="1.1"/>',
  sleep: '<path d="M18.6 14.8A7.4 7.4 0 1 1 9.2 5.4a5.9 5.9 0 0 0 9.4 9.4z"/>',
  energy: '<path d="M13.2 3 5.8 13.4h5.4L10.4 21l7.6-10.6h-5.6z"/>',
  social: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  joy: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5"/>',
  load: '<path d="M12 4 3.5 8.3 12 12.6l8.5-4.3z"/><path d="m3.5 12.4 8.5 4.3 8.5-4.3"/><path d="m3.5 16.3 8.5 4.3 8.5-4.3"/>',
  // navigimi
  today: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.4"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="15" r="1.5"/>',
  normal: '<path d="M3 12h3.6l2.6-7 3.6 14 2.6-7H21"/>',
  patterns: '<path d="M4 4v16h16"/><circle cx="9" cy="14.5" r="1.3"/><circle cx="12.5" cy="11" r="1.3"/><circle cx="16" cy="8.5" r="1.3"/><circle cx="18.5" cy="13" r="1.3"/>',
  connect: '<circle cx="12" cy="12" r="2.8"/><circle cx="5" cy="6" r="2.1"/><circle cx="19" cy="6" r="2.1"/><circle cx="12" cy="20" r="2.1"/><path d="m6.7 7.3 3.1 2.8M17.3 7.3l-3.1 2.8M12 14.8v3.1"/>',
  shift: '<path d="M3 17.5 9 11l3.6 3.6L21 6"/><path d="M15.4 6H21v5.6"/>',
  why: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6"/><path d="M12 16.6h.01"/>',
  spark: '<path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z"/>',
  privacy: '<rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  // veprime
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  users: '<circle cx="9" cy="8.4" r="3.4"/><path d="M3.4 20a5.9 5.9 0 0 1 11.2 0"/><path d="M16.2 5.4a3.4 3.4 0 0 1 0 6.3"/><path d="M17.6 14.6A5.9 5.9 0 0 1 21 20"/>',
  coffee: '<path d="M4 8.5h12v5.8a4.6 4.6 0 0 1-4.6 4.6H8.6A4.6 4.6 0 0 1 4 14.3z"/><path d="M16 10.2h1.6a2.4 2.4 0 0 1 0 4.8H16"/><path d="M7 3.4v2.2M11 3.4v2.2"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"/>',
  moon: '<path d="M20 13.4A8.4 8.4 0 1 1 10.6 4a6.8 6.8 0 0 0 9.4 9.4"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  close: '<path d="M6 6 18 18M18 6 6 18"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  play: '<path d="M8 5.6 18 12 8 18.4z"/>',
  copy: '<rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.6H6.4a2.4 2.4 0 0 0-2.4 2.4v9"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  trash: '<path d="M4.6 6.6h14.8"/><path d="M9.4 6.6V4.8h5.2v1.8"/><path d="M6.8 6.6 7.7 20h8.6l.9-13.4"/>',
  edit: '<path d="m15.6 4.6 3.8 3.8L8.6 19.2 4 20.4l1.2-4.6z"/>',
  download: '<path d="M12 4v10.6"/><path d="m7.6 10.6 4.4 4.4 4.4-4.4"/><path d="M4.6 19.4h14.8"/>',
  upload: '<path d="M12 19.4V8.8"/><path d="m7.6 12.8 4.4-4.4 4.4 4.4"/><path d="M4.6 4.6h14.8"/>',
  shield: '<path d="M12 3.2 5 6v6c0 4.3 3 7.4 7 8.8 4-1.4 7-4.5 7-8.8V6z"/><path d="m9.2 11.8 2 2 3.6-3.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.4M12 7.8h.01"/>',
  refresh: '<path d="M20 11.6A8 8 0 1 0 18.4 17"/><path d="M20.4 4.6v5.2h-5.2"/>',
  calendar: '<rect x="4" y="5.6" width="16" height="14.4" rx="2.4"/><path d="M4 10.4h16M8.6 3.6v3.6M15.4 3.6v3.6"/>'
};

export function icon(name, size = 18) {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

// Ikona e metrikës në një katror të vogël. Gjithmonë shoqërohet me emrin me tekst,
// prandaj vetë ikona fshihet nga lexuesit e ekranit.
export function metricIcon(metric, variant = '') {
  return `<span class="metric-ic ${variant ? 'is-' + variant : ''}">${icon(metric, 18)}</span>`;
}

// ---------- tema ----------

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const dark = theme === 'dark'
      || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    meta.setAttribute('content', dark ? '#0d1219' : '#f3f4f1');
  }
}

export function nextTheme(current) {
  if (current === 'auto') return 'light';
  if (current === 'light') return 'dark';
  return 'auto';
}

export function themeLabel(theme) {
  if (theme === 'light') return 'Temë e çelët';
  if (theme === 'dark') return 'Temë e errët';
  return 'Tema sipas sistemit';
}

export function themeIcon(theme) {
  if (theme === 'dark') return 'moon';
  if (theme === 'light') return 'sun';
  return 'auto';
}

// ---------- toast ----------

let toastTimer = null;

export function toast(message, kind = 'info') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const className = kind === 'ok' ? 'toast-ok' : kind === 'err' ? 'toast-err' : '';
  host.innerHTML = `<div class="toast ${className}">${icon(kind === 'err' ? 'info' : 'check', 16)}<span>${escapeHtml(message)}</span></div>`;
  const live = document.getElementById('live-region');
  if (live) live.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 3200);
}

// ---------- tooltip për grafikat: mi, prekje dhe tastierë ----------

export function mountChartTips(root) {
  for (const wrap of root.querySelectorAll('.chart-wrap')) {
    const tip = wrap.querySelector('.chart-tip');
    const svg = wrap.querySelector('svg');
    if (!tip || !svg || wrap.dataset.tips === 'on') continue;
    wrap.dataset.tips = 'on';
    wireChart(wrap, svg, tip);
  }
}

function wireChart(wrap, svg, tip) {
  const targets = [...svg.querySelectorAll('[data-tip]')];
  if (targets.length === 0) return;
  let active = -1;

  const show = index => {
    active = index;
    placeTip(wrap, svg, tip, targets[index]);
    for (const mark of svg.querySelectorAll('.pt-focus.is-on')) mark.classList.remove('is-on');
    const target = targets[index];
    const mark = target.querySelector('.pt-focus')
      || (target.parentElement.tagName.toLowerCase() === 'g' ? target.parentElement.querySelector('.pt-focus') : null);
    if (mark) mark.classList.add('is-on');
  };
  const hide = () => {
    tip.classList.remove('is-on');
    for (const mark of svg.querySelectorAll('.pt-focus.is-on')) mark.classList.remove('is-on');
  };

  wrap.addEventListener('pointermove', event => {
    const index = targets.indexOf(event.target.closest('[data-tip]'));
    if (index !== -1) show(index);
  });
  wrap.addEventListener('pointerdown', event => {
    const index = targets.indexOf(event.target.closest('[data-tip]'));
    if (index !== -1) show(index);
  });
  wrap.addEventListener('pointerleave', () => { if (document.activeElement !== svg) hide(); });

  // Tastiera: shigjetat lëvizin nga një pikë te tjetra, Home/End te skajet.
  svg.addEventListener('focus', () => show(active === -1 ? targets.length - 1 : active));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', event => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      show(Math.min(targets.length - 1, Math.max(0, (active === -1 ? 0 : active) + moves[event.key])));
    } else if (event.key === 'Home') { event.preventDefault(); show(0); }
    else if (event.key === 'End') { event.preventDefault(); show(targets.length - 1); }
    else if (event.key === 'Escape') hide();
  });
}

function placeTip(wrap, svg, tip, target) {
  const box = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const x = rect.left - wrapRect.left + parseFloat(target.dataset.x) * (rect.width / (box.width || 1));
  const y = rect.top - wrapRect.top + parseFloat(target.dataset.y) * (rect.height / (box.height || 1));

  tip.textContent = target.dataset.tip;
  tip.classList.add('is-on');
  const half = tip.offsetWidth / 2 + 4;
  const left = Math.min(Math.max(x, half), Math.max(half, wrap.clientWidth - half));
  tip.style.left = `${left}px`;
  // Kur nuk ka vend sipër pikës, tooltip-i shfaqet poshtë saj që të mos pritet.
  if (y - tip.offsetHeight - 14 < 0) {
    tip.style.top = `${y + 14}px`;
    tip.style.transform = 'translate(-50%, 0)';
  } else {
    tip.style.top = `${y - 12}px`;
    tip.style.transform = 'translate(-50%, -100%)';
  }
}

// ---------- dialogje dhe fletë ----------

let openLayer = null;

export function closeLayer() {
  if (!openLayer) return;
  const { backdrop, panel, lastFocus, onKey } = openLayer;
  document.removeEventListener('keydown', onKey);
  backdrop.remove();
  panel.remove();
  openLayer = null;
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
}

function openLayerWith(panel) {
  closeLayer();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', closeLayer);
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeLayer(); }
    if (event.key === 'Tab') trapFocus(event, panel);
  };
  document.body.append(backdrop, panel);
  openLayer = { backdrop, panel, lastFocus: document.activeElement, onKey };
  document.addEventListener('keydown', onKey);
  const first = panel.querySelector('input, textarea, select, button:not([data-close]), [tabindex]') || panel.querySelector('button');
  if (first) first.focus();
  return panel;
}

function trapFocus(event, panel) {
  const items = [...panel.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), textarea, select, [tabindex]:not([tabindex="-1"])')];
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function openModal(title, bodyHtml) {
  const panel = document.createElement('div');
  panel.className = 'modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = `<div class="modal-head"><h3>${escapeHtml(title)}</h3>
    <button type="button" class="icon-btn" data-close aria-label="Mbyll">${icon('close')}</button></div>${bodyHtml}`;
  panel.querySelector('[data-close]').addEventListener('click', closeLayer);
  return openLayerWith(panel);
}

export function openSheet(title, bodyHtml) {
  const panel = document.createElement('div');
  panel.className = 'sheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>
    <p class="eyebrow" style="margin-bottom:var(--s2)">${escapeHtml(title)}</p>${bodyHtml}`;
  return openLayerWith(panel);
}

export function confirmDialog(title, bodyText, confirmLabel, onConfirm) {
  const panel = openModal(title, `
    <p class="muted small">${escapeHtml(bodyText)}</p>
    <div class="row mt-5" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>Anulo</button>
      <button type="button" class="btn btn-danger" data-confirm>${escapeHtml(confirmLabel)}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', () => { closeLayer(); onConfirm(); });
}

// ---------- clipboard ----------

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Rezervë për shfletuesit pa leje për clipboard.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (innerError) { done = false; }
    field.remove();
    return done;
  }
}
