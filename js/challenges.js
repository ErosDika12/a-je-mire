// Sfidat dhe arritjet: vetëm pjesëmarrje (sa herë), kurrë vlerat e check-in-eve.
// Pa renditje, pa dënime për ditët e humbura, pa "zinxhirë" që turpërojnë.
import { shiftDate } from './patterns.js';

export const TEMPLATES = {
  checkins_5_in_7: { target: 5, days: 7, manual: false },
  activities_3_days: { target: 3, days: 7, manual: false },
  weekly_snapshot: { target: 1, days: 7, manual: false },
  export_backup: { target: 1, days: 14, manual: false },
  routine: { target: 5, days: 7, manual: true },
  reach_out: { target: 1, days: 7, manual: true }
};

const inRange = (date, start, end) => date >= start && date <= end;

// Progresi llogaritet vetëm nga fakti që diçka ndodhi, jo nga vlera që u shënua.
export function challengeProgress(challenge, profile) {
  const { template, start, end } = challenge;
  const log = profile.activityLog || {};
  let count = 0;
  if (template === 'checkins_5_in_7') count = profile.checkins.filter(entry => inRange(entry.date, start, end)).length;
  else if (template === 'activities_3_days') count = profile.checkins.filter(entry => inRange(entry.date, start, end) && (entry.activities || []).length > 0).length;
  else if (template === 'weekly_snapshot') count = new Set((log.snapshotViews || []).filter(date => inRange(date, start, end))).size;
  else if (template === 'export_backup') count = new Set((log.exports || []).filter(date => inRange(date, start, end))).size;
  else count = new Set((challenge.ticks || []).filter(date => inRange(date, start, end))).size;
  return { count: Math.min(count, challenge.target), target: challenge.target, done: count >= challenge.target };
}

export function newChallenge(template, today, options = {}) {
  const base = TEMPLATES[template];
  if (!base) throw new Error('unknown_template');
  const start = options.start || today;
  const end = options.end || shiftDate(start, base.days - 1);
  if (end < start) throw new Error('invalid_dates');
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    template, title: String(options.title || '').slice(0, 60),
    target: Math.max(1, Math.min(60, Number(options.target) || base.target)),
    start, end, ticks: [], createdAt: new Date().toISOString(), completedAt: null
  };
}

export function recordActivity(profile, kind, today) {
  profile.activityLog = profile.activityLog || {};
  const list = profile.activityLog[kind] = profile.activityLog[kind] || [];
  if (!list.includes(today)) list.push(today);
  // Mbahen vetëm 120 ditët e fundit: mjafton për çdo sfidë.
  profile.activityLog[kind] = list.slice(-120);
}

export const ACHIEVEMENTS = ['first_checkin', 'seven_checkins', 'baseline_ready', 'first_challenge', 'three_challenges', 'backup_exported'];

export function achievements(profile) {
  const completed = (profile.challenges || []).filter(challenge => challenge.completedAt).length;
  const earned = {
    first_checkin: profile.checkins.length >= 1,
    seven_checkins: profile.checkins.length >= 7,
    baseline_ready: profile.checkins.length >= 14,
    first_challenge: completed >= 1,
    three_challenges: completed >= 3,
    backup_exported: ((profile.activityLog || {}).exports || []).length >= 1
  };
  const hidden = new Set((profile.settings && profile.settings.hiddenAchievements) || []);
  return ACHIEVEMENTS.map(key => ({ key, earned: earned[key], hidden: hidden.has(key) }));
}
