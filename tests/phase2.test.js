// Testet e Fazës 2 pa shfletues: përkthimet, filtri i analitikës, sfidat, ndarja me mentor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

globalThis.window = { innerWidth: 400 };
globalThis.document = { documentElement: {} };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const { default: sq } = await import('../js/i18n/sq.js');
const { default: en } = await import('../js/i18n/en.js');
const { allKeys } = await import('../js/i18n/index.js');
const { validateEvent, FORBIDDEN_KEYS } = await import('../js/analytics.js');
const { challengeProgress, newChallenge, achievements } = await import('../js/challenges.js');
const { buildDayEntries, buildWeekEntry, grantStatus } = await import('../js/mentor.js');
const { generateProfile } = await import('../js/seed.js');

function jsFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? jsFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('shqipja dhe anglishtja kanë saktësisht të njëjtat çelësa', () => {
  const left = new Set(allKeys(sq));
  const right = new Set(allKeys(en));
  assert.deepEqual([...left].filter(key => !right.has(key)), [], 'mungojnë në anglisht');
  assert.deepEqual([...right].filter(key => !left.has(key)), [], 'mungojnë në shqip');
});

test('çdo çelës i përdorur në kod ekziston', () => {
  const namespaces = Object.keys(sq).join('|');
  const pattern = new RegExp(`['"\`]((?:${namespaces})\\.[a-zA-Z0-9_.]+)['"\`]`, 'g');
  const keys = new Set(allKeys(sq));
  const missing = [];
  for (const file of jsFiles('js').filter(path => !path.includes('i18n'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      const key = match[1];
      // Çelësat me shumës (days.one/other) dhe prefikset dinamike kontrollohen më poshtë.
      if (!keys.has(key) && !allKeys(sq).some(existing => existing.startsWith(`${key}.`))) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('çelësat dinamikë ekzistojnë për çdo vlerë të mundshme', () => {
  const keys = new Set(allKeys(sq));
  const sets = {
    'metrics.': ['mood', 'sleep', 'energy', 'social', 'joy', 'load'],
    'report.reasons.': ['spam', 'harassment', 'hate', 'safety_concern', 'sexual', 'privacy', 'impersonation', 'other'],
    'report.types.': ['post', 'reply', 'profile', 'message', 'conversation'],
    'report.status.': ['open', 'actioned', 'dismissed'],
    'notify.cat_': ['daily_reminder', 'weekly_snapshot', 'connection_request', 'connection_accepted', 'unread_message', 'challenge_ending', 'app_update'],
    'notify.catHint_': ['daily_reminder', 'weekly_snapshot', 'connection_request', 'connection_accepted', 'unread_message', 'challenge_ending', 'app_update'],
    'notify.permission_': ['default', 'granted', 'denied', 'unsupported'],
    'mentor.status_': ['pending', 'active', 'expired', 'revoked'],
    'mentor.log_': ['created', 'accepted', 'viewed', 'downloaded', 'revoked', 'expired_view_denied'],
    'challenges.t_': ['checkins_5_in_7', 'activities_3_days', 'weekly_snapshot', 'export_backup', 'routine', 'reach_out'],
    'challenges.ach_': ['first_checkin', 'seven_checkins', 'baseline_ready', 'first_challenge', 'three_challenges', 'backup_exported'],
    'community.react_': ['support', 'thanks', 'same'],
    'community.status_': ['visible', 'hidden', 'removed', 'deleted'],
    'ai.p_': ['explain_chart', 'explain_calculation', 'reflection_questions', 'summarize', 'draft_message', 'organize_notes'],
    'plus.s_': ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'],
    'admin.m_': ['community', 'connections', 'messages', 'challenges', 'mentor', 'notifications', 'ai', 'subscriptions', 'analytics', 'admin'],
    'admin.tab_': ['reports', 'sanctions', 'flags', 'pilot', 'roles', 'content', 'analytics', 'audit', 'billing'],
    'nav.': ['dashboard', 'checkin', 'challenges', 'normal', 'changed', 'why', 'patterns', 'helps', 'assistant', 'connect', 'community', 'network', 'mentor', 'data', 'account', 'notifications', 'subscription', 'privacy', 'admin'],
    'errors.': ['rate_limited', 'not_found', 'feature_disabled', 'nickname_reserved', 'duplicate_content', 'too_many_links', 'reauth_required', 'forbidden',
      'forbidden_self', 'invalid_code', 'profile_required', 'suspended', 'not_connected', 'cannot_report_self', 'grant_inactive', 'outside_range',
      'invalid_timezone', 'not_configured', 'unsafe_output', 'provider_error', 'provider_unreachable', 'invalid_endpoint', 'challenge_ended', 'no_customer', 'no_subscription']
  };
  const missing = [];
  for (const [prefix, values] of Object.entries(sets)) for (const value of values) if (!keys.has(prefix + value)) missing.push(prefix + value);
  assert.deepEqual(missing, []);
});

test('analitika: ngjarjet e lejuara kalojnë, fushat e ndaluara refuzohen', () => {
  assert.equal(validateEvent('screen_opened', { screen: 'dashboard' }).ok, true);
  assert.equal(validateEvent('performance', { screen: 'boot', duration_ms: 420 }).ok, true);
  for (const key of ['mood', 'note', 'notes', 'activities', 'my5', 'message', 'email', 'nickname', 'birthdate', 'ciphertext', 'prompt', 'response', 'location', 'passphrase', 'card']) {
    assert.equal(validateEvent('screen_opened', { [key]: 'x' }).ok, false, key);
    assert.ok(FORBIDDEN_KEYS.includes(key), key);
  }
  assert.equal(validateEvent('screen_opened', { screen: 'Arta Berisha' }).ok, false, 'free text');
  assert.equal(validateEvent('diagnosis', {}).ok, false, 'unknown event');
  assert.equal(validateEvent('operation_result', { outcome: 'maybe' }).ok, false);
});

test('sfidat numërojnë pjesëmarrjen, jo vlerat', () => {
  const profile = generateProfile({ store: true });
  const last = profile.checkins[profile.checkins.length - 1].date;
  const start = profile.checkins[profile.checkins.length - 7].date;
  const challenge = { ...newChallenge('checkins_5_in_7', start), end: last };
  const before = challengeProgress(challenge, profile);
  // Ndryshimi i vlerave nuk ndikon në progres.
  for (const entry of profile.checkins) entry.mood = 1;
  assert.deepEqual(challengeProgress(challenge, profile), before);
  assert.equal(before.done, true);
  const routine = newChallenge('routine', last, { target: 2 });
  routine.ticks = [last];
  assert.equal(challengeProgress(routine, profile).count, 1);
  assert.throws(() => newChallenge('routine', last, { start: last, end: '2000-01-01' }));
  profile.settings.hiddenAchievements = ['first_checkin'];
  const first = achievements(profile).find(item => item.key === 'first_checkin');
  assert.equal(first.earned && first.hidden, true);
});

test('ndarja me mentor: vetëm kategoritë e zgjedhura, kurrë shënime', () => {
  const profile = generateProfile({ store: true });
  const from = profile.checkins[0].date;
  const to = profile.checkins[4].date;
  const rows = buildDayEntries(profile, { categories: ['sleep', 'mood'], range_start: from, range_end: to });
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row.payload).sort(), ['mood', 'sleep']);
    assert.ok(!JSON.stringify(row).includes('note'));
  }
  const week = buildWeekEntry(profile, to);
  assert.deepEqual(Object.keys(week.payload).sort(), ['changes', 'days']);
  for (const change of week.payload.changes) assert.deepEqual(Object.keys(change).sort(), ['direction', 'metric', 'pct']);
  assert.equal(grantStatus({ revoked_at: null, expires_at: '2000-01-01', mentor_id: 'x' }), 'expired');
  assert.equal(grantStatus({ revoked_at: '2026-01-01', expires_at: '2999-01-01', mentor_id: 'x' }), 'revoked');
  assert.equal(grantStatus({ revoked_at: null, expires_at: '2999-01-01', mentor_id: null }), 'pending');
});

test('anglishtja: draftet, arsyet dhe numrat përkthehen; fjalia "jo shkak" mbetet në të dyja gjuhët', async () => {
  const { setLang, t } = await import('../js/i18n/index.js');
  const { draftMessage, weeklyReflection, CONNECT_ACTIVITIES, TONES } = await import('../js/compose.js');
  const { METRIC_LABELS, METRIC_ENDS, tagLabel } = await import('../js/patterns.js');
  const { formatDateLong, formatWeekday } = await import('../js/format.js');
  const profile = generateProfile({ store: true });
  try {
    assert.equal(draftMessage({ name: 'Arta' }, 'short', 'kafe', 2), 'Arta, një kafe nesër?');
    assert.equal(formatDateLong('2026-09-24'), '24 shtator 2026');
    setLang('en');
    assert.equal(draftMessage({ name: 'Arta' }, 'short', 'kafe', 2), 'Arta, a coffee tomorrow?');
    assert.equal(draftMessage({ name: 'Arta' }, 'warm', 'shetitje', 2), 'Arta, I miss you. A walk this week?');
    assert.equal(METRIC_LABELS.social, 'Social connection');
    assert.equal(METRIC_ENDS.load.high, 'overloaded');
    assert.equal(tagLabel('mesim'), 'Studying');
    assert.equal(CONNECT_ACTIVITIES.telefonate, 'a short phone call');
    assert.deepEqual(Object.keys(TONES), ['casual', 'warm', 'direct', 'short']);
    assert.equal(formatDateLong('2026-09-24'), '24 September 2026');
    assert.match(formatWeekday('2026-09-24'), /^Thursday, /);
    const reflection = weeklyReflection(profile);
    assert.ok(reflection.enough && /^[A-Z][^ë]*\?$/.test(reflection.question), reflection.question);
    assert.equal(t('pat.notCause'), 'This is a pattern in your data, not a cause.');
  } finally {
    setLang('sq');
  }
  assert.equal(t('pat.notCause'), 'Ky është pattern në të dhënat e tua, jo shkak.');
});

test('asnjë emër gjendjeje mjekësore në tekstet e ndërfaqes', () => {
  // Mohimet ("nuk jep pikë rreziku") lejohen; emrat e gjendjeve jo, as në mohim.
  const forbidden = /depres|anxiety|ankth|disorder|çrregullim|bipolar|adhd|ptsd|schizo|skizo|burnout|trauma/i;
  const values = [];
  const walk = node => { for (const value of Object.values(node)) typeof value === 'string' ? values.push(value) : walk(value); };
  walk(sq); walk(en);
  assert.deepEqual(values.filter(value => forbidden.test(value)), []);
});
