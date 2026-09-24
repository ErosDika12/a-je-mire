// Analitika opsionale, e ndarë nga çdo pëlqim tjetër dhe e fikur si parazgjedhje.
// Shtresa e validimit refuzon çdo ngjarje që përmban fusha të ndaluara, para se të largohet nga pajisja.
// Serveri e përsërit të njëjtin kontroll (track_event), që edhe një klient i modifikuar të mos kalojë.
import { getClient, cloudConfigured } from './cloud/client.js';
import { isEnabled } from './flags.js';

export const APP_VERSION = '2.1.0';
const ALLOWED_EVENTS = ['screen_opened', 'feature_enabled', 'operation_result', 'performance', 'flag_exposure'];
const ALLOWED_KEYS = ['screen', 'feature', 'outcome', 'duration_ms', 'flag', 'variant'];
// Emra që nuk duhet të shfaqen kurrë në një ngjarje, edhe si nën-fushë.
export const FORBIDDEN_KEYS = ['mood', 'sleep', 'energy', 'social', 'joy', 'load', 'value', 'values', 'checkin', 'checkins',
  'note', 'notes', 'activity', 'activities', 'my5', 'person', 'people', 'message', 'messages', 'body', 'text', 'email',
  'name', 'nickname', 'display_name', 'birth', 'birthdate', 'dob', 'ciphertext', 'payload', 'prompt', 'response',
  'location', 'lat', 'lng', 'passphrase', 'password', 'card', 'payment', 'iban'];

// Kthen { ok, reason } — përdoret nga track() dhe nga testet.
export function validateEvent(name, props = {}) {
  if (!ALLOWED_EVENTS.includes(name)) return { ok: false, reason: 'event' };
  if (!props || typeof props !== 'object' || Array.isArray(props)) return { ok: false, reason: 'props' };
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) return { ok: false, reason: `forbidden:${key}` };
    if (!ALLOWED_KEYS.includes(key)) return { ok: false, reason: `unknown:${key}` };
    if (key === 'duration_ms') {
      if (typeof value !== 'number' || value < 0 || value > 600000) return { ok: false, reason: 'duration' };
    } else if (key === 'outcome') {
      if (!['success', 'failure'].includes(value)) return { ok: false, reason: 'outcome' };
    } else if (typeof value !== 'string' || !/^[a-z0-9_]{1,32}$/.test(value)) {
      return { ok: false, reason: `format:${key}` };
    }
  }
  return { ok: true };
}

export function deviceCategory(width = window.innerWidth) {
  return width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

let consented = false;

export function setAnalyticsConsent(value) {
  consented = Boolean(value);
}

export function analyticsActive() {
  return consented && isEnabled('analytics') && cloudConfigured();
}

// Asnjë ngjarje nuk dërgohet pa pëlqim, pa modulin e ndezur, ose nëse nuk kalon validimin.
export async function track(name, props = {}) {
  if (!analyticsActive()) return false;
  const check = validateEvent(name, props);
  if (!check.ok) return false;
  try {
    const { data } = await getClient().rpc('track_event', { p_name: name, p_props: props, p_app_version: APP_VERSION, p_device: deviceCategory() });
    return Boolean(data);
  } catch (error) {
    return false;
  }
}
