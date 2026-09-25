// Të dhënat sintetike të v3 për profilin demo: Sot, MIRA, Focus, Friction Map, My Week dhe Community.
// Gjithçka është e shpikur. Fotot janë ilustrime SVG të vizatuara këtu, të shënuara si "sintetike".
import { t, tList } from './i18n/index.js';
import { toIso } from './storage.js';
import { weekStart } from './week-data.js';
import { emptyCommunity } from './community-data.js';

const back = (today, n) => { const d = new Date(today); d.setDate(d.getDate() - n); return toIso(d); };

// Ilustrime të thjeshta (pa njerëz, pa fytyra) që zëvendësojnë fotot në demo.
function svg(body, bg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/>${body}</svg>`)}`;
}
const ART = {
  court: svg('<rect x="40" y="170" width="320" height="110" fill="#e0894a"/><circle cx="200" cy="225" r="40" fill="none" stroke="#fff" stroke-width="4"/><rect x="185" y="40" width="30" height="90" fill="#f5f5f5"/><circle cx="200" cy="120" r="16" fill="#e8743b" stroke="#6b2d10" stroke-width="3"/><rect x="170" y="130" width="60" height="6" fill="#d33"/>', '#9fc6e8'),
  desk: svg('<rect x="0" y="200" width="400" height="100" fill="#b98457"/><rect x="60" y="130" width="120" height="70" fill="#4c6ef5"/><rect x="70" y="120" width="110" height="12" fill="#f59f00"/><rect x="220" y="150" width="120" height="50" rx="4" fill="#f1f3f5"/><line x1="240" y1="165" x2="320" y2="165" stroke="#adb5bd" stroke-width="4"/><line x1="240" y1="180" x2="300" y2="180" stroke="#adb5bd" stroke-width="4"/><circle cx="330" cy="80" r="30" fill="#ffd43b"/>', '#e9ecef'),
  park: svg('<rect y="200" width="400" height="100" fill="#5c940d"/><circle cx="310" cy="90" r="42" fill="#ff922b"/><rect x="80" y="130" width="16" height="80" fill="#6b3f22"/><circle cx="88" cy="120" r="45" fill="#2b8a3e"/><rect x="170" y="150" width="12" height="60" fill="#6b3f22"/><circle cx="176" cy="140" r="32" fill="#37b24d"/>', '#ffc078'),
  coffee: svg('<rect y="210" width="400" height="90" fill="#8d6e63"/><rect x="110" y="150" width="70" height="60" rx="10" fill="#fff"/><rect x="220" y="150" width="70" height="60" rx="10" fill="#fff"/><path d="M180 165 q20 10 0 25" fill="none" stroke="#fff" stroke-width="6"/><path d="M290 165 q20 10 0 25" fill="none" stroke="#fff" stroke-width="6"/><path d="M135 140 q10 -20 0 -35 M255 140 q10 -20 0 -35" stroke="#dee2e6" stroke-width="4" fill="none"/>', '#f3e5d8'),
  music: svg('<circle cx="200" cy="150" r="90" fill="#212529"/><circle cx="200" cy="150" r="30" fill="#e64980"/><circle cx="200" cy="150" r="6" fill="#fff"/><path d="M320 60 v90 a18 18 0 1 1 -8 -15 v-60 l40 -10 v60 a18 18 0 1 1 -8 -15 v-60z" fill="#7048e8"/>', '#d0bfff')
};

