import { METRICS, METRIC_RANGES } from './patterns.js';

// E vetmja derë për të shkruar dhe lexuar në localStorage.
// Gjithçka rri nën një çelës të vetëm.
const STORAGE_KEY = 'ajemire.v1';
// Kopja e fundit para një zëvendësimi (import ose rikthim nga cloud), që gabimi të kthehet mbrapsht.
const BACKUP_KEY = 'ajemire.v1.before-replace';
export const POLICY_VERSION = '2026-09';
export const MODEL_VERSION = 2;

export function todayIso() {
  return toIso(new Date());
}

export function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Kur të dhënat e ruajtura nuk lexohen dot, e shënojmë këtu që ndërfaqja
// të shfaqë një mesazh të qetë në vend të një gabimi teknik.
export let lastLoadProblem = null;

export function loadProfile() {
  lastLoadProblem = null;
  let text = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    lastLoadProblem = 'blocked'; // p.sh. dritare private ku ruajtja është e bllokuar
    return null;
  }
  if (!text) return null;
  try {
    return migrate(JSON.parse(text));
  } catch (error) {
    lastLoadProblem = 'unreadable';
    return null;
  }
}

export function saveProfile(profile) {
  // Kjo është e vetmja pikë ku shkruhet. Pa consent.store === true nuk shkruan asgjë,
  // prandaj është e pamundur të ruhen të dhëna para se përdoruesi ta ndezë toggle-in.
  if (!profile || !profile.consent || profile.consent.store !== true) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch (error) {
    // asgjë për të pastruar
  }
}

// Ruhet vetëm kur ka consent, njësoj si profili.
export function saveLocalBackup(profile) {
  if (!profile || !profile.consent || profile.consent.store !== true) return false;
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), profile }));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadLocalBackup() {
  try {
    const text = localStorage.getItem(BACKUP_KEY);
    if (!text) return null;
    const data = JSON.parse(text);
    return { savedAt: data.savedAt, profile: migrate(data.profile) };
  } catch (error) {
    return null;
  }
}

// Çdo pëlqim shënohet veç e veç, me datë dhe version të politikës, që të mund të tregohet më vonë.
export function recordConsent(profile, kind, granted) {
  profile.consentLog = profile.consentLog || [];
  profile.consentLog.push({ kind, granted: Boolean(granted), at: new Date().toISOString(), policyVersion: POLICY_VERSION });
}

