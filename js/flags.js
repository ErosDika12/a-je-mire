// Flamujt e veçorive, në dy shtresa:
// 1. Tavani i build-it (këtu, sipas mjedisit): një modul i papërfunduar nuk shfaqet kurrë në prodhim,
//    edhe nëse dikush e ndez gabimisht në bazë.
// 2. Flamujt e serverit (tabela feature_flags): administratori e fik ose e ndez pa deploy të ri.
// Ndërfaqja fsheh; autorizimi i vërtetë mbetet te RLS-ja në bazë.
import { getClient, cloudConfigured } from './cloud/client.js';

export const MODULES = ['community', 'connections', 'messages', 'challenges', 'mentor', 'notifications', 'ai', 'subscriptions', 'analytics', 'admin'];

// Modulet që punojnë plotësisht pa server (sfidat private jetojnë në pajisje).
const LOCAL_ONLY = new Set(['challenges']);

const BUILD_CEILING = {
  development: Object.fromEntries(MODULES.map(key => [key, true])),
  preview: Object.fromEntries(MODULES.map(key => [key, true])),
  production: {
    community: false, connections: false, messages: false, challenges: true, mentor: false,
    notifications: false, ai: false, subscriptions: false, analytics: true, admin: true
  }
};

export function environment() {
  const env = import.meta.env || {};
  const declared = env.VITE_APP_ENV;
  if (declared === 'production' || declared === 'preview' || declared === 'development') return declared;
  return env.DEV ? 'development' : 'production';
}

let serverFlags = null;
const listeners = new Set();

export function onFlagsChange(listener) {
  listeners.add(listener);
}

// Leximi i flamujve kërkon rrjet; bëhet vetëm kur përdoruesi ka hyrë në llogari,
// që modaliteti pa llogari të mos kontaktojë asnjë server.
export async function loadServerFlags() {
  if (!cloudConfigured()) return;
  try {
    const { data, error } = await getClient().from('feature_flags').select('*');
    if (error) throw error;
    serverFlags = Object.fromEntries(data.map(row => [row.key, row]));
  } catch (error) {
    serverFlags = null;
  }
  for (const listener of listeners) listener();
}

export function clearServerFlags() {
  serverFlags = null;
  for (const listener of listeners) listener();
}

export function buildAllows(key) {
  return Boolean(BUILD_CEILING[environment()][key]);
}

// A duhet të shfaqet moduli në ndërfaqe?
export function isEnabled(key) {
  if (!buildAllows(key)) return false;
  if (LOCAL_ONLY.has(key)) return true;
  const row = serverFlags && serverFlags[key];
  return Boolean(row && row.server_enabled && row[`enabled_${environment()}`]);
}

// Pjesa e sfidave me miqtë ka nevojë edhe për serverin.
export function serverEnabled(key) {
  const row = serverFlags && serverFlags[key];
  return Boolean(buildAllows(key) && row && row.server_enabled && row[`enabled_${environment()}`]);
}

export function snapshot() {
  return Object.fromEntries(MODULES.map(key => [key, { build: buildAllows(key), server: serverFlags ? serverFlags[key] || null : null, visible: isEnabled(key) }]));
}
