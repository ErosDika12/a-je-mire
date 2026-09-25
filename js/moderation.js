// Siguria e Community-t. Kontrollet automatike mund të SHËNOJNË përmbajtje për shqyrtim;
// nuk janë të përsosura dhe nuk marrin vendime të rënda vetë — vendimi i takon një moderatori njerëzor.
export const REPORT_CATEGORIES = ['bullying', 'harassment', 'sexual', 'hate', 'threats', 'impersonation', 'spam', 'photo', 'private_info', 'dangerous', 'other'];
export const AGE_GROUPS = ['13-15', '16-17', '18+'];

// Lidhjet nuk lejohen në demo: shumica e lidhjeve të dëmshme vijnë si URL.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|me|app|gg|ly|xyz|ru|tk)\b)/i;
// Kërkesa për informacion privat (numër, adresë, shkollë, vendndodhje, foto private, aplikacione të tjera).
const PRIVATE_ASK = /(numr[ia]n?\s*(tënd|tend|e telefonit)|ku\s+jeton|adres[ëa]n?|në cilën shkollë|ne cilen shkolle|your (number|address)|where do you live|which school|send (me )?(a )?(pic|photo)|snapchat|whatsapp|telegram|deine (nummer|adresse)|wo wohnst du|welche schule|schick (mir )?(ein )?(foto|bild)|location|lokacion)/i;
// Të dhëna private të vetë përdoruesit (telefon ose email) — mbrohen para se të postohen.
const PHONE = /(\+?\d[\d\s-]{7,}\d)/;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
// Listë e vogël fjalësh fyese (sq/en/de). Me qëllim e shkurtër: moderimi njerëzor e plotëson.
const INSULTS = /\b(idiot|budall[aë]q?|rrot|pis|stupid|loser|dumm|hure|kurv|fuck|shit|scheiße|scheisse)\b/i;

export function checkText(text) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > 500) return { ok: false, reason: 'too_long' };
  if (LINK.test(value)) return { ok: false, reason: 'link' };
  if (PHONE.test(value) || EMAIL.test(value)) return { ok: false, reason: 'own_private' };
  if (PRIVATE_ASK.test(value)) return { ok: true, flag: 'private_info' };
  if (INSULTS.test(value)) return { ok: true, flag: 'bullying' };
  return { ok: true, flag: null };
}

// Kufiri i shpejtësisë: maksimum 5 postime/mesazhe në minutë; teksti i njëjtë nuk përsëritet.
export function rateCheck(state, text, now = Date.now()) {
  const recent = (state.rate || []).filter(r => now - r.at < 60000);
  if (recent.length >= 5) return 'rate_limited';
  if (recent.some(r => r.text === String(text).trim())) return 'duplicate';
  return null;
}

export function recordRate(state, text, now = Date.now()) {
  state.rate = [...(state.rate || []).filter(r => now - r.at < 60000), { at: now, text: String(text).trim() }].slice(-10);
}

// Fotot në Community: vetëm formate të zakonshme, jo shumë të mëdha. Asnjë analizë e përmbajtjes.
export function checkImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return 'image_type';
  if (file.size > 5 * 1024 * 1024) return 'image_size';
  return null;
}

// Të rriturit nuk lidhen kurrë me të miturit.
export function canMatch(myAge, theirAge) {
  if (!myAge || !theirAge) return false;
  // Grupmoshat nuk përzihen: 13–15 me 13–15, 16–17 me 16–17, 18+ vetëm me 18+.
  return myAge === theirAge;
}
