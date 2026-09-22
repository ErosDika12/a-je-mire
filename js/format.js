// Formatimi i numrave dhe datave në një vend të vetëm, që çdo ekran të shfaqë
// njësoj. Asnjë funksion këtu nuk kthen kurrë "NaN", "Infinity" ose "undefined":
// kur vlera mungon, kthehet një vizë.

const MINUS = '−';
const EMPTY = '—';

const MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
const MONTHS_SHORT = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gus', 'sht', 'tet', 'nën', 'dhj'];
const WEEKDAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function fmtNum(value, decimals = 1) {
  if (!isNumber(value)) return EMPTY;
  const fixed = Math.abs(value).toFixed(decimals);
  // -0.0 nuk shfaqet me shenjë minus.
  if (Number(fixed) === 0) return (0).toFixed(decimals);
  return (value < 0 ? MINUS : '') + fixed;
}

export function fmtSigned(value, decimals = 1) {
  if (!isNumber(value)) return EMPTY;
  const fixed = Math.abs(value).toFixed(decimals);
  if (Number(fixed) === 0) return (0).toFixed(decimals);
  return (value < 0 ? MINUS : '+') + fixed;
}

export function fmtPct(value, decimals = 1) {
  const text = fmtSigned(value, decimals);
  return text === EMPTY ? EMPTY : `${text}%`;
}

// Vlera e një dite ashtu siç u regjistrua: 7 mbetet 7, 7.5 mbetet 7.5.
export function fmtValue(value) {
  if (!isNumber(value)) return EMPTY;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function fmtMetric(metric, value) {
  const text = fmtNum(value, 1);
  if (text === EMPTY) return EMPTY;
  return metric === 'sleep' ? `${text} orë` : text;
}

// Shigjeta tregon vetëm drejtimin numerik; nën 1% quhet e qëndrueshme.
export function arrowFor(pct) {
  if (!isNumber(pct) || Math.abs(pct) < 1) return '→';
  return pct < 0 ? '↓' : '↑';
}

function parseIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function formatDateLong(iso) {
  const parts = parseIso(iso);
  if (!parts) return EMPTY;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatDateShort(iso) {
  const parts = parseIso(iso);
  if (!parts) return EMPTY;
  return `${parts.day} ${MONTHS_SHORT[parts.month - 1]}`;
}

export function formatWeekday(iso) {
  const parts = parseIso(iso);
  if (!parts) return EMPTY;
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${formatDateLong(iso)}`;
}

export function weekdayShort(iso) {
  const parts = parseIso(iso);
  if (!parts) return '';
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return ['Di', 'Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh'][weekday];
}

export function dayOfMonth(iso) {
  const parts = parseIso(iso);
  return parts ? String(parts.day) : '';
}

export function formatRange(fromIso, toIso) {
  const from = parseIso(fromIso);
  const to = parseIso(toIso);
  if (!from || !to) return EMPTY;
  if (from.year === to.year) {
    return `${from.day} ${MONTHS[from.month - 1]} – ${formatDateLong(toIso)}`;
  }
  return `${formatDateLong(fromIso)} – ${formatDateLong(toIso)}`;
}

export function escapeHtml(text) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text === null || text === undefined ? '' : text)
    .replace(/[&<>"']/g, character => replacements[character]);
}

// Emrat e gjatë shkurtohen vetëm brenda grafikave SVG; në lista shfaqen të plotë.
export function truncate(text, length) {
  const value = String(text || '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map(part => part.charAt(0).toUpperCase()).join('');
  return letters || '?';
}
