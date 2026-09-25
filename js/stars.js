// Emotional Constellations: çdo yll është diçka që përdoruesi e regjistroi vetë.
// Asnjë yll nuk "zbulohet" nga foto, zëri apo kamera. Ndjenjat nuk ndahen në të mira e të këqija.
import { t } from './i18n/index.js';
import { tagLabel } from './patterns.js';
import { situationOf } from './mira.js';

export const KINDS = ['feeling', 'moment', 'school', 'friends', 'family', 'sleep', 'sport', 'music', 'goal', 'pressure', 'focus', 'photo', 'activity', 'person'];

// Etiketat e check-in-it dhe kategoritë e MIRA-s kthehen në lloje yjesh.
const TAG_KIND = { basketboll: 'sport', mesim: 'school', provim: 'pressure', familja: 'family', shoket: 'friends',
  shetitje: 'activity', muzike: 'music', lexim: 'activity', ekrani: 'activity', shtepi: 'family', kafe: 'friends', telefonate: 'friends' };
const MIRA_KIND = { school: 'school', friends: 'friends', family: 'family', heart: 'moment', self: 'moment', other: 'moment' };
const PHOTO_KIND = { school: 'school', friends: 'friends', family: 'family', sport: 'sport', music: 'music' };

// Hash i vogël dhe i qëndrueshëm: i njëjti yll bie gjithmonë në të njëjtin vend.
function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export function inRange(date, from, to) {
  return date >= from && date <= to;
}

