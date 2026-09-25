// "Sot" dhe "Friction Map": të dhënat e ditës dhe arsyet pse diçka u shty.
// Asnjë pikë, asnjë vlerësim. Kalimi i një detyre në një ditë tjetër nuk ndëshkohet kurrë.
import { t } from './i18n/index.js';

export const PAUSES = ['song', 'walk', 'breathe', 'phone_away', 'one_sentence', 'water', 'quiet'];
export const FRICTION = ['too_large', 'unclear', 'phone', 'tired', 'worried', 'interrupted', 'no_time', 'low_motivation', 'waiting', 'priority'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function shiftIso(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const emptyDay = () => ({
  feeling: null,                    // { word, strength: 1–3 }
  thing: null,                      // { text, steps: [{ text, done }], done, movedFrom }
  person: null,                     // { name, notToday, draft }
  pause: null                       // { id, custom, done }
});

// Kthen ditën (dhe e krijon në profil nëse mungon). Ruajtja bëhet nga app.save().
export function dayOf(profile, date) {
  profile.days = profile.days || {};
  if (!profile.days[date]) profile.days[date] = emptyDay();
  return profile.days[date];
}

export function peekDay(profile, date) {
  return (profile.days && profile.days[date]) || emptyDay();
}

// "Kaloje në një ditë tjetër": detyra kalon te nesër, arsyet (opsionale) shkojnë në Friction Map.
export function moveThing(profile, date, reasons = []) {
  const day = dayOf(profile, date);
  if (!day.thing || !day.thing.text) return null;
  const target = shiftIso(date, 1);
  const next = dayOf(profile, target);
  next.thing = { text: day.thing.text, steps: day.thing.steps.map(step => ({ ...step })), done: false, movedFrom: date };
  day.thing = { ...day.thing, movedTo: target };
  recordFriction(profile, { date, task: day.thing.text, reasons, source: 'today' });
  return target;
}

export function recordFriction(profile, { date, task, reasons, source }) {
  profile.friction = Array.isArray(profile.friction) ? profile.friction : [];
  profile.friction.push({ date, task: String(task || '').slice(0, 120), reasons: reasons.filter(r => FRICTION.includes(r)), source });
  profile.friction = profile.friction.slice(-60);
}

// Përmbledhje neutrale: "Zgjodhe 'telefoni' në 4 nga 7 detyrat e fundit të shtyra."
// Numëron vetëm zgjedhjet e përdoruesit. Nuk thotë asgjë për karakterin e tij.
export function frictionSummary(profile, last = 7) {
  const entries = (profile.friction || []).slice(-last);
  const counts = {};
  for (const entry of entries) for (const reason of entry.reasons) counts[reason] = (counts[reason] || 0) + 1;
  const withReasons = entries.filter(entry => entry.reasons.length).length;
  return {
    total: entries.length,
    withReasons,
    rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({
      reason, count, text: t('fric.summary', { reason: t(`fric.r.${reason}`), count, total: entries.length })
    }))
  };
}

// Kontakti i fundit i regjistruar me dorë (nga KAFE?/MY 5), jo i supozuar.
export function lastContact(profile, name) {
  const dates = (profile.connections || []).filter(c => c.personName === name).map(c => c.date);
  const person = (profile.my5 || []).find(p => p.name === name);
  if (person && person.lastReached) dates.push(person.lastReached);
  return dates.sort().pop() || null;
}

// Pastrimi i të dhënave të reja të profilit (edhe nga fajllat e importuar).
export function cleanDays(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  const str = (value, max) => String(value || '').slice(0, max);
  const dates = Object.keys(raw).filter(date => ISO.test(date)).sort().slice(-90);
  for (const date of dates) {
    const day = raw[date] || {};
    out[date] = {
      feeling: day.feeling && day.feeling.word ? { word: str(day.feeling.word, 40), strength: [1, 2, 3].includes(day.feeling.strength) ? day.feeling.strength : 2 } : null,
      thing: day.thing && day.thing.text ? {
        text: str(day.thing.text, 120),
        steps: (Array.isArray(day.thing.steps) ? day.thing.steps : []).slice(0, 3).map(step => ({ text: str(step.text, 80), done: Boolean(step.done) })).filter(step => step.text),
        done: Boolean(day.thing.done),
        movedFrom: ISO.test(day.thing.movedFrom) ? day.thing.movedFrom : null,
        movedTo: ISO.test(day.thing.movedTo) ? day.thing.movedTo : null
      } : null,
      person: day.person && (day.person.name || day.person.notToday) ? { name: str(day.person.name, 40), notToday: Boolean(day.person.notToday), draft: str(day.person.draft, 400) } : null,
      pause: day.pause && (PAUSES.includes(day.pause.id) || day.pause.id === 'custom') ? { id: day.pause.id, custom: str(day.pause.custom, 80), done: Boolean(day.pause.done) } : null
    };
  }
  return out;
}

export function cleanFriction(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && ISO.test(item.date)).slice(-60).map(item => ({
    date: item.date, task: String(item.task || '').slice(0, 120),
    reasons: (Array.isArray(item.reasons) ? item.reasons : []).filter(r => FRICTION.includes(r)),
    source: item.source === 'focus' ? 'focus' : 'today'
  }));
}
