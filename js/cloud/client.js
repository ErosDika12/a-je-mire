// Lidhja me Supabase krijohet vetëm kur përdoruesi e kërkon (hap Llogarinë ose vjen nga një link emaili).
// Pa llogari, aplikacioni nuk kontakton asnjë server.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client = null;
let allowPersist = false;
const memory = new Map();

export function cloudConfigured() {
  return Boolean(URL && KEY);
}

// Sesioni i hyrjes ruhet në memorie derisa përdoruesi të pranojë ruajtjen lokale.
// Kështu edhe hyrja respekton rregullin: asgjë në localStorage para consent-it.
const authStorage = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key);
    if (!allowPersist) return null;
    try { return localStorage.getItem(key); } catch (error) { return null; }
  },
  setItem(key, value) {
    memory.set(key, value);
    if (!allowPersist) return;
    try { localStorage.setItem(key, value); } catch (error) { /* ruajtja e bllokuar */ }
  },
  removeItem(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch (error) { /* asgjë */ }
  }
};

export function setAuthPersistence(allowed) {
  allowPersist = Boolean(allowed);
  if (!allowPersist) return;
  for (const [key, value] of memory) {
    try { localStorage.setItem(key, value); } catch (error) { /* asgjë */ }
  }
}

export function getClient() {
  if (!cloudConfigured()) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        storage: authStorage,
        storageKey: 'ajemire.auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  }
  return client;
}

// A erdhi faqja nga një link emaili (verifikim ose rivendosje fjalëkalimi)?
export function isAuthRedirect() {
  const search = new URLSearchParams(location.search);
  return search.has('code') || search.has('error_description') || /access_token|type=recovery|error_description/.test(location.hash);
}

// Ku kthehen linqet e emailit. Duhet të jetë në listën e lejuar te Supabase → Auth → URL Configuration.
export function redirectUrl() {
  return `${location.origin}/`;
}
