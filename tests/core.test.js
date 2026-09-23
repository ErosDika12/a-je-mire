// Teste pa shfletues: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage i rremë, që të shohim saktësisht çfarë shkruhet.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};

const { encryptJson, decryptJson } = await import('../js/cloud/crypto.js');
const { saveProfile, saveLocalBackup, migrate, validateProfile } = await import('../js/storage.js');
const { findConflicts, mergeProfiles } = await import('../js/merge.js');
const { generateProfile } = await import('../js/seed.js');

const profile = generateProfile({ store: true, ai: false, acceptedAt: '2026-09-01T00:00:00Z' });

test('encrypt → decrypt kthen të njëjtin profil', async () => {
  const box = await encryptJson(profile, 'nje fjalekalim i gjate');
  assert.ok(!box.ciphertext.includes('checkins'), 'teksti i enkriptuar nuk duhet të përmbajë tekst të lexueshëm');
  const back = await decryptJson(box, 'nje fjalekalim i gjate');
  assert.deepEqual(back, JSON.parse(JSON.stringify(profile)));
});

test('kripa dhe IV janë të ndryshme çdo herë', async () => {
  const first = await encryptJson({ a: 1 }, 'nje fjalekalim i gjate');
  const second = await encryptJson({ a: 1 }, 'nje fjalekalim i gjate');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('fjalëkalimi i gabuar dhe teksti i ndryshuar refuzohen', async () => {
  const box = await encryptJson({ a: 1 }, 'nje fjalekalim i gjate');
  await assert.rejects(decryptJson(box, 'tjeter fjalekalim'), /passphrase/);
  const bytes = Buffer.from(box.ciphertext, 'base64');
  bytes[0] ^= 1;
  await assert.rejects(decryptJson({ ...box, ciphertext: bytes.toString('base64') }, 'nje fjalekalim i gjate'), /passphrase/);
});

test('asgjë nuk shkruhet pa consent', () => {
  store.clear();
  const noConsent = migrate({ ...profile, consent: { store: false } });
  assert.equal(saveProfile(noConsent), false);
  assert.equal(saveLocalBackup(noConsent), false);
  assert.equal(store.size, 0);
  assert.equal(saveProfile(profile), true);
  assert.equal(store.size, 1);
});

test('bashkimi: shton ditët që mungojnë, konflikti mban versionin lokal', () => {
  const local = migrate(JSON.parse(JSON.stringify(profile)));
  const incoming = migrate(JSON.parse(JSON.stringify(profile)));
  const conflictDate = incoming.checkins[5].date;
  incoming.checkins[5].mood = local.checkins[5].mood === 5 ? 4 : 5;
  incoming.checkins.push({ date: '2099-01-01', mood: 3, activities: [], note: '' });
  local.checkins.splice(0, 1);

  const conflicts = findConflicts(local, incoming);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].date, conflictDate);

  const kept = mergeProfiles(local, incoming);
  assert.equal(kept.summary.added, 2);
  assert.equal(kept.summary.keptLocal, 1);
  assert.equal(kept.profile.checkins.find(entry => entry.date === conflictDate).mood, local.checkins[4].mood);

  const taken = mergeProfiles(local, incoming, { [conflictDate]: 'incoming' });
  assert.equal(taken.profile.checkins.find(entry => entry.date === conflictDate).mood, incoming.checkins[5].mood);
});

test('MY 5 nuk kalon kurrë pesë persona pas bashkimit', () => {
  const people = n => Array.from({ length: n }, (_, i) => ({ name: `P${i}` }));
  const merged = mergeProfiles(migrate({ ...profile, my5: people(4) }), migrate({ ...profile, my5: people(5).map(p => ({ name: p.name + 'x' })) }));
  assert.equal(merged.profile.my5.length, 5);
});

test('importi nuk merr gjendjen e sinkronizimit nga fajlli', () => {
  const result = validateProfile({ ...profile, sync: { deviceId: 'huaj', revision: 9 } });
  assert.equal(result.ok, true);
  assert.equal(result.profile.sync, null);
});
