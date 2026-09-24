// Sistemi i përkthimeve. Shqipja është gjuha kryesore; anglishtja e plotëson.
// Skedarët e përkthimit përmbajnë vetëm tekst — asnjë llogaritje.
import sq from './sq.js';
import en from './en.js';

export const LANGUAGES = { sq, en };
let current = 'sq';
const listeners = new Set();

export function getLang() {
  return current;
}

export function setLang(lang) {
  const next = LANGUAGES[lang] ? lang : 'sq';
  if (next === current) return;
  current = next;
  document.documentElement.lang = current;
  for (const listener of listeners) listener(current);
}

export function onLangChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dictionary);
}

// t('community.posted', { name: 'Arta' }) → "Arta postoi". Çelësi që mungon kthehet si çelës,
// që ta vëmë re menjëherë (dhe testi i përkthimeve e kap para publikimit).
export function t(key, params = {}) {
  let value = lookup(LANGUAGES[current], key);
  if (value === undefined) value = lookup(LANGUAGES.sq, key);
  if (typeof value !== 'string') return key;
  return fill(value, params);
}

// Vendos parametrat në një tekst me {emër}. Një kalim i vetëm: vlerat nuk interpretohen sërish.
export function fill(text, params = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? String(params[name]) : match));
}

// Lista (p.sh. emrat e muajve): tList('core.months') → ['janar', …].
export function tList(key) {
  const value = lookup(LANGUAGES[current], key) ?? lookup(LANGUAGES.sq, key);
  return Array.isArray(value) ? value : [];
}

// Shumësi i thjeshtë: plural('days', 3) → "3 ditë".
export function plural(key, count) {
  const forms = lookup(LANGUAGES[current], key) || lookup(LANGUAGES.sq, key);
  if (!forms || typeof forms !== 'object') return `${count}`;
  return (count === 1 ? forms.one : forms.other).replace('{n}', formatNumber(count));
}

export function locale() {
  return current === 'en' ? 'en-GB' : 'sq-AL';
}

// Shumë shfletues (p.sh. Chromium) nuk kanë të dhënat e shqipes për Intl dhe bien në anglisht.
// Prandaj shqipja formatohet këtu, me emrat e muajve dhe me shprehje të shkruara me dorë.
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
const pad = value => String(value).padStart(2, '0');

export function formatNumber(value, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (current === 'sq') return String(Number(value.toFixed(digits)));
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

export function formatDateTime(iso, withTime = true) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  if (current === 'sq') {
    const day = `${date.getDate()} ${SQ_MONTHS[date.getMonth()]}`;
    return withTime ? `${day}, ${pad(date.getHours())}:${pad(date.getMinutes())}` : `${day} ${date.getFullYear()}`;
  }
  return new Intl.DateTimeFormat('en-GB', withTime
    ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

// "para 5 minutash" / "5 minutes ago", për lista mesazhesh dhe postimesh.
export function formatRelative(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (current === 'sq') {
    if (seconds < 45) return 'tani';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes === 1 ? 'para 1 minute' : `para ${minutes} minutash`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours === 1 ? 'para 1 ore' : `para ${hours} orësh`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'dje';
    if (days < 7) return `para ${days} ditësh`;
    return formatDateTime(iso, false);
  }
  const format = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day']];
  let value = -seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit);
    value /= size;
  }
  return formatDateTime(iso, false);
}

export function allKeys(dictionary, prefix = '') {
  const keys = [];
  for (const [name, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (value && typeof value === 'object' && !('one' in value && 'other' in value)) keys.push(...allKeys(value, path));
    else keys.push(path);
  }
  return keys;
}
