// Pjesët e përbashkëta të ndërfaqes: ikona, toast, temë, tooltip, modale.
import { escapeHtml } from './chart.js';

// ---------- ikonat ----------
// Vija të vizatuara me dorë, 24x24, gjithmonë me ngjyrën e tekstit përreth.
const ICON_PATHS = {
  home: '<path d="M3 10.6 12 3.4l9 7.2"/><path d="M5.6 9.4V20h12.8V9.4"/><path d="M9.8 20v-5.2h4.4V20"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  pulse: '<path d="M3 12h3.6l2.6-7 3.6 14 2.6-7H21"/>',
  shift: '<path d="M3 17.5 9 11l3.6 3.6L21 6"/><path d="M15.4 6H21v5.6"/>',
  why: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6"/><path d="M12 16.6h.01"/>',
  spark: '<path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z"/><path d="M18.5 15.5 19.4 18l2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>',
  users: '<circle cx="9" cy="8.4" r="3.4"/><path d="M3.4 20a5.9 5.9 0 0 1 11.2 0"/><path d="M16.2 5.4a3.4 3.4 0 0 1 0 6.3"/><path d="M17.6 14.6A5.9 5.9 0 0 1 21 20"/>',
  coffee: '<path d="M4 8.5h12v5.8a4.6 4.6 0 0 1-4.6 4.6H8.6A4.6 4.6 0 0 1 4 14.3z"/><path d="M16 10.2h1.6a2.4 2.4 0 0 1 0 4.8H16"/><path d="M7 3.4v2.2M11 3.4v2.2"/>',
  network: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5.6" r="2.3"/><circle cx="19" cy="5.6" r="2.3"/><circle cx="19" cy="18.4" r="2.3"/><circle cx="5" cy="18.4" r="2.3"/><path d="m6.7 7.1 3.1 3M17.3 7.1l-3.1 3M17.3 16.9l-3.1-3M6.7 16.9l3.1-3"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"/>',
  moon: '<path d="M20 13.4A8.4 8.4 0 1 1 10.6 4a6.8 6.8 0 0 0 9.4 9.4"/>',
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
  send: '<path d="M4.4 12 20 4.6l-3.4 15.4-4.8-5.2z"/><path d="M11.8 14.8 20 4.6"/>',
  calendar: '<rect x="4" y="5.6" width="16" height="14.4" rx="2.4"/><path d="M4 10.4h16M8.6 3.6v3.6M15.4 3.6v3.6"/>'
};

export function icon(name, size = 18) {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
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
    meta.setAttribute('content', dark ? '#080d18' : '#f5f7fb');
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
  return 'Sipas sistemit';
}

export function themeIcon(theme) {
  return theme === 'dark' ? 'moon' : 'sun';
}

// ---------- toast ----------

let toastTimer = null;

export function toast(message, kind = 'info') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  host.innerHTML = `<div class="toast ${kind === 'ok' ? 'toast-ok' : kind === 'err' ? 'toast-err' : ''}">
    ${icon(kind === 'err' ? 'info' : 'check', 16)}<span>${escapeHtml(message)}</span></div>`;
  const live = document.getElementById('live-region');
  if (live) live.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 3200);
}

// ---------- tooltip për grafikat ----------

export function mountChartTips(root) {
  for (const wrap of root.querySelectorAll('.chart-wrap')) {
    const tip = wrap.querySelector('.chart-tip');
    const svg = wrap.querySelector('svg');
    if (!tip || !svg) continue;

    let activeMark = null;
    const hide = () => {
      tip.classList.remove('is-on');
      if (activeMark) activeMark.classList.remove('is-on');
      activeMark = null;
    };

    const show = target => {
      const box = svg.viewBox.baseVal;
      const ratio = svg.getBoundingClientRect().width / (box.width || 1);
      tip.textContent = target.getAttribute('data-tip');
      const rawX = parseFloat(target.getAttribute('data-x')) * ratio;
      const rawY = parseFloat(target.getAttribute('data-y')) * ratio;
      const half = tip.offsetWidth / 2 + 4;
      const limit = wrap.clientWidth - half;
      tip.style.left = `${Math.min(Math.max(rawX, half), Math.max(half, limit))}px`;
      tip.style.top = `${Math.max(rawY - 12, 4)}px`;
      tip.style.transform = 'translate(-50%, -100%)';
      tip.classList.add('is-on');
      if (activeMark) activeMark.classList.remove('is-on');
      activeMark = target.parentElement ? target.parentElement.querySelector('.dot-mark') : null;
      if (activeMark) activeMark.classList.add('is-on');
    };

    wrap.addEventListener('pointermove', event => {
      const target = event.target.closest('[data-tip]');
      if (target) show(target);
      else hide();
    });
    wrap.addEventListener('pointerdown', event => {
      const target = event.target.closest('[data-tip]');
      if (target) show(target);
    });
    wrap.addEventListener('pointerleave', hide);
  }
}

// ---------- modale dhe fletë ----------

let openLayer = null;

export function closeLayer() {
  if (!openLayer) return;
  const { backdrop, panel, lastFocus, onKey } = openLayer;
  document.removeEventListener('keydown', onKey);
  backdrop.remove();
  panel.remove();
  openLayer = null;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
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
  const first = panel.querySelector('input, textarea, select, button, [tabindex]');
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
  panel.innerHTML = `<div class="sheet-grip"></div><p class="sheet-title">${escapeHtml(title)}</p>${bodyHtml}`;
  return openLayerWith(panel);
}

// ---------- ndihmës të vegjël ----------

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Rezervë për shfletuesit pa clipboard API ose pa leje.
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

export function formatDateLong(iso) {
  if (!iso) return '—';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const months = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
    'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]} ${parts[0]}`;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return 'Mirëmëngjes';
  if (hour < 18) return 'Mirëdita';
  return 'Mirëmbrëma';
}
