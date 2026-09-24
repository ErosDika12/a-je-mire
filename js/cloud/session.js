// Gjendja e përbashkët e hyrjes, që çdo ekran i ri ta lexojë pa u varur nga ekrani i Llogarisë.
import { getClient, cloudConfigured } from './client.js';
import { loadServerFlags, clearServerFlags } from '../flags.js';
import { t } from '../i18n/index.js';

let user = null;
let roles = [];
let started = false;
const listeners = new Set();

export function currentUser() {
  return user;
}

export function myRoles() {
  return roles;
}

export function hasRole(...wanted) {
  return roles.some(role => wanted.includes(role));
}

export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function refreshRoles() {
  roles = [];
  if (!user) return;
  const { data } = await getClient().rpc('my_roles');
  roles = Array.isArray(data) ? data : [];
}

// Thirret nga Llogaria sa herë ndryshon sesioni.
export async function setSessionUser(next) {
  const changed = (next && next.id) !== (user && user.id);
  user = next || null;
  if (!changed) return;
  if (user) {
    await Promise.all([refreshRoles(), loadServerFlags()]);
    // Pronari i parë (vetëm nëse emaili përputhet me konfigurimin në server).
    const { data: claimed } = await getClient().rpc('claim_owner');
    if (claimed) await refreshRoles();
  } else {
    roles = [];
    clearServerFlags();
  }
  for (const listener of listeners) listener(user);
}

export async function ensureSession() {
  if (!cloudConfigured()) return null;
  if (!started) {
    started = true;
    const client = getClient();
    const { data } = await client.auth.getSession();
    await setSessionUser(data.session ? data.session.user : null);
    client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => setSessionUser(session ? session.user : null), 0);
    });
  }
  return user;
}

// Gabimet e bazës vijnë si kode ("rate_limited:posts_10min"); ndërfaqja i kthen në fjali.
export function friendlyError(error) {
  const text = String((error && (error.message || error.error)) || error || '');
  const code = text.split(':')[0].trim();
  const known = ['rate_limited', 'not_found', 'feature_disabled', 'nickname_reserved', 'duplicate_content', 'too_many_links',
    'reauth_required', 'forbidden', 'forbidden_self', 'invalid_code', 'profile_required', 'suspended', 'not_connected',
    'cannot_report_self', 'grant_inactive', 'outside_range', 'invalid_timezone', 'not_configured', 'unsafe_output',
    'provider_error', 'provider_unreachable', 'invalid_endpoint', 'challenge_ended', 'no_customer', 'no_subscription'];
  if (known.includes(code)) return t(`errors.${code}`);
  if (/nickname_key|duplicate key/.test(text)) return t('errors.nickname_taken');
  if (/row-level security|permission denied|42501/.test(text)) return t('errors.forbidden');
  if (/fetch|network|Failed to fetch/i.test(text)) return t('errors.network');
  return t('errors.generic');
}

// Thirrje RPC që kthen { data } ose hedh gabim miqësor.
export async function rpc(name, params = {}) {
  const { data, error } = await getClient().rpc(name, params);
  if (error) throw new Error(friendlyError(error));
  return data;
}
