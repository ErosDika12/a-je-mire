import { mean, std, pctChange, zScore, corr, round } from './stats.js';

// Gjashtë metrikat, gjithmonë në këtë rend.
export const METRICS = ['mood', 'sleep', 'energy', 'social', 'joy', 'load'];

// Drejtimi i keq për secilën metrikë. load është e vetmja e përmbysur:
// më shumë ngarkesë do të thotë më keq. Ky objekt është burimi i vetëm i këtij rregulli.
export const WORSE = { mood: -1, sleep: -1, energy: -1, social: -1, joy: -1, load: +1 };

export const METRIC_LABELS = {
  mood: 'Humori',
  sleep: 'Gjumi',
  energy: 'Energjia',
  social: 'Lidhja sociale',
  joy: 'Gëzimi',
  load: 'Ngarkesa'
};

export const METRIC_UNITS = {
  mood: '1–10', sleep: 'orë', energy: '1–10',
  social: '1–10', joy: '1–10', load: '1–10'
};

// Çfarë do të thotë skaji i poshtëm dhe i sipërm i çdo slideri.
export const METRIC_ENDS = {
  mood:   { low: 'shumë keq', high: 'shumë mirë' },
  sleep:  { low: 'pak gjumë', high: 'gjumë i plotë' },
  energy: { low: 'pa forcë', high: 'plot energji' },
  social: { low: 'krejt vetëm', high: 'shumë i lidhur' },
  joy:    { low: 'asgjë s’më gëzoi', high: 'shumë gëzim' },
  load:   { low: 'pa ngarkesë', high: 'tepër i ngarkuar' }
};

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

const TAG_LABELS = {
  basketboll: 'Basketboll', mesim: 'Mësim', familja: 'Familja', shoket: 'Shokët',
  shetitje: 'Shëtitje', muzike: 'Muzikë', lexim: 'Lexim', ekrani: 'Ekrani',
  provim: 'Provim', shtepi: 'Shtëpi', kafe: 'Kafe', telefonate: 'Telefonatë'
};

export function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
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
      links.push({ a, b, r, n: checkins.length, strong: Math.abs(r) >= minStrength });
    }
  }
  return links.sort((left, right) => Math.abs(right.r) - Math.abs(left.r));
}

// Metrika e ditës N kundrejt metrikës së ditës N+1.
export function laggedLink(checkins, fromMetric, toMetric) {
  if (checkins.length < 4) return null;
  const today = checkins.slice(0, -1).map(checkin => checkin[fromMetric]);
  const tomorrow = checkins.slice(1).map(checkin => checkin[toMetric]);
  const r = corr(today, tomorrow);
  if (r === null) return null;
  return { fromMetric, toMetric, r, n: today.length };
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

// ---------- ndihmës për tekstin ----------

export function formatMetric(metric, value) {
  const rounded = round(value, 1);
  if (rounded === null) return '—';
  return metric === 'sleep' ? `${rounded} orë` : String(rounded);
}

export function directionWord(metric, pct) {
  if (pct === null || Math.abs(pct) < 1) return 'qëndroi';
  return pct < 0 ? 'ra' : 'u ngrit';
}
