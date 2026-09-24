// MIRA — shoqëruesja lokale. E gjithë logjika punon në pajisje, pa AI të jashtme dhe pa rrjet.
// MIRA nuk diagnostikon dhe nuk "zbulon" ndjenja: ajo përdor vetëm atë që zgjodhi ose shkroi përdoruesi,
// dhe ndërton një plan të vogël nga shabllone të shkruara me dorë (shih i18n/screens/mira.js).
import { t, tList } from './i18n/index.js';

// Çdo situatë i përket një kategorie; kategoria zgjedh shabllonet e planit.
// "adult: true" do të thotë që plani sugjeron gjithmonë një të rritur të besuar.
export const SITUATIONS = [
  { id: 'school_stress', cat: 'school' }, { id: 'exams', cat: 'school' },
  { id: 'procrastination', cat: 'school' }, { id: 'focus', cat: 'school' },
  { id: 'motivation', cat: 'school' }, { id: 'fear_failure', cat: 'school' },
  { id: 'friendship', cat: 'friends' }, { id: 'argument_friend', cat: 'friends' },
  { id: 'excluded', cat: 'friends' }, { id: 'lonely', cat: 'friends' },
  { id: 'bullying', cat: 'friends', adult: true }, { id: 'cyberbullying', cat: 'friends', adult: true },
  { id: 'family_argument', cat: 'family' }, { id: 'parents', cat: 'family' },
  { id: 'breakup', cat: 'heart' }, { id: 'rejection', cat: 'heart' }, { id: 'crush', cat: 'heart' },
  { id: 'body', cat: 'self' }, { id: 'comparison', cat: 'self' }, { id: 'phone', cat: 'self' },
  { id: 'sleep', cat: 'self' }, { id: 'anger', cat: 'self' }, { id: 'embarrassment', cat: 'self' },
  { id: 'regret', cat: 'self' }, { id: 'overwhelmed', cat: 'self' }, { id: 'unsure', cat: 'self' },
  { id: 'other', cat: 'other' }
];

export const FEELINGS = ['sad', 'angry', 'tired', 'worried', 'lonely', 'embarrassed', 'disappointed', 'confused',
  'hurt', 'pressured', 'afraid', 'jealous', 'guilty', 'unsure', 'numb', 'calm', 'hopeful', 'relieved'];

export const NEEDS = ['listen', 'advice', 'decide', 'calm', 'repair', 'focus', 'understand', 'person', 'unknown'];

export const FOLLOW_UPS = ['better', 'clearer', 'same', 'harder', 'another', 'talk', 'later'];

const byId = Object.fromEntries(SITUATIONS.map(s => [s.id, s]));

export function situationOf(id) {
  return byId[id] || byId.other;
}

// Fjalë që tregojnë rrezik të menjëhershëm. Nëse shfaqen, MIRA nuk vazhdon vetëm:
// i tregon menjëherë njerëzit realë dhe ndihmën urgjente. Lista është e thjeshtë me qëllim
// dhe nuk pretendon të jetë e plotë — prandaj butoni "Kam nevojë për ndihmë" është gjithmonë i dukshëm.
const URGENT = [/vras(\s|$)|vetëvras|lëndoj veten|lendoj veten|dua të vdes|dua te vdes|s'dua më të jetoj|nuk dua me te jetoj/i,
  /kill myself|hurt myself|end my life|want to die|suicid|not safe at home|nuk jam i sigurt|nuk jam e sigurt|më rrah|me rrah|abuz/i];

export function looksUrgent(text) {
  const value = String(text || '');
  return URGENT.some(pattern => pattern.test(value));
}

// Hapi 1: MIRA dëgjon. Përmbledhja vetëm përsërit atë që u tha — nuk shton interpretim.
export function summarize({ situation, text }) {
  const label = t(`mira.sit.${situationOf(situation).id}`);
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return t('mira.summaryNoText', { situation: label });
  const quote = clean.length > 160 ? `${clean.slice(0, 157).trim()}…` : clean;
  return t('mira.summaryText', { situation: label, quote });
}

// Hapi 5: plani. Katër pjesë të vogla. "variant" ndryshon zgjedhjen kur kërkohet një sugjerim tjetër.
export function buildPlan({ situation, need, can = [], person = '', variant = 0 }) {
  const info = situationOf(situation);
  const pick = (list, offset = 0) => (list.length ? list[(variant + offset) % list.length] : '');
  const cat = info.cat;
  const now = [t(`mira.needNow.${NEEDS.includes(need) ? need : 'unknown'}`), pick(tList(`mira.plan.${cat}.now`))];
  const firstCan = (can || [])[0];
  const today = [firstCan ? t('mira.planCan', { item: firstCan }) : pick(tList(`mira.plan.${cat}.today`)),
    pick(tList(`mira.plan.${cat}.today`), 1)];
  const week = [pick(tList(`mira.plan.${cat}.week`))];
  const who = String(person || '').trim();
  const personLine = info.adult || need === 'person'
    ? t(who ? 'mira.planAdultNamed' : 'mira.planAdult', { name: who })
    : t(who ? 'mira.planPersonNamed' : 'mira.planPerson', { name: who });
  return {
    now: unique(now), today: unique(today), week: unique(week), person: [personLine],
    adult: Boolean(info.adult)
  };
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

// Shembuj të vegjël për hapin "çfarë mund të kontrollosh" — përdoruesi i shton vetë, nëse do.
export function controlIdeas(situation) {
  const cat = situationOf(situation).cat;
  return { can: tList(`mira.ctrl.${cat}.can`), cant: tList(`mira.ctrl.${cat}.cant`) };
}

// Teksti që kopjohet në clipboard. Asgjë nuk dërgohet — përdoruesi vendos vetë ku ta ngjisë.
export function planAsText(plan) {
  const part = (title, items) => `${title}\n${items.map(item => `• ${item}`).join('\n')}`;
  return [part(t('mira.slotNow'), plan.now), part(t('mira.slotToday'), plan.today),
    part(t('mira.slotWeek'), plan.week), part(t('mira.slotPerson'), plan.person)].join('\n\n');
}

// Pastron atë që ruhet në profil (edhe nga fajllat e importuar).
export function cleanPaths(raw) {
  if (!Array.isArray(raw)) return [];
  const str = (value, max) => String(value || '').slice(0, max);
  const list = (value, max) => (Array.isArray(value) ? value.map(item => str(item, 200)).filter(Boolean).slice(0, max) : []);
  return raw.filter(item => item && typeof item === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
    .slice(-30).map(item => ({
      id: str(item.id, 40) || `${item.date}-${Math.random().toString(36).slice(2, 7)}`,
      date: item.date,
      situation: byId[item.situation] ? item.situation : 'other',
      text: str(item.text, 1200),
      feelings: list(item.feelings, 20),
      need: NEEDS.includes(item.need) ? item.need : 'unknown',
      can: list(item.can, 12), cant: list(item.cant, 12),
      plan: {
        now: list(item.plan && item.plan.now, 6), today: list(item.plan && item.plan.today, 6),
        week: list(item.plan && item.plan.week, 6), person: list(item.plan && item.plan.person, 3)
      },
      followUp: FOLLOW_UPS.includes(item.followUp) ? item.followUp : null,
      checkLater: /^\d{4}-\d{2}-\d{2}$/.test(item.checkLater) ? item.checkLater : null
    }));
}