// Kthen true kur shkarkimi nisi, false kur shfletuesi e pengoi.
export function exportToFile(profile) {
  try {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ajemire-${todayIso()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (error) {
    return false;
  }
}

// Check-ins të ruajtura: pa rreshta të prishur, pa data të dyfishta, të renditura.
// Nëse një datë shfaqet dy herë, mbahet e fundit — ashtu si mbishkruan check-in-i.
function cleanCheckins(list) {
  const byDate = new Map();
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || typeof entry !== 'object' || !DATE_PATTERN.test(entry.date)) continue;
    const clean = { date: entry.date };
    for (const metric of METRICS) {
      if (typeof entry[metric] === 'number' && Number.isFinite(entry[metric])) clean[metric] = entry[metric];
    }
    clean.activities = Array.isArray(entry.activities) ? entry.activities.filter(tag => typeof tag === 'string') : [];
    clean.note = typeof entry.note === 'string' ? entry.note : '';
    byDate.set(entry.date, clean);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

// Versioni 1 nuk kishte mode, connections, dismissed apo experiment.
// Të dhënat e vjetra ruhen ashtu siç janë; vetëm fushat e reja shtohen.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const profile = { ...raw };
  profile.version = MODEL_VERSION;
  profile.mode = profile.mode === 'private' ? 'private' : 'demo';
  profile.consent = profile.consent || { store: false, ai: false, acceptedAt: null };
  profile.settings = {
    baselineDays: 23,
    recentDays: 7,
    theme: 'auto',
    ...(profile.settings || {})
  };
  profile.checkins = cleanCheckins(profile.checkins);
  profile.my5 = (Array.isArray(profile.my5) ? profile.my5 : [])
    .filter(person => person && typeof person === 'object' && String(person.name || '').trim() !== '')
    .slice(0, 5).map((person, index) => ({
    name: String(person.name || '').slice(0, 40),
    relation: String(person.relation || '').slice(0, 40),
    color: person.color || PERSON_COLORS[index % PERSON_COLORS.length],
    lastReached: person.lastReached || null,
    sharedActivity: person.sharedActivity || 'kafe'
  }));
  profile.connections = (Array.isArray(profile.connections) ? profile.connections : [])
    .filter(item => item && DATE_PATTERN.test(item.date) && typeof item.personName === 'string');
  profile.dismissed = Array.isArray(profile.dismissed) ? profile.dismissed : [];
  profile.experiment = profile.experiment || null;
  profile.consentLog = Array.isArray(profile.consentLog) ? profile.consentLog : [];
  // Gjendja e sinkronizimit: kurrë fjalëkalimi, vetëm ID e pajisjes dhe revizioni i fundit i njohur.
  profile.sync = profile.sync && typeof profile.sync === 'object' ? profile.sync : null;
  return profile;
}

// Ngjyra mjaft të errëta që inicialet e bardha të lexohen qartë.
export const PERSON_COLORS = ['#0f766e', '#5a52c2', '#2672ad', '#a8581a', '#3b7d52'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kontrollon një fajll të importuar para se ta pranojë.
 * Kthen { ok, errors, warnings, profile }.
 */
export function validateProfile(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Fajlli nuk përmban një objekt profili.'], warnings, profile: null };
  }
  if (!Array.isArray(raw.checkins)) {
    return { ok: false, errors: ['Mungon lista "checkins".'], warnings, profile: null };
  }

  const seenDates = new Set();
  const checkins = [];
  raw.checkins.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`Rreshti ${index + 1} u anashkalua: nuk është objekt.`);
      return;
    }
    if (!DATE_PATTERN.test(entry.date)) {
      warnings.push(`Rreshti ${index + 1} u anashkalua: data "${entry.date}" nuk është në formatin VVVV-MM-DD.`);
      return;
    }
    if (seenDates.has(entry.date)) {
      warnings.push(`Data ${entry.date} ishte e dyfishtë; u mbajt vetëm e para.`);
      return;
    }
    seenDates.add(entry.date);

    const clean = { date: entry.date };
    for (const metric of METRICS) {
      const value = entry[metric];
      const range = METRIC_RANGES[metric];
      if (typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max) {
        clean[metric] = value;
      } else if (value !== undefined && value !== null) {
        // Vlera jashtë kufijve nuk bëhet zero — thjesht nuk merret.
        warnings.push(`${entry.date}: "${metric}" jashtë kufijve, u lanë bosh.`);
      }
    }
    clean.activities = Array.isArray(entry.activities)
      ? entry.activities.filter(tag => typeof tag === 'string').map(tag => tag.slice(0, 24)).slice(0, 12)
      : [];
    clean.note = typeof entry.note === 'string' ? entry.note.slice(0, 500) : '';
    checkins.push(clean);
  });

  if (checkins.length === 0) errors.push('Asnjë check-in i vlefshëm nuk u gjet në fajll.');
  if (errors.length > 0) return { ok: false, errors, warnings, profile: null };

  checkins.sort((left, right) => left.date.localeCompare(right.date));

  const profile = migrate({
    ...raw,
    checkins,
    // Një fajll i importuar janë të dhënat e vetë përdoruesit, përveç nëse thotë shprehimisht
    // se është demo. Nuk duhet të etiketohet sintetik kur nuk është.
    mode: raw.mode === 'demo' ? 'demo' : 'private',
    // Gjendja e sinkronizimit i përket pajisjes që e krijoi, jo fajllit.
    sync: null,
    consent: { store: true, ai: Boolean(raw.consent && raw.consent.ai), acceptedAt: new Date().toISOString() }
  });
  return { ok: true, errors, warnings, profile };
}

export function importFromText(text) {
  try {
    return validateProfile(JSON.parse(text));
  } catch (error) {
    return { ok: false, errors: ['Fajlli nuk është JSON i vlefshëm.'], warnings: [], profile: null };
  }
}
