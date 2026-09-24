// Teste për MIRA-n: pa shfletues, pa rrjet.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};

globalThis.document = globalThis.document || { documentElement: {} };

const { SITUATIONS, NEEDS, summarize, buildPlan, looksUrgent, cleanPaths, planAsText } = await import('../js/mira.js');
const { saveProfile, migrate } = await import('../js/storage.js');
const { setLang } = await import('../js/i18n/index.js');
const mira = (await import('../js/i18n/screens/mira.js')).default;

test('përmbledhja përsërit vetëm atë që u shkrua', () => {
  const text = summarize({ situation: 'exams', text: 'Nesër kam test.' });
  assert.match(text, /presioni i provimeve/);
  assert.match(text, /“Nesër kam test\.”/);
  assert.doesNotMatch(summarize({ situation: 'exams', text: '' }), /“/);
});

test('plani ka katër pjesë dhe nuk është bosh për asnjë situatë ose nevojë', () => {
  for (const s of SITUATIONS) {
    for (const need of NEEDS) {
      const plan = buildPlan({ situation: s.id, need });
      for (const key of ['now', 'today', 'week', 'person']) {
        assert.ok(plan[key].length > 0 && plan[key].every(line => line && !line.startsWith('mira.')), `${s.id}/${need}/${key}`);
      }
    }
  }
});

test('ngacmimi sugjeron gjithmonë një të rritur të besuar', () => {
  const plan = buildPlan({ situation: 'bullying', need: 'advice' });
  assert.equal(plan.adult, true);
  assert.match(plan.person[0], /të rritur/);
});

test('"mund ta ndikoj" hyn në plan dhe sugjerimi tjetër ndryshon planin', () => {
  const plan = buildPlan({ situation: 'exams', need: 'focus', can: ['Ku e mbaj telefonin'] });
  assert.match(plan.today[0], /Ku e mbaj telefonin/);
  assert.notDeepEqual(buildPlan({ situation: 'exams', need: 'focus', variant: 0 }).now, buildPlan({ situation: 'exams', need: 'focus', variant: 1 }).now);
  assert.match(planAsText(plan), /^Tani\n• /);
});

test('fjalët e rrezikut hapin ndihmën reale', () => {
  assert.equal(looksUrgent('dua te vdes'), true);
  assert.equal(looksUrgent('I want to hurt myself'), true);
  assert.equal(looksUrgent('kam test nesër'), false);
});

test('rrugët e importuara pastrohen', () => {
  const clean = cleanPaths([{ date: '2026-09-24', situation: 'hack', need: 'x', plan: { now: ['a'] }, text: 'x'.repeat(5000) }, { date: 'bad' }]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].situation, 'other');
  assert.equal(clean[0].need, 'unknown');
  assert.equal(clean[0].text.length, 1200);
});

test('pa consent MIRA nuk shkruan asgjë në localStorage', () => {
  store.clear();
  const profile = migrate({ mode: 'private', consent: { store: false }, checkins: [], mira: { paths: [{ date: '2026-09-24', situation: 'exams' }] } });
  assert.equal(saveProfile(profile), false);
  assert.equal(store.size, 0);
});

test('shqipja dhe anglishtja kanë të njëjtët çelësa për MIRA-n', () => {
  const keys = (node, prefix = '') => Object.entries(node).flatMap(([k, v]) =>
    (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  assert.deepEqual(keys(mira.sq).sort(), keys(mira.en).sort());
});

test('MIRA në anglisht', () => {
  setLang('en');
  try {
    assert.match(summarize({ situation: 'lonely', text: '' }), /loneliness/);
  } finally {
    setLang('sq');
  }
});
