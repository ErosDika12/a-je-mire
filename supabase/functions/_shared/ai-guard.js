// Rregullat e asistentit AI, të përbashkëta për serverin (Edge Function) dhe testet.
// Asistenti shpjegon, pyet, përmbledh — nuk diagnostikon, nuk parashikon, nuk jep pikë rreziku.

export const PURPOSES = ['explain_chart', 'explain_calculation', 'reflection_questions', 'summarize', 'draft_message', 'organize_notes'];
const METRICS = ['mood', 'sleep', 'energy', 'social', 'joy', 'load'];
const CALCULATIONS = ['my_normal', 'something_changed', 'correlation', 'lagged_link', 'what_helps'];
const TONES = ['casual', 'warm', 'short', 'formal'];

// Hiqen gjurmët e identitetit që mund të kenë hyrë në tekst: email, telefon, lidhje, @emra.
export function redactIdentity(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '[numër]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[lidhje]')
    .replace(/(^|\s)@\w+/g, '$1[emër]');
}

function number(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? Math.round(value * 100) / 100 : undefined;
}

// Vetëm fushat e lejuara kalojnë; gjithçka tjetër hidhet pa u lexuar.
export function sanitizeRequest(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid' };
  const purpose = PURPOSES.includes(input.purpose) ? input.purpose : null;
  if (!purpose) return { ok: false, error: 'invalid_purpose' };
  const clean = { purpose, lang: input.lang === 'en' ? 'en' : 'sq' };

  if (input.metrics && typeof input.metrics === 'object') {
    clean.metrics = {};
    for (const metric of METRICS) {
      const source = input.metrics[metric];
      if (!source || typeof source !== 'object') continue;
      const item = {
        normal: number(source.normal, 0, 24),
        recent: number(source.recent, 0, 24),
        change_pct: number(source.change_pct, -100, 500)
      };
      if (Object.values(item).some(value => value !== undefined)) clean.metrics[metric] = item;
    }
  }
  if (input.series && typeof input.series === 'object') {
    clean.series = {};
    for (const metric of METRICS) {
      const list = input.series[metric];
      if (Array.isArray(list)) clean.series[metric] = list.slice(-30).map(value => number(value, 0, 24)).filter(value => value !== undefined);
    }
  }
  if (CALCULATIONS.includes(input.calculation)) clean.calculation = input.calculation;
  if (input.draft && typeof input.draft === 'object') {
    clean.draft = { tone: TONES.includes(input.draft.tone) ? input.draft.tone : 'casual' };
  }
  // Shënimet përfshihen vetëm kur përdoruesi i ka zgjedhur vetë, dhe kalojnë nga redaktimi i identitetit.
  if (Array.isArray(input.notes) && input.notes.length) {
    clean.notes = input.notes.slice(0, 10).map(note => redactIdentity(String(note).slice(0, 300)));
  }
  const size = JSON.stringify(clean).length;
  if (size > 6000) return { ok: false, error: 'too_large' };
  return { ok: true, value: clean };
}

// Përgjigja refuzohet nëse përmban gjuhë diagnostike, rrezik, krizë, ilaçe apo pretendim shkakësie.
// Lista përdor fjalë të përgjithshme — asnjë emër gjendjeje mjekësore nuk shkruhet në kod.
const FORBIDDEN = [
  /diagnos/i, /diagnoz/i, /disorder/i, /çrregullim/i, /syndrome/i, /sindrom/i,
  /\byou (have|suffer|are suffering)\b/i, /\bvuan(i)? nga\b/i, /\bke (një )?(sëmundje|problem mjekësor)/i,
  /\brisk (score|level)\b/i, /\bpikë rreziku\b/i, /\bnivel rreziku\b/i,
  // "\b" në JavaScript nuk e njeh "ë" si shkronjë, prandaj për fjalët shqipe përdoret vetëm fillimi.
  /\bcrisis\b/i, /\bkriz/i, /\bprognos/i,
  /\bmedicat/i, /\bilaç/i, /\bdos(e|age)\b/i, /\bprescri/i,
  /\bproves? that\b/i, /\bcauses? your\b/i, /\bshkakton\b/i, /\bprovon se\b/i
];

export function validateOutput(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 2500) return { ok: false, reason: 'length' };
  const hit = FORBIDDEN.find(pattern => pattern.test(trimmed));
  if (hit) return { ok: false, reason: 'forbidden_language' };
  return { ok: true, value: trimmed };
}

export function systemPrompt(lang) {
  const language = lang === 'en' ? 'English' : 'Albanian (shqip)';
  return [
    `You are a neutral reflection helper inside "A JE MIRË? 2036", a personal check-in app. Reply in ${language}, plainly, in at most 180 words.`,
    'You may only: explain what a chart or calculation shows, ask neutral reflection questions, summarise the numbers you are given, help draft an editable friendly message, or suggest ways to organise the user\'s own notes.',
    'Hard rules: never diagnose or name any medical or psychological condition; never predict a condition; never give a risk score, risk level or crisis assessment; never mention medication or treatment;',
    'never say a pattern proves a cause — use "moved together" or "appeared alongside"; compare only with the user\'s own earlier numbers, never with other people;',
    'never suggest contacting anyone automatically; never claim to replace a trusted person or professional support.',
    'If the user seems to ask for medical or emergency help, reply only with one neutral sentence saying this app cannot help with that and that talking to a trusted adult or local professional is a good step.'
  ].join(' ');
}

export function userPrompt(clean) {
  // Të dhënat shkojnë si JSON i ndarë nga udhëzimet, që teksti i përdoruesit të mos lexohet si komandë.
  return `Task: ${clean.purpose}\nData (JSON, user-selected, may be partial):\n${JSON.stringify({ metrics: clean.metrics, series: clean.series, calculation: clean.calculation, draft: clean.draft, notes: clean.notes })}`;
}
