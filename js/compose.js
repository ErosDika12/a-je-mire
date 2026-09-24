import { round } from './stats.js';
import {
  METRIC_LABELS, MIN_DAYS, somethingChanged, whatHelpsMe, normalReport, tagLabel
} from './patterns.js';
import { t, tList, fill } from './i18n/index.js';

// Objekt me etiketa që lexohen nga përkthimet në çastin e përdorimit (Object.entries funksionon).
const labels = (keys, prefix) => Object.defineProperties({}, Object.fromEntries(
  keys.map(key => [key, { get: () => t(`${prefix}.${key}`), enumerable: true }])));

// Aktivitetet që mund të propozohen për një hap të vogël social.
export const CONNECT_ACTIVITIES = labels(['kafe', 'shetitje', 'telefonate', 'basketboll', 'mesim', 'mesazh'], 'compose.act');

export const TONES = labels(['casual', 'warm', 'direct', 'short'], 'compose.tone');


function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function draftMessage(person, tone, activityKey, variant = 0) {
  // Template-t janë tekst me {name}, {what} dhe {What}; gjuha është ajo e ndërfaqes.
  const templates = tList(`compose.tpl.${TONES[tone] ? tone : 'casual'}`);
  const what = CONNECT_ACTIVITIES[activityKey] || CONNECT_ACTIVITIES.kafe;
  const name = (person && person.name) || t('compose.you');
  return fill(templates[variant % templates.length], { name, what, What: cap(what) });
}

// Sa ditë kanë kaluar nga data e fundit e kontaktit.
export function daysSince(isoDate, todayIsoDate) {
  if (!isoDate) return null;
  const then = Date.parse(isoDate + 'T00:00:00');
  const now = Date.parse(todayIsoDate + 'T00:00:00');
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.round((now - then) / 86400000);
}

// Zgjedh një hap të vogël social: kë, çfarë dhe pse. Kurrë nuk dërgon asgjë.
export function suggestConnection(profile, today, skipKeys = []) {
  const people = profile.my5 || [];
  if (people.length === 0) return null;

  const ranked = [...people].sort((left, right) => {
    const leftDays = daysSince(left.lastReached, today);
    const rightDays = daysSince(right.lastReached, today);
    return (rightDays === null ? 9999 : rightDays) - (leftDays === null ? 9999 : leftDays);
  });

  const changed = somethingChanged(profile.checkins, profile.settings);
  const socialDropped = changed.flagged.some(factor => factor.metric === 'social');
  const helps = whatHelpsMe(profile.checkins);

  for (const person of ranked) {
    const activityKey = pickActivity(person, helps);
    const key = `${person.name}|${activityKey}`;
    if (skipKeys.includes(key)) continue;
    return {
      key,
      person,
      activityKey,
      activityText: CONNECT_ACTIVITIES[activityKey],
      gapDays: daysSince(person.lastReached, today),
      reason: buildReason(person, socialDropped, today, helps)
    };
  }
  return null;
}

function pickActivity(person, helps) {
  if (person.sharedActivity && CONNECT_ACTIVITIES[person.sharedActivity]) return person.sharedActivity;
  const topHelp = helps[0];
  if (topHelp && CONNECT_ACTIVITIES[topHelp.tag]) return topHelp.tag;
  return 'kafe';
}

function buildReason(person, socialDropped, today, helps) {
  const gap = daysSince(person.lastReached, today);
  if (socialDropped) {
    return t('compose.reasonSocial');
  }
  if (gap !== null && gap >= 10) {
    return t('compose.reasonGap', { n: gap });
  }
  if (helps[0]) {
    return t('compose.reasonHelp', { tag: tagLabel(helps[0].tag), metric: METRIC_LABELS[helps[0].metric].toLowerCase() });
  }
  return t('compose.reasonDefault');
}

// ---------- reflektimi javor ----------

// Përmbledhje e ndërtuar nga numrat e llogaritur, me template lokale.
// Pa API të jashtëm, pa çelës, pa internet. E njëjta e dhënë jep të njëjtin tekst.
export function weeklyReflection(profile) {
  const checkins = profile.checkins;
  if (checkins.length < MIN_DAYS.reflection) {
    return { enough: false, days: checkins.length, need: MIN_DAYS.reflection };
  }

  const factors = normalReport(checkins, profile.settings);
  const changed = somethingChanged(checkins, profile.settings);
  const flaggedMetrics = changed.flagged.map(factor => factor.metric);

  const stable = factors
    .filter(factor => factor.pct !== null && Math.abs(factor.pct) < 8)
    .map(factor => METRIC_LABELS[factor.metric]);

  const moved = changed.flagged.map(factor => ({
    label: METRIC_LABELS[factor.metric],
    pct: Math.round(Math.abs(factor.pct)),
    down: factor.pct < 0
  }));

  const helps = whatHelpsMe(checkins);
  const topHelp = helps[0] || null;

  return {
    enough: true,
    days: checkins.length,
    stable,
    moved,
    topHelp,
    question: buildQuestion(flaggedMetrics),
    step: buildStep(topHelp, flaggedMetrics, profile)
  };
}

function buildQuestion(flaggedMetrics) {
  if (flaggedMetrics.includes('sleep')) return t('compose.qSleep');
  if (flaggedMetrics.includes('social')) return t('compose.qSocial');
  if (flaggedMetrics.includes('load')) return t('compose.qLoad');
  if (flaggedMetrics.length > 0) return t('compose.qAny');
  return t('compose.qNone');
}

function buildStep(topHelp, flaggedMetrics, profile) {
  if (topHelp) {
    const lift = round(Math.abs(topHelp.lift), 1);
    return t('compose.stepHelp', { tag: tagLabel(topHelp.tag), metric: METRIC_LABELS[topHelp.metric].toLowerCase(), lift });
  }
  if (flaggedMetrics.includes('social') && (profile.my5 || []).length > 0) {
    return t('compose.stepSocial', { name: profile.my5[0].name });
  }
  return t('compose.stepDefault');
}
