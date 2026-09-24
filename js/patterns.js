import { mean, std, pctChange, zScore, corr } from './stats.js';
import { t } from './i18n/index.js';

// Gjashtë metrikat, gjithmonë në këtë rend.
export const METRICS = ['mood', 'sleep', 'energy', 'social', 'joy', 'load'];

// Drejtimi i keq për secilën metrikë. load është e vetmja e përmbysur:
// më shumë ngarkesë do të thotë më keq. Ky objekt është burimi i vetëm i këtij rregulli.
export const WORSE = { mood: -1, sleep: -1, energy: -1, social: -1, joy: -1, load: +1 };

// Etiketat lexohen nga përkthimet në çastin e përdorimit, që ndërrimi i gjuhës të mos kërkojë rindezje.
// Getter-a të numërueshëm, që Object.keys/entries të japin gjashtë metrikat si më parë.
const translated = read => Object.defineProperties({}, Object.fromEntries(
  METRICS.map(metric => [metric, { get: () => read(metric), enumerable: true }])));

export const METRIC_LABELS = translated(metric => t(`metrics.${metric}`));

export const METRIC_UNITS = translated(metric => (metric === 'sleep' ? t('core.hours') : '1–10'));

// Çfarë do të thotë skaji i poshtëm dhe i sipërm i çdo slideri.
export const METRIC_ENDS = translated(metric => ({ low: t(`core.ends.${metric}.low`), high: t(`core.ends.${metric}.high`) }));

export const METRIC_RANGES = {
  mood:   { min: 1, max: 10, step: 1 },
  sleep:  { min: 3, max: 12, step: 0.5 },
  energy: { min: 1, max: 10, step: 1 },
  social: { min: 1, max: 10, step: 1 },
  joy:    { min: 1, max: 10, step: 1 },
  load:   { min: 1, max: 10, step: 1 }
};

// Sa ditë duhen minimalisht para se një modul të flasë.
export const MIN_DAYS = { change: 14, patterns: 14, helps: 10, reflection: 7, tag: 3 };

// Tags të propozuara. Çelësi ruhet pa shkronja të veçanta; etiketa shfaqet e plotë.
export const SUGGESTED_TAGS = [
  'basketboll', 'mesim', 'familja', 'shoket', 'shetitje',
  'muzike', 'lexim', 'ekrani', 'provim', 'shtepi'
];

const TAG_KEYS = new Set([...SUGGESTED_TAGS, 'kafe', 'telefonate']);

