// Focus Space: një detyrë aktive, një kohëmatës. Koha llogaritet nga orari i fillimit,
// prandaj seanca vazhdon saktë edhe pas rifreskimit të faqes (nëse ruajtja lokale lejohet).
export const DURATIONS = [15, 25, 45];
export const OUTCOMES = ['completed', 'progress', 'later', 'stopped'];
const BREAK_MINUTES = 5;

export function startSession(profile, { task, mode, minutes, now = Date.now() }) {
  profile.focus = profile.focus || { active: null, sessions: [] };
  profile.focus.active = {
    id: `f${now.toString(36)}`, task: String(task || '').slice(0, 120), mode: mode === 'exam' ? 'exam' : 'homework',
    minutes: Math.max(1, Math.min(180, Math.round(minutes))), startedAt: now, pausedAt: null, pausedMs: 0,
    phase: 'focus', distractions: []
  };
  return profile.focus.active;
}

export function startBreak(profile, now = Date.now()) {
  profile.focus = profile.focus || { active: null, sessions: [] };
  profile.focus.active = { id: `b${now.toString(36)}`, task: '', mode: 'homework', minutes: BREAK_MINUTES, startedAt: now, pausedAt: null, pausedMs: 0, phase: 'break', distractions: [] };
  return profile.focus.active;
}

export function pause(active, now = Date.now()) {
  if (active && !active.pausedAt) active.pausedAt = now;
}

export function resume(active, now = Date.now()) {
  if (active && active.pausedAt) {
    active.pausedMs += now - active.pausedAt;
    active.pausedAt = null;
  }
}

export function elapsedMs(active, now = Date.now()) {
  if (!active) return 0;
  const end = active.pausedAt || now;
  return Math.max(0, end - active.startedAt - active.pausedMs);
}

export function remainingMs(active, now = Date.now()) {
  if (!active) return 0;
  return Math.max(0, active.minutes * 60000 - elapsedMs(active, now));
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Mbyllja e seancës. Çdo përfundim është i vlefshëm; "u ndal" nuk ndëshkohet.
export function finishSession(profile, outcome, date, now = Date.now()) {
  const active = profile.focus && profile.focus.active;
  if (!active) return null;
  profile.focus.active = null;
  if (active.phase === 'break') return null;
  const record = {
    id: active.id, date, task: active.task, mode: active.mode, minutes: active.minutes,
    actualMin: Math.round(elapsedMs(active, now) / 60000),
    outcome: OUTCOMES.includes(outcome) ? outcome : 'stopped',
    distractions: active.distractions.slice(0, 10)
  };
  profile.focus.sessions = [...(profile.focus.sessions || []), record].slice(-100);
  return record;
}

export function cleanFocus(raw) {
  const out = { active: null, sessions: [] };
  if (!raw || typeof raw !== 'object') return out;
  const a = raw.active;
  if (a && Number.isFinite(a.startedAt) && Number.isFinite(a.minutes)) {
    out.active = {
      id: String(a.id || 'f').slice(0, 20), task: String(a.task || '').slice(0, 120), mode: a.mode === 'exam' ? 'exam' : 'homework',
      minutes: Math.max(1, Math.min(180, a.minutes)), startedAt: a.startedAt,
      pausedAt: Number.isFinite(a.pausedAt) ? a.pausedAt : null, pausedMs: Number.isFinite(a.pausedMs) ? a.pausedMs : 0,
      phase: a.phase === 'break' ? 'break' : 'focus',
      distractions: (Array.isArray(a.distractions) ? a.distractions : []).map(d => String(d).slice(0, 100)).slice(0, 10)
    };
  }
  out.sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).slice(-100).map(s => ({
    id: String(s.id || '').slice(0, 20), date: s.date, task: String(s.task || '').slice(0, 120), mode: s.mode === 'exam' ? 'exam' : 'homework',
    minutes: Number(s.minutes) || 0, actualMin: Number(s.actualMin) || 0, outcome: OUTCOMES.includes(s.outcome) ? s.outcome : 'stopped',
    distractions: (Array.isArray(s.distractions) ? s.distractions : []).map(d => String(d).slice(0, 100)).slice(0, 10)
  }));
  return out;
}