export function addV3Demo(profile, today) {
  const d = n => back(today, n);
  const feel = id => t(`mira.feel.${id}`);
  const things = tList('seed3.things');
  const tasks = tList('seed3.tasks');
  const captions = tList('seed3.captions');

  profile.days = {
    [d(6)]: { feeling: { word: feel('pressured'), strength: 3 }, thing: { text: things[0], steps: [], done: true, movedFrom: null }, person: null, pause: { id: 'walk', custom: '', done: true } },
    [d(5)]: { feeling: { word: feel('hurt'), strength: 2 }, thing: { text: things[1], steps: [], done: false, movedFrom: null, movedTo: d(4) }, person: { name: 'Arta', notToday: false, draft: '' }, pause: { id: 'song', custom: '', done: true } },
    [d(4)]: { feeling: { word: feel('tired'), strength: 2 }, thing: { text: things[1], steps: [], done: true, movedFrom: d(5) }, person: null, pause: null },
    [d(3)]: { feeling: { word: feel('hopeful'), strength: 2 }, thing: { text: things[2], steps: [], done: true, movedFrom: null }, person: { name: 'Bleroni', notToday: false, draft: '' }, pause: { id: 'phone_away', custom: '', done: true } },
    [d(2)]: { feeling: { word: feel('calm'), strength: 1 }, thing: null, person: { name: 'Dardani', notToday: false, draft: '' }, pause: { id: 'breathe', custom: '', done: true } },
    [d(1)]: { feeling: { word: feel('relieved'), strength: 3 }, thing: { text: things[3], steps: [], done: true, movedFrom: null }, person: null, pause: { id: 'water', custom: '', done: false } }
  };

  profile.mira = { paths: [
    { id: `${d(6)}-demo1`, date: d(6), situation: 'exams', text: t('seed3.pathSchool'), feelings: [feel('pressured'), feel('worried')], need: 'focus',
      can: tList('seed3.canSchool'), cant: tList('seed3.cantSchool'), plan: { now: [t('mira.needNow.focus')], today: [t('mira.planCan', { item: tList('seed3.canSchool')[0] })], week: [tList('mira.plan.school.week')[0]], person: [t('mira.planPerson')] }, followUp: 'clearer', checkLater: null },
    { id: `${d(5)}-demo2`, date: d(5), situation: 'argument_friend', text: t('seed3.pathFriend'), feelings: [feel('hurt'), feel('angry')], need: 'repair',
      can: tList('seed3.canFriend'), cant: tList('seed3.cantFriend'), plan: { now: [t('mira.needNow.repair')], today: [tList('mira.plan.friends.today')[0]], week: [tList('mira.plan.friends.week')[0]], person: [t('mira.planPersonNamed', { name: 'Arta' })] }, followUp: 'better', checkLater: null }
  ] };

  profile.focus = { active: null, sessions: [
    { id: 'fd1', date: d(6), task: tasks[0], mode: 'exam', minutes: 25, actualMin: 25, outcome: 'completed', distractions: [] },
    { id: 'fd2', date: d(5), task: tasks[1], mode: 'homework', minutes: 25, actualMin: 12, outcome: 'later', distractions: [tasks[3]] },
    { id: 'fd3', date: d(4), task: tasks[1], mode: 'homework', minutes: 45, actualMin: 45, outcome: 'completed', distractions: [] },
    { id: 'fd4', date: d(3), task: tasks[2], mode: 'exam', minutes: 25, actualMin: 20, outcome: 'progress', distractions: [] }
  ] };
  profile.friction = [
    { date: d(8), task: tasks[2], reasons: ['phone', 'tired'], source: 'today' },
    { date: d(7), task: tasks[0], reasons: ['too_large'], source: 'today' },
    { date: d(5), task: things[1], reasons: ['phone', 'worried'], source: 'today' },
    { date: d(5), task: tasks[1], reasons: ['phone'], source: 'focus' },
    { date: d(2), task: tasks[2], reasons: ['interrupted'], source: 'today' }
  ];

  const start = weekStart(toIso(today));
  const inWeek = n => (d(n) >= start ? d(n) : start);
  profile.week = {
    weeks: { [start]: { title: t('seed3.weekTitle'), coverId: 'demo-court', difficult: t('seed3.difficult'), helped: t('seed3.helped'),
      completed: t('seed3.completed'), learned: t('seed3.learned'), intention: t('seed3.intention'), story: null } },
    photos: [
      { id: 'demo-court', date: inWeek(3), caption: captions[0], tags: ['sport', 'friends'], people: ['Dardani'], best: true, order: 0, synthetic: true, src: ART.court },
      { id: 'demo-desk', date: inWeek(4), caption: captions[1], tags: ['school'], people: [], best: false, order: 1, synthetic: true, src: ART.desk },
      { id: 'demo-park', date: inWeek(2), caption: captions[2], tags: ['outside'], people: ['Bleroni'], best: true, order: 2, synthetic: true, src: ART.park },
      { id: 'demo-coffee', date: inWeek(1), caption: captions[3], tags: ['friends'], people: ['Arta'], best: false, order: 3, synthetic: true, src: ART.coffee },
      { id: 'demo-music', date: inWeek(0), caption: captions[4], tags: ['music', 'rest'], people: [], best: false, order: 4, synthetic: true, src: ART.music }
    ]
  };
  profile.stars = { notes: {}, important: {}, snapshots: [] };
  // Demoja hyn menjëherë në Community me një profil sintetik (grupmosha 16–17).
  profile.community = { ...emptyCommunity(), joined: ['study', 'basketball'] };
  profile.community.me = { nick: t('seed3.nick'), color: '#5a52c2', age: '16-17', langs: ['sq', 'en'], interests: ['basketball', 'studying', 'music'], intro: t('seed3.intro'), wants: ['study', 'play'] };
  return profile;
}
