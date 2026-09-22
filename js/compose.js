import { round } from './stats.js';
import {
  METRIC_LABELS, MIN_DAYS, somethingChanged, whatHelpsMe, normalReport, tagLabel
} from './patterns.js';

// Aktivitetet që mund të propozohen për një hap të vogël social.
export const CONNECT_ACTIVITIES = {
  kafe:        'një kafe',
  shetitje:    'një shëtitje',
  telefonate:  'një telefonatë e shkurtër',
  basketboll:  'basketboll',
  mesim:       'mësim bashkë',
  mesazh:      'një mesazh i shkurtër'
};

export const TONES = {
  casual: 'I rehatshëm',
  warm:   'I ngrohtë',
  direct: 'I drejtpërdrejtë',
  short:  'Shumë i shkurtër'
};

const MESSAGE_TEMPLATES = {
  casual: [
    (name, what) => `Ç'kemi ${name}? A je i lirë për ${what} këtë javë?`,
    (name, what) => `${name}, ke kohë për ${what} ndonjë ditë këto ditë?`,
    (name, what) => `Hej ${name}, po mendoja për ${what}. A të bie mirë?`
  ],
  warm: [
    (name, what) => `${name}, ka ca kohë pa u parë. A gjejmë kohë për ${what}?`,
    (name, what) => `Përshëndetje ${name}. Do të më bënte mirë të flisnim pak — ndoshta ${what}?`,
    (name, what) => `${name}, më ka marrë malli. ${cap(what)} këtë javë?`
  ],
  direct: [
    (name, what) => `${name}, a ke kohë për ${what} këtë javë? Më thuaj cila ditë të përshtatet.`,
    (name, what) => `${name}, po propozoj ${what}. A të bie mirë nesër ose pasnesër?`,
    (name, what) => `${name}, dua të takohemi. ${cap(what)}, kur të kesh kohë?`
  ],
  short: [
    (name, what) => `${name}, ${what}?`,
    (name) => `${name}, a dalim këtë javë?`,
    (name, what) => `${name}, ${what} nesër?`
  ]
};

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function draftMessage(person, tone, activityKey, variant = 0) {
  const templates = MESSAGE_TEMPLATES[tone] || MESSAGE_TEMPLATES.casual;
  const what = CONNECT_ACTIVITIES[activityKey] || CONNECT_ACTIVITIES.kafe;
  const name = (person && person.name) || 'ti';
  return templates[variant % templates.length](name, what);
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
    return 'Lidhja sociale ka qenë nën patternin tënd të zakonshëm këtë javë.';
  }
  if (gap !== null && gap >= 10) {
    return `Kanë kaluar ${gap} ditë nga hera e fundit që e shënove këtë kontakt.`;
  }
  if (helps[0]) {
    return `Në të dhënat e tua, ditët me "${tagLabel(helps[0].tag)}" kanë pasur ${METRIC_LABELS[helps[0].metric].toLowerCase()} më të lartë.`;
  }
  return 'Një hap i vogël, kur të kesh kohë. Pa detyrim.';
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
  if (flaggedMetrics.includes('sleep')) return 'Çfarë e zhvendosi orën e gjumit këtë javë?';
  if (flaggedMetrics.includes('social')) return 'Cila ditë e kësaj jave të dha më shumë kohë me të tjerët?';
  if (flaggedMetrics.includes('load')) return 'Cila pjesë e ngarkesës mund të shtyhet për javën tjetër?';
  if (flaggedMetrics.length > 0) return 'Cila ditë e kësaj jave ishte më ndryshe nga të tjerat?';
  return 'Çfarë do të mbash njësoj edhe javën tjetër?';
}

function buildStep(topHelp, flaggedMetrics, profile) {
  if (topHelp) {
    const lift = round(Math.abs(topHelp.lift), 1);
    return `Provo "${tagLabel(topHelp.tag)}" një ditë më shumë javën e ardhshme. Deri tani, ditët me të kanë pasur ${METRIC_LABELS[topHelp.metric].toLowerCase()} mesatarisht ${lift} pikë ndryshe.`;
  }
  if (flaggedMetrics.includes('social') && (profile.my5 || []).length > 0) {
    return `Përgatit një mesazh të shkurtër te ${profile.my5[0].name}. Ti vendos nëse e dërgon.`;
  }
  return 'Vazhdo check-in-in e përditshëm edhe disa ditë, që baseline-i të bëhet më i saktë.';
}