// Mbledh yjet nga të dhënat e përdoruesit brenda periudhës [from, to].
export function collectStars(profile, from, to) {
  const stars = [];
  const add = star => { if (inRange(star.date, from, to)) stars.push({ strength: 2, people: [], important: false, photoId: null, ...star }); };

  for (const [date, day] of Object.entries(profile.days || {})) {
    if (day.feeling) add({ id: `feel-${date}`, kind: 'feeling', date, label: day.feeling.word, strength: day.feeling.strength });
    if (day.thing && day.thing.done) add({ id: `goal-${date}`, kind: 'goal', date, label: day.thing.text });
    if (day.pause && day.pause.done) add({ id: `pause-${date}`, kind: 'activity', date, label: day.pause.id === 'custom' ? day.pause.custom : t(`today.p.${day.pause.id}`), helped: true });
    if (day.person && day.person.name) add({ id: `person-${date}`, kind: 'person', date, label: day.person.name, people: [day.person.name] });
  }
  for (const path of (profile.mira && profile.mira.paths) || []) {
    add({ id: `mira-${path.id}`, kind: path.situation === 'exams' || path.situation === 'school_stress' ? 'pressure' : MIRA_KIND[situationOf(path.situation).cat], date: path.date, label: t(`mira.sit.${path.situation}`) });
    path.feelings.forEach((word, i) => add({ id: `mfeel-${path.id}-${i}`, kind: 'feeling', date: path.date, label: word }));
  }
  for (const entry of profile.checkins || []) {
    for (const tag of entry.activities || []) add({ id: `tag-${entry.date}-${tag}`, kind: TAG_KIND[tag] || 'activity', date: entry.date, label: tagLabel(tag) });
    if (Number.isFinite(entry.sleep)) add({ id: `sleep-${entry.date}`, kind: 'sleep', date: entry.date, label: t('stars.sleepLabel', { h: entry.sleep }), strength: 1 });
  }
  for (const session of (profile.focus && profile.focus.sessions) || []) {
    add({ id: `focus-${session.id}`, kind: 'focus', date: session.date, label: session.task || t('stars.focusLabel'), strength: session.outcome === 'completed' ? 3 : 2 });
  }
  for (const photo of (profile.week && profile.week.photos) || []) {
    add({ id: `photo-${photo.id}`, kind: 'photo', date: photo.date, label: photo.caption || t('stars.photoLabel'), important: photo.best, people: photo.people, photoId: photo.id });
  }
  for (const c of profile.connections || []) {
    add({ id: `conn-${c.date}-${c.personName}`, kind: 'person', date: c.date, label: c.personName, people: [c.personName] });
  }
  // Shënimet dhe "e rëndësishme" që i vendos përdoruesi te vetë yjet.
  const notes = (profile.stars && profile.stars.notes) || {};
  const important = (profile.stars && profile.stars.important) || {};
  return stars.map(star => ({ ...star, note: notes[star.id] || '', important: star.important || Boolean(important[star.id]) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Vendos yjet në hapësirë: këndi sipas llojit, largësia sipas kohës (më afër = më e re).
export function layout(stars, to, days, size = 600) {
  const center = size / 2;
  const sector = (Math.PI * 2) / KINDS.length;
  const rMin = 62;
  const rMax = size / 2 - 34;
  const end = new Date(`${to}T12:00:00`).getTime();
  return stars.map(star => {
    const ago = Math.max(0, Math.round((end - new Date(`${star.date}T12:00:00`).getTime()) / 86400000));
    const k = KINDS.indexOf(star.kind);
    const angle = k * sector + (0.15 + hash(star.id) * 0.7) * sector - Math.PI / 2;
    const radius = rMin + (Math.min(ago, days) / Math.max(days, 1)) * (rMax - rMin) + (hash(`${star.id}r`) - 0.5) * 14;
    return {
      ...star, ago,
      x: Math.round((center + Math.cos(angle) * radius) * 10) / 10,
      y: Math.round((center + Math.sin(angle) * radius) * 10) / 10,
      r: star.important ? 8 : star.kind === 'photo' ? 6 : 3.2 + star.strength * 0.9,
      glow: 0.45 + star.strength * 0.17
    };
  });
}

// Lidhjet: tema të ndryshme që u shfaqën në të njëjtën ditë. Tregojnë bashkë-shfaqje, jo shkak.
export function links(placed, hidden = new Set()) {
  const byDate = {};
  for (const star of placed) if (!hidden.has(star.kind)) (byDate[star.date] = byDate[star.date] || []).push(star);
  const out = [];
  for (const group of Object.values(byDate)) {
    const kinds = [...new Map(group.map(s => [s.kind, s])).values()];
    for (let i = 1; i < kinds.length && i < 4; i++) out.push([kinds[0], kinds[i]]);
  }
  return out;
}

// Gjurma e ndjenjave: si ndryshoi java, në rendin e datave.
export function trail(placed) {
  return placed.filter(s => s.kind === 'feeling').slice(-14);
}

// Krahasim i dy temave: në sa ditë u shfaqën bashkë dhe në sa veçmas.
export function compare(stars, kindA, kindB) {
  const daysA = new Set(stars.filter(s => s.kind === kindA).map(s => s.date));
  const daysB = new Set(stars.filter(s => s.kind === kindB).map(s => s.date));
  const both = [...daysA].filter(d => daysB.has(d)).length;
  return { both, onlyA: daysA.size - both, onlyB: daysB.size - both };
}

// Përmbledhje me tekst për lexuesit e ekranit dhe për këdo që nuk e sheh grafikun.
export function textSummary(stars) {
  const counts = {};
  for (const star of stars) counts[star.kind] = (counts[star.kind] || 0) + 1;
  return KINDS.filter(k => counts[k]).map(k => ({ kind: k, count: counts[k], examples: [...new Set(stars.filter(s => s.kind === k).map(s => s.label))].slice(0, 3) }));
}

export function cleanStars(raw) {
  const out = { notes: {}, important: {}, snapshots: [] };
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, note] of Object.entries(raw.notes || {})) if (typeof note === 'string' && note.trim()) out.notes[String(id).slice(0, 80)] = note.slice(0, 500);
  for (const [id, on] of Object.entries(raw.important || {})) if (on === true) out.important[String(id).slice(0, 80)] = true;
  out.snapshots = (Array.isArray(raw.snapshots) ? raw.snapshots : []).filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).slice(-12).map(s => ({
    id: String(s.id || '').slice(0, 30), date: s.date, from: String(s.from || '').slice(0, 10), to: String(s.to || '').slice(0, 10),
    svg: String(s.svg || '').slice(0, 60000), summary: String(s.summary || '').slice(0, 1000), inWeek: Boolean(s.inWeek)
  }));
  return out;
}
