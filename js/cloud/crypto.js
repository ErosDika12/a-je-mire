// Enkriptimi i kopjes rezervë, krejt në pajisje, me Web Crypto të shfletuesit.
// Nuk shkruajmë algoritme vetë: përdorim vetëm PBKDF2 dhe AES-GCM që i ofron shfletuesi.
// Fjalëkalimi i sinkronizimit dhe çelësi nuk ruhen askund dhe nuk dërgohen kurrë.

export const FORMAT_VERSION = 1;
// Shumë përsëritje e bëjnë hamendësimin e fjalëkalimit të ngadaltë për një sulmues.
export const PBKDF2_ITERATIONS = 600000;
export const MIN_PASSPHRASE = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes) {
  let text = '';
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) {
    text += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(text);
}

export function fromBase64(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function deriveKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  // extractable: false — çelësi nuk mund të nxirret as nga vetë kodi ynë.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Kripa dhe IV janë të rastësishme çdo herë, prandaj i njëjti profil jep tekst tjetër çdo herë.
export async function encryptJson(value, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return {
    ciphertext: toBase64(cipher),
    salt: toBase64(salt),
    iv: toBase64(iv),
    formatVersion: FORMAT_VERSION
  };
}

// AES-GCM kontrollon edhe integritetin: fjalëkalim i gabuar ose tekst i ndryshuar jep gabim, jo mbeturina.
export async function decryptJson(box, passphrase) {
  if (!box || box.formatVersion !== FORMAT_VERSION) throw new Error('format');
  const key = await deriveKey(passphrase, fromBase64(box.salt));
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.ciphertext));
  } catch (error) {
    throw new Error('passphrase');
  }
  return JSON.parse(decoder.decode(plain));
}
