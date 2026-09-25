// Teste për v3: Sot, Focus, Friction Map, yjet, Weekly Story, moderimi, Community dhe gjermanishtja.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document = globalThis.document || { documentElement: {} };

const { dayOf, moveThing, frictionSummary, cleanDays, shiftIso } = await import('../js/life.js');
const { startSession, pause, resume, remainingMs, finishSession, cleanFocus } = await import('../js/focus.js');
const { collectStars, layout, compare, textSummary } = await import('../js/stars.js');
const { collectFacts, composeStory } = await import('../js/story.js');
const { weekStart } = await import('../js/week-data.js');
const { checkText, rateCheck, recordRate, canMatch } = await import('../js/moderation.js');
const { profilesFor, cleanCommunity } = await import('../js/community-data.js');
const { generateProfile } = await import('../js/seed.js');
const { migrate, saveProfile } = await import('../js/storage.js');
const { helpMeStart, draft } = await import('../js/coach.js');
const { setLang, t, LANGUAGES } = await import('../js/i18n/index.js');

const today = '2026-09-24';

test('kalimi i detyrës në ditën tjetër nuk ndëshkon dhe shkon në Friction Map', () => {
  const p = { days: {} };
  dayOf(p, today).thing = { text: 'Hartimi', steps: [], done: false, movedFrom: null };
  const target = moveThing(p, today, ['phone', 'tired']);
  assert.equal(target, shiftIso(today, 1));
  assert.equal(p.days[target].thing.movedFrom, today);
  const s = frictionSummary(p);
  assert.equal(s.total, 1);
  assert.match(s.rows[0].text, /1 nga 1/);
});

test('Focus: koha rikuperohet nga orari i fillimit dhe pauza nuk e zvogëlon', () => {
  const p = {};
  const t0 = 1_000_000;
  startSession(p, { task: 'Mat', mode: 'exam', minutes: 25, now: t0 });
  pause(p.focus.active, t0 + 60_000);
  resume(p.focus.active, t0 + 120_000);
  // Pas "rifreskimit" (pastrimi i të dhënave të ruajtura) seanca vazhdon.
  p.focus = cleanFocus(JSON.parse(JSON.stringify(p.focus)));
  assert.equal(remainingMs(p.focus.active, t0 + 180_000), 25 * 60_000 - 120_000);
  const rec = finishSession(p, 'stopped', today, t0 + 180_000);
  assert.equal(rec.outcome, 'stopped');
  assert.equal(p.focus.active, null);
});

test('yjet vijnë vetëm nga të dhënat e regjistruara dhe kanë përmbledhje me tekst', () => {
  const demo = migrate(generateProfile({ store: true }, new Date(`${today}T12:00:00`)));
  const stars = collectStars(demo, shiftIso(today, -6), today);
  assert.ok(stars.length > 10);
  assert.ok(stars.every(s => s.date >= shiftIso(today, -6) && s.date <= today));
  const placed = layout(stars, today, 7);
  assert.ok(placed.every(s => s.x >= 0 && s.x <= 600 && s.y >= 0 && s.y <= 600));
  assert.ok(textSummary(stars).length > 0);
  const c = compare(stars, 'feeling', 'focus');
  assert.ok(c.both >= 0 && c.onlyA >= 0);
});

test('Weekly Story nuk shpik: çdo fakt vjen nga të dhënat, faktet e hequra nuk shfaqen', () => {
  const demo = migrate(generateProfile({ store: true }, new Date(`${today}T12:00:00`)));
  const start = weekStart(today);
  const facts = collectFacts(demo, start);
  assert.ok(facts.length > 3 && facts.every(f => f.source));
  const without = composeStory(facts, ['people'], 'simple');
  const people = facts.find(f => f.id === 'people');
  if (people) assert.ok(!without.includes(people.text));
  assert.doesNotMatch(composeStory(facts, [], 'reflective'), /\.\./);
  assert.equal(composeStory(facts, facts.map(f => f.id), 'simple'), t('week.storyEmpty'));
});

test('moderimi: lidhjet dhe të dhënat private bllokohen, kërkesat private shënohen për shqyrtim', () => {
  assert.equal(checkText('shiko www.example.com').reason, 'link');
  assert.equal(checkText('numri im +383 44 123 456').reason, 'own_private');
  assert.equal(checkText('ku jeton ti?').flag, 'private_info');
  assert.equal(checkText('Kush vjen në studim?').flag, null);
  const s = {};
  for (let i = 0; i < 5; i++) recordRate(s, `m${i}`, 1000 + i);
  assert.equal(rateCheck(s, 'tjetër', 2000), 'rate_limited');
});

test('grupmoshat nuk përzihen dhe të rriturit nuk lidhen me të miturit', () => {
  assert.equal(canMatch('13-15', '16-17'), false);
  assert.equal(canMatch('18+', '16-17'), false);
  assert.equal(canMatch('16-17', '16-17'), true);
  assert.ok(profilesFor('13-15').every(p => p.age === '13-15'));
  assert.equal(profilesFor('18+').length, 0);
  const cleaned = cleanCommunity({ requests: { rina: 'incoming', fake: 'accepted' }, friends: ['rina', 'x'] });
  assert.deepEqual(cleaned.requests, { rina: 'incoming' });
  assert.deepEqual(cleaned.friends, ['rina']);
});

test('pa consent asgjë e v3 nuk shkruhet', () => {
  store.clear();
  const p = migrate({ mode: 'private', consent: { store: false }, checkins: [], days: { [today]: { feeling: { word: 'x', strength: 2 } } } });
  assert.equal(saveProfile(p), false);
  assert.equal(store.size, 0);
});

test('Help Me Start dhe draftet: lokale, pa emra të shpikur', () => {
  assert.equal(helpMeStart('hartimi për letërsi').kind, 'write');
  assert.equal(helpMeStart('diçka tjetër').kind, 'general');
  assert.doesNotMatch(draft('apologize', 'calm', ''), /\{name\}/);
  assert.match(draft('apologize', 'warm', 'Arta'), /^Hej Arta,/);
});

test('gjermanishtja: tekstet kryesore ekzistojnë dhe nuk ka emra gjendjesh mjekësore', () => {
  const keys = (node, prefix = '') => Object.entries(node).flatMap(([k, v]) =>
    (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  const de = LANGUAGES.de;
  for (const ns of ['mira', 'today', 'focus', 'tool', 'sup', 'stars', 'week', 'cm', 'd60', 'coach', 'nav', 'core', 'checkin', 'data', 'privacy']) {
    const missing = keys(LANGUAGES.en[ns]).filter(k => !keys(de[ns] || {}).includes(k));
    assert.deepEqual(missing, [], `de.${ns}`);
  }
  const forbidden = /depres|anxiety|ankth|disorder|çrregullim|bipolar|adhd|ptsd|schizo|skizo|burnout|trauma|störung/i;
  const values = [];
  const walk = node => { for (const v of Object.values(node)) typeof v === 'string' ? values.push(v) : v && walk(v); };
  walk(de);
  assert.deepEqual(values.filter(v => forbidden.test(v)), []);
  setLang('de');
  try { assert.equal(t('nav.dashboard'), 'Heute'); assert.equal(t('mira.title'), 'Was ist los?'); } finally { setLang('sq'); }
});

test('pastrimi i ditëve heq vlerat e pavlefshme', () => {
  const d = cleanDays({ bad: {}, [today]: { feeling: { word: 'x', strength: 9 }, pause: { id: 'hack' } } });
  assert.deepEqual(Object.keys(d), [today]);
  assert.equal(d[today].feeling.strength, 2);
  assert.equal(d[today].pause, null);
});
