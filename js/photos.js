// Fotot e My Week. Ruhen VETËM në këtë pajisje (IndexedDB) dhe vetëm pasi përdoruesi ka lejuar ruajtjen.
// Pa leje, fotot mbahen vetëm në memorie deri në rifreskim. Asnjë njohje fytyre, asnjë analizë e fotos.
const DB_NAME = 'ajemire-photos';
const STORE = 'photos';
const MAX_SIDE = 1280;
const memory = new Map();          // id → Blob (pa consent, ose si cache)
const urls = new Map();            // id → objectURL

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(result && result.result !== undefined ? result.result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Zvogëlon foton para ruajtjes (më pak hapësirë, më pak detaje të panevojshme). Metadata EXIF nuk ruhen.
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

const allowed = profile => Boolean(profile && profile.consent && profile.consent.store === true);

export async function addPhoto(profile, file) {
  if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('not-image');
  if (file.size > 15 * 1024 * 1024) throw new Error('too-large');
  const blob = await shrink(file);
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  memory.set(id, blob);
  if (allowed(profile)) await withStore('readwrite', store => store.put(blob, id));
  return id;
}

export async function photoUrl(photo) {
  if (!photo) return '';
  if (photo.synthetic) return photo.src;
  if (urls.has(photo.id)) return urls.get(photo.id);
  let blob = memory.get(photo.id);
  if (!blob) {
    try { blob = await withStore('readonly', store => store.get(photo.id)); } catch { blob = null; }
  }
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urls.set(photo.id, url);
  return url;
}

export async function deletePhoto(id) {
  memory.delete(id);
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  try { await withStore('readwrite', store => store.delete(id)); } catch { /* nuk kishte bazë */ }
}

// Kur përdoruesi i fshin të gjitha të dhënat, fshihet edhe baza e fotove.
export function deleteAllPhotos() {
  memory.clear();
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB_NAME);
}

// Pas pëlqimit, fotot që ishin vetëm në memorie kalojnë në pajisje.
export async function persistPending(profile) {
  if (!allowed(profile)) return;
  for (const [id, blob] of memory) {
    try { await withStore('readwrite', store => store.put(blob, id)); } catch { /* vazhdo */ }
  }
}
