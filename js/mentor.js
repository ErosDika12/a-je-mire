// Llogaritja e asaj që ndahet me mentorin — e pastër dhe e testueshme.
// Kurrë: shënime, emra MY 5, mesazhe, fjalëkalime, reflektime AI apo përfundime mjekësore.
import { METRICS, normalReport } from './patterns.js';

export const SHAREABLE = [...METRICS, 'activities', 'weekly_summary'];

// Rreshtat ditorë brenda intervalit, vetëm me kategoritë e zgjedhura.
export function buildDayEntries(profile, grant) {
  const end = grant.range_end || '9999-12-31';
  return profile.checkins
    .filter(entry => entry.date >= grant.range_start && entry.date <= end)
    .map(entry => {
      const payload = {};
      for (const key of grant.categories) {
        if (METRICS.includes(key) && Number.isFinite(entry[key])) payload[key] = entry[key];
        if (key === 'activities' && Array.isArray(entry.activities) && entry.activities.length) payload.activities = entry.activities.slice(0, 12).map(tag => String(tag).slice(0, 24));
      }
      return { kind: 'day', entry_date: entry.date, payload };
    })
    .filter(row => Object.keys(row.payload).length > 0);
}

// Përmbledhja javore: vetëm drejtimi dhe përqindja e ndryshimit, pa asnjë përfundim.
export function buildWeekEntry(profile, today) {
  const report = normalReport(profile.checkins, profile.settings);
  const changes = report.filter(factor => factor.pct !== null).map(factor => ({
    metric: factor.metric,
    direction: factor.pct > 0 ? 'up' : factor.pct < 0 ? 'down' : 'flat',
    pct: Math.round(factor.pct)
  }));
  return { kind: 'week', entry_date: today, payload: { changes: changes.slice(0, 6), days: Math.min(profile.checkins.length, 30) } };
}

export function grantStatus(grant, now = new Date()) {
  if (grant.revoked_at) return 'revoked';
  if (new Date(grant.expires_at) <= now) return 'expired';
  if (!grant.mentor_id) return 'pending';
  return 'active';
}