export function tagLabel(tag) {
  if (TAG_KEYS.has(tag)) return t(`core.tags.${tag}`);
  const text = String(tag || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function metricValues(checkins, metric) {
  return checkins.map(checkin => checkin[metric]);
}

// Periudha e fundit janë N ditët e fundit; baseline-i janë deri në M ditët para saj.
// Për profilin 30-ditor kjo jep saktësisht ditët 1–23 dhe 24–30.
export function splitPeriods(checkins, settings) {
  const recentDays = settings.recentDays;
  const baselineDays = settings.baselineDays;
  const recent = checkins.slice(Math.max(0, checkins.length - recentDays));
  const before = checkins.slice(0, Math.max(0, checkins.length - recentDays));
  const baseline = before.slice(Math.max(0, before.length - baselineDays));
  return { baseline, recent };
}

export function baselineProgress(checkins, settings) {
  const need = settings.baselineDays + settings.recentDays;
  const have = checkins.length;
  return {
    have,
    need,
    ratio: Math.min(1, have / need),
    ready: have >= MIN_DAYS.change,
    full: have >= need
  };
}

// Mesatarja e secilës metrikë gjatë ditëve baseline.
export function myNormal(checkins, settings) {
  const { baseline } = splitPeriods(checkins, settings);
  const normal = {};
  for (const metric of METRICS) normal[metric] = mean(metricValues(baseline, metric));
  return normal;
}

// Raport i plotë për ekranin My Normal: baseline, 7 ditët e fundit, ndryshimi.
export function normalReport(checkins, settings) {
  const { baseline, recent } = splitPeriods(checkins, settings);
  return METRICS.map(metric => measureFactor(metric, baseline, recent));
}

export function measureFactor(metric, baselineCheckins, recentCheckins) {
  const baselineValues = baselineCheckins.map(checkin => checkin[metric]);
  const recentValues = recentCheckins.map(checkin => checkin[metric]);
  const base = mean(baselineValues);
  const recent = mean(recentValues);
  const pct = pctChange(base, recent);
  const z = zScore(recent, base, std(baselineValues));
  const moved = base === null || recent === null ? 0 : recent - base;
  // Shumëzimi me WORSE e kthen "poshtë" ose "lart" në një test të vetëm.
  const movedWorse = moved * WORSE[metric] > 0;
  const flagged = pct !== null && movedWorse && (Math.abs(pct) >= 15 || Math.abs(z) >= 1.5);
  return {
    metric, base, recent, delta: moved, pct, z, movedWorse, flagged,
    baselineDays: baselineValues.filter(Number.isFinite).length,
    recentDays: recentValues.filter(Number.isFinite).length
  };
}

// Krahason ditët e fundit me baseline-in, metrikë për metrikë.
export function somethingChanged(checkins, settings) {
  const enough = checkins.length >= MIN_DAYS.change;
  const factors = normalReport(checkins, settings);
  const flagged = factors
    .filter(factor => factor.flagged)
    .sort((left, right) => Math.abs(right.pct) - Math.abs(left.pct));
  // Një faktor i vetëm është zhurmë. Dy ose më shumë është pattern.
  return { enough, signal: enough && flagged.length >= 2, flagged, factors };
}

// ---------- Why? ----------

// Korrelacion Pearson mes çdo çifti metrikash.
export function correlations(checkins, minStrength = 0.35) {
  const links = [];
  for (let i = 0; i < METRICS.length; i++) {
    for (let j = i + 1; j < METRICS.length; j++) {
      const a = METRICS[i];
      const b = METRICS[j];
      const r = corr(metricValues(checkins, a), metricValues(checkins, b));
      if (r === null) continue;
      // n janë ditët ku të dyja vlerat ekzistojnë, jo të gjitha check-ins.
      const n = scatterPairs(checkins, a, b).length;
      links.push({ a, b, r, n, strong: Math.abs(r) >= minStrength });
    }
  }
  return links.sort((left, right) => Math.abs(right.r) - Math.abs(left.r));
}

// Çiftet (x, y) për një grafik shpërndarjeje: vetëm ditët ku të dyja vlerat ekzistojnë.
export function scatterPairs(checkins, xMetric, yMetric) {
  return checkins
    .filter(checkin => Number.isFinite(checkin[xMetric]) && Number.isFinite(checkin[yMetric]))
    .map(checkin => ({ x: checkin[xMetric], y: checkin[yMetric], date: checkin.date }));
}

// Dita N kundrejt ditës N+1. Çifti merret vetëm kur dy check-ins janë vërtet
// ditë radhazi në kalendar — një ditë që mungon nuk lidh dy ditë të largëta.
export function laggedPairs(checkins, fromMetric, toMetric) {
  const pairs = [];
  for (let index = 1; index < checkins.length; index++) {
    const before = checkins[index - 1];
    const after = checkins[index];
    if (shiftDate(before.date, 1) !== after.date) continue;
    if (!Number.isFinite(before[fromMetric]) || !Number.isFinite(after[toMetric])) continue;
    pairs.push({ x: before[fromMetric], y: after[toMetric], date: after.date });
  }
  return pairs;
}

export function laggedLink(checkins, fromMetric, toMetric) {
  const pairs = laggedPairs(checkins, fromMetric, toMetric);
  if (pairs.length < MIN_DAYS.tag + 1) return null;
  const r = corr(pairs.map(pair => pair.x), pairs.map(pair => pair.y));
  if (r === null) return null;
  return { fromMetric, toMetric, r, n: pairs.length, pairs };
}

// Mesatare me kusht: ditët ku DY metrika ishin mbi normalen, kundrejt ditëve të tjera.
export function conditionalInsight(checkins, settings, conditionMetrics, targetMetric) {
  const normal = myNormal(checkins, settings);
  const withDays = [];
  const withoutDays = [];
  for (const checkin of checkins) {
    const target = checkin[targetMetric];
    if (!Number.isFinite(target)) continue;
    const meetsAll = conditionMetrics.every(metric => {
      const value = checkin[metric];
      if (!Number.isFinite(value) || normal[metric] === null) return false;
      // Për ngarkesën "më mirë" do të thotë nën normalen.
      return WORSE[metric] === 1 ? value < normal[metric] : value > normal[metric];
    });
    (meetsAll ? withDays : withoutDays).push(target);
  }
  if (withDays.length < MIN_DAYS.tag || withoutDays.length < MIN_DAYS.tag) return null;
  return {
    conditionMetrics,
    targetMetric,
    withMean: mean(withDays),
    withoutMean: mean(withoutDays),
    withDays: withDays.length,
    withoutDays: withoutDays.length
  };
}

// ---------- What Helps Me ----------

export function allTags(checkins) {
  const found = new Set();
  for (const checkin of checkins) {
    for (const tag of checkin.activities || []) found.add(tag);
  }
  return [...found].sort();
}

// Sa ndryshon mesatarja e një metrike në ditët me një tag kundrejt ditëve pa të.
export function activityLift(checkins, tag, metric) {
  const withTag = [];
  const withoutTag = [];
  for (const checkin of checkins) {
    const value = checkin[metric];
    if (!Number.isFinite(value)) continue;
    ((checkin.activities || []).includes(tag) ? withTag : withoutTag).push(value);
  }
  if (withTag.length < MIN_DAYS.tag || withoutTag.length < MIN_DAYS.tag) return null;
  const withMean = mean(withTag);
  const withoutMean = mean(withoutTag);
  return {
    tag, metric, withMean, withoutMean,
    lift: withMean - withoutMean,
    daysWith: withTag.length,
    daysWithout: withoutTag.length
  };
}

// Për çdo aktivitet, metrika ku shfaqet ndryshimi më i madh në drejtimin e mirë.
export function whatHelpsMe(checkins) {
  const results = [];
  for (const tag of allTags(checkins)) {
    let best = null;
    for (const metric of METRICS) {
      const lift = activityLift(checkins, tag, metric);
      if (!lift) continue;
      // "Mirë" do të thotë lart për pesë metrikat, poshtë për ngarkesën.
      const goodness = lift.lift * -WORSE[metric];
      if (!best || goodness > best.goodness) best = { ...lift, goodness };
    }
    if (best && Math.abs(best.lift) >= 0.3) results.push(best);
  }
  return results.sort((left, right) => right.goodness - left.goodness);
}

// Renditja kryesore e What Helps Me: humori mesatar me aktivitetin minus pa të.
// Aktiviteti shfaqet vetëm me të paktën 3 ditë me të dhe 3 ditë pa të.
export function activityRanking(checkins) {
  return allTags(checkins)
    .map(tag => activityLift(checkins, tag, 'mood'))
    .filter(Boolean)
    .sort((left, right) => right.lift - left.lift);
}

// ---------- datat ----------

// Zhvendos një datë VVVV-MM-DD me disa ditë. Në UTC, që ndërrimi i orës verore
// të mos e prishë numërimin.
export function shiftDate(iso, days) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Udhëtimi 30-ditor: 30 data radhazi që nisin me check-in-in e parë.
 * Kur historia është më e gjatë, dritarja është 30 ditët e fundit deri sot.
 */
export function journeyDays(checkins, today, length = 30) {
  const recorded = new Set(checkins.map(checkin => checkin.date));
  let start = checkins.length > 0 && checkins[0].date <= today ? checkins[0].date : today;
  if (shiftDate(start, length - 1) < today) start = shiftDate(today, -(length - 1));

  const days = [];
  for (let index = 0; index < length; index++) {
    const date = shiftDate(start, index);
    let state = 'future';
    if (recorded.has(date)) state = 'done';
    else if (date < today) state = 'missing';
    else if (date === today) state = 'pending';
    days.push({ date, state, isToday: date === today });
  }
  return {
    days,
    done: days.filter(day => day.state === 'done').length,
    missing: days.filter(day => day.state === 'missing').length,
    remaining: days.filter(day => day.state === 'future' || day.state === 'pending').length
  };
}

// 30 ditët e fundit të kalendarit, secila me check-in-in e saj (ose pa) dhe periudhën.
export function timelineDays(checkins, today, settings, length = 30) {
  const { baseline, recent } = splitPeriods(checkins, settings);
  const baselineDates = new Set(baseline.map(checkin => checkin.date));
  const recentDates = new Set(recent.map(checkin => checkin.date));
  const byDate = new Map(checkins.map(checkin => [checkin.date, checkin]));

  const days = [];
  for (let index = length - 1; index >= 0; index--) {
    const date = shiftDate(today, -index);
    let period = null;
    if (recentDates.has(date)) period = 'recent';
    else if (baselineDates.has(date)) period = 'baseline';
    days.push({ date, entry: byDate.get(date) || null, period, isToday: date === today });
  }
  return days;
}

// Mesatarja dhe devijimi i baseline-it për brezin e grafikut.
export function baselineStats(checkins, settings, metric) {
  const { baseline } = splitPeriods(checkins, settings);
  const values = metricValues(baseline, metric);
  return { mean: mean(values), std: std(values), n: values.filter(Number.isFinite).length };
}
