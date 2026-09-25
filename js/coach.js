// Mjetet e MIRA-s që punojnë në pajisje: "Help Me Start", "Conversation Coach", "Talk It Through".
// Të gjitha tekstet janë shabllone të shkruara me dorë në i18n/screens/coach.js. Asgjë nuk dërgohet.
import { t, tList } from './i18n/index.js';

// ---------- Help Me Start ----------
// Lloji i detyrës gjendet nga fjalë të thjeshta; nëse nuk gjendet, përdoret shablloni i përgjithshëm.
const TASK_KINDS = [
  { kind: 'write', words: /ese|hartim|shkrua|essay|write|writing|aufsatz|schreib|referat/i },
  { kind: 'math', words: /matemat|math|ushtrim|exercise|problem|rechn|aufgabe|fizik|physic/i },
  { kind: 'study', words: /test|provim|exam|mësim|mesim|study|learn|lern|prüfung|pruf|kontroll/i },
  { kind: 'read', words: /lexo|lexim|libër|liber|read|book|lesen|buch/i },
  { kind: 'project', words: /projekt|project|prezantim|presentation|präsentation|poster/i },
  { kind: 'tidy', words: /dhom|pastro|rregullo|room|clean|tidy|zimmer|aufräum/i }
];

export function taskKind(text) {
  const found = TASK_KINDS.find(entry => entry.words.test(String(text || '')));
  return found ? found.kind : 'general';
}

// Një hap 2-minutësh dhe deri në tre hapa të vegjël pas tij.
export function helpMeStart(text) {
  const kind = taskKind(text);
  return { kind, first: t(`coach.start.${kind}.first`), steps: tList(`coach.start.${kind}.steps`).slice(0, 3) };
}

// ---------- Conversation Coach ----------
export const SCENARIOS = ['apologize', 'boundary', 'argument', 'include', 'say_no', 'parent', 'teacher', 'ask_help', 'check_friend'];
export const TONES = ['calm', 'warm', 'direct', 'short'];

export function draft(scenario, tone, name = '') {
  const s = SCENARIOS.includes(scenario) ? scenario : 'ask_help';
  const k = TONES.includes(tone) ? tone : 'calm';
  const who = String(name || '').trim();
  // Përshëndetja me emër shtohet vetëm kur ka emër; drafti vetë nuk përmban emra.
  const greeting = who && k !== 'short' ? `${t('coach.greet', { name: who })} ` : '';
  return greeting + t(`coach.draft.${s}.${k}`);
}

// ---------- Talk It Through ----------
// MIRA dëgjon para se të japë këshillë: pasqyron shkurt atë që u shkrua dhe bën një pyetje të hapur.
export function talkReply(turn, text) {
  const questions = tList('coach.talk.questions');
  const echoes = tList('coach.talk.echoes');
  const clean = String(text || '').trim();
  if (!clean) return { echo: t('coach.talk.silence'), question: questions[turn % questions.length] };
  return { echo: echoes[turn % echoes.length], question: questions[turn % questions.length] };
}

// ---------- MIRA si shoqëruese sociale ----------
// Ndihmë për një mesazh që përdoruesi e ngjit vetë. MIRA nuk lexon asnjë bisedë vetë.
export const SOCIAL_HELP = ['icebreaker', 'intro', 'respectful', 'misunderstanding', 'boundary', 'block_report'];

export function socialHelp(kind) {
  const k = SOCIAL_HELP.includes(kind) ? kind : 'respectful';
  return tList(`coach.social.${k}`);
}
