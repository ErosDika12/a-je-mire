// Sinkronizimi "local-first": pajisja është burimi kryesor. Cloud-i mban vetëm një kopje
// të enkriptuar, dhe asgjë nuk ngarkohet pa e shtypur përdoruesi butonin.
import { getClient } from './client.js';
import { encryptJson, decryptJson } from './crypto.js';
import { migrate, POLICY_VERSION } from '../storage.js';

// Fjalëkalimi i sinkronizimit mbahet vetëm në memorien e kësaj faqeje, jo në disk.
let sessionPassphrase = null;
export function rememberPassphrase(value) { sessionPassphrase = value || null; }
export function currentPassphrase() { return sessionPassphrase; }
export function forgetPassphrase() { sessionPassphrase = null; }

export function ensureSyncState(profile) {
  if (!profile.sync) {
    profile.sync = { deviceId: crypto.randomUUID(), revision: null, lastSyncedAt: null, userId: null };
  }
  return profile.sync;
}

// Vetëm metadatat: pa tekstin e enkriptuar, që kontrolli të jetë i shpejtë.
export async function fetchBackupInfo() {
  const { data, error } = await getClient()
    .from('encrypted_backups')
    .select('revision, updated_at, device_id, format_version')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function downloadBackup(passphrase) {
  const { data, error } = await getClient()
    .from('encrypted_backups')
    .select('ciphertext, salt, iv, format_version, revision, updated_at, device_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const plain = await decryptJson(
    { ciphertext: data.ciphertext, salt: data.salt, iv: data.iv, formatVersion: data.format_version },
    passphrase
  );
  return { profile: migrate(plain), revision: data.revision, updatedAt: data.updated_at, deviceId: data.device_id };
}

/**
 * Ngarkon profilin e enkriptuar. expectedRevision është revizioni që pajisja njihte;
 * nëse në cloud ka diçka më të re, serveri kthen conflict dhe asgjë nuk mbishkruhet.
 */
export async function uploadBackup(profile, passphrase, expectedRevision) {
  const sync = ensureSyncState(profile);
  // Gjendja e sinkronizimit nuk futet në kopje: i përket vetëm kësaj pajisjeje.
  const { sync: omitted, ...payload } = profile;
  const box = await encryptJson(payload, passphrase);
  const { data, error } = await getClient().rpc('save_backup', {
    p_ciphertext: box.ciphertext,
    p_salt: box.salt,
    p_iv: box.iv,
    p_format_version: box.formatVersion,
    p_device_id: sync.deviceId,
    p_expected_revision: expectedRevision
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { revision: row.revision, updatedAt: row.updated_at, conflict: row.conflict };
}

export async function deleteCloudBackup() {
  const { error } = await getClient().from('encrypted_backups').delete().not('user_id', 'is', null);
  if (error) throw error;
}

export async function listConsentRecords() {
  const { data, error } = await getClient()
    .from('consent_records')
    .select('kind, granted, policy_version, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addConsentRecord(userId, kind, granted) {
  const { error } = await getClient()
    .from('consent_records')
    .insert({ user_id: userId, kind, granted, policy_version: POLICY_VERSION });
  if (error) throw error;
}

export async function deleteAccount() {
  const { error } = await getClient().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
