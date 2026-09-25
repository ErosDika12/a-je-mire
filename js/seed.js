import { METRICS } from './patterns.js';
import { toIso, PERSON_COLORS, MODEL_VERSION } from './storage.js';
import { tList } from './i18n/index.js';
import { addV3Demo } from './seed3.js';

// PROFIL SINTETIK. Të gjithë numrat këtu i prodhon ky fajll.
// Asnjë e dhënë e një personi të vërtetë nuk përdoret askund në projekt.

const TOTAL_DAYS = 30;
const BASELINE_DAYS = 23;
const RECENT_DAYS = 7;

// Mesataret që duam të dalin. Zhurma shtohet sipër tyre.
const BASELINE_TARGET = { mood: 7.4, sleep: 7.6, energy: 7.0, social: 6.8, joy: 7.1, load: 4.2 };
const RECENT_TARGET   = { mood: 6.1, sleep: 6.2, energy: 6.3, social: 4.8, joy: 6.4, load: 6.1 };
const SPREAD          = { mood: 0.9, sleep: 0.7, energy: 0.9, social: 1.0, joy: 0.9, load: 1.0 };

const BASELINE_ACTIVITIES = ['basketboll', 'shoket', 'mesim', 'muzike', 'shetitje', 'familja', 'lexim'];
const RECENT_ACTIVITIES   = ['mesim', 'ekrani', 'provim', 'shtepi', 'muzike'];

// Shënimet dhe lidhjet e demos vijnë nga përkthimet (seed.*), në gjuhën aktive kur krijohet demoja.

// Farë fikse, që demoja të japë saktësisht të njëjtat numra çdo herë që hapet.
function makeRandom(seed) {
  let state = seed;
  return function random() {
    state = (state + 0x6D2B79F5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function daysBefore(today, howMany) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - howMany);
}

function makeValue(metric, target, spread, random) {
  const raw = target + (random() * 2 - 1) * spread;
  // Gjumi matet në orë me hapa gjysmë ore; pesë metrikat e tjera janë numra të plotë 1–10.
  if (metric === 'sleep') return clamp(Math.round(raw * 2) / 2, 3, 11);
  return clamp(Math.round(raw), 1, 10);
}

function pickActivities(pool, random) {
  const howMany = 2 + Math.floor(random() * 2);
  const chosen = [];
  while (chosen.length < howMany) {
    const candidate = pool[Math.floor(random() * pool.length)];
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  return chosen;
}

function makeCheckin(dayIndex, today, random) {
  const isRecent = dayIndex >= BASELINE_DAYS;
  const targets = isRecent ? RECENT_TARGET : BASELINE_TARGET;
  const checkin = { date: toIso(daysBefore(today, TOTAL_DAYS - 1 - dayIndex)) };
  for (const metric of METRICS) {
    checkin[metric] = makeValue(metric, targets[metric], SPREAD[metric], random);
  }
  checkin.activities = pickActivities(isRecent ? RECENT_ACTIVITIES : BASELINE_ACTIVITIES, random);
  const notes = tList(isRecent ? 'seed.recentNotes' : 'seed.baselineNotes');
  checkin.note = notes[Math.floor(random() * notes.length)];
  return checkin;
}

function baseShape(consent) {
  return {
    version: MODEL_VERSION,
    consent,
    settings: { baselineDays: BASELINE_DAYS, recentDays: RECENT_DAYS, theme: 'auto' },
    connections: [],
    dismissed: [],
    experiment: null
  };
}

/** Profili demo: 30 ditë sintetike, tre persona shembull. */
export function generateProfile(consent, today = new Date(), seed = 20360911) {
  const random = makeRandom(seed);
  const checkins = [];
  for (let dayIndex = 0; dayIndex < TOTAL_DAYS; dayIndex++) {
    checkins.push(makeCheckin(dayIndex, today, random));
  }
  const relations = tList('seed.relations');
  const profile = {
    ...baseShape(consent),
    mode: 'demo',
    checkins,
    my5: [
      { name: 'Arta', relation: relations[0], color: PERSON_COLORS[1], lastReached: toIso(daysBefore(today, 14)), sharedActivity: 'kafe' },
      { name: 'Bleroni', relation: relations[1], color: PERSON_COLORS[2], lastReached: toIso(daysBefore(today, 9)), sharedActivity: 'shetitje' },
      { name: 'Dardani', relation: relations[2], color: PERSON_COLORS[0], lastReached: toIso(daysBefore(today, 21)), sharedActivity: 'basketboll' }
    ],
    connections: [
      { date: toIso(daysBefore(today, 21)), personName: 'Dardani', activityKey: 'basketboll' },
      { date: toIso(daysBefore(today, 14)), personName: 'Arta', activityKey: 'kafe' },
      { date: toIso(daysBefore(today, 9)), personName: 'Bleroni', activityKey: 'shetitje' }
    ]
  };
  // v3: Sot, MIRA, Focus, My Week dhe Community — të gjitha sintetike.
  return addV3Demo(profile, today);
}

/** Profil privat bosh: asnjë e dhënë sintetike, baseline-i ndërtohet nga zero. */
export function emptyProfile(consent) {
  return { ...baseShape(consent), mode: 'private', checkins: [], my5: [] };
}
