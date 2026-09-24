// Ekranet Something Changed dhe Why? — vetëm matje, pa etiketa dhe pa nivel rreziku.
export default {
  sq: {
    central: 'Krahasuar me 30 ditët e tua — jo me askënd tjetër',
    notEnough: 'Ende nuk ka të dhëna të mjaftueshme', checkin: 'Bëj check-in',
    need: 'Krahasimi kërkon të paktën {n} ditë check-in. Deri tani: {have}.',
    whyLink: 'Why? Numrat dhe rregulli', patterns: 'Patterns',
    pageNote: 'Kjo faqe raporton vetëm sa lëvizën numrat e tu. Nuk vendos etiketa, nuk jep nivel rreziku dhe nuk krahason me askënd.',
    eyebrow: 'Krahasimi me veten', title: 'Something Changed',
    sentenceSignal: 'nga 6 matje ndryshuan më shumë se zakonisht gjatë {n} ditëve të fundit.',
    sentenceCalm: 'nga 6 matje kaluan pragun. Nuk u identifikua ndryshim i kombinuar.',
    summaryTitle: 'Përmbledhja e krahasimit', baseline: 'Normalja (baseline)', recent: 'Periudha e fundit', days: 'ditë',
    factorsTitle: 'Faktorët që ndryshuan', wentDown: 'ra', wentUp: 'u rrit',
    flow: 'Normalja {base}{unit} → 7 ditët e fundit {recent}{unit}',
    barLabel: 'Madhësia e ndryshimit krahasuar me faktorin më të madh: {n}%', seeMeasures: 'Shiko matjet',
    normalDays: 'Normalja · {n} ditë', recentDays: '7 ditët e fundit · {n} ditë', difference: 'Dallimi', change: 'Ndryshimi',
    method: 'Metoda: ndryshimi = (mesatarja e 7 ditëve − normalja) ÷ normalja × 100. z = (mesatarja e 7 ditëve − normalja) ÷ devijimi standard i normales. Një matje shënohet kur lëviz në drejtimin që ndiqet dhe ndryshimi është të paktën 15% ose z të paktën 1.5.',
    calmTitle: 'Asnjë ndryshim i kombinuar i matshëm',
    calmText: 'Matjet qëndruan afër normales sate gjatë {n} ditëve të fundit. Sinjali shfaqet vetëm kur dy ose më shumë matje e kalojnë pragun njëkohësisht; një e vetme trajtohet si zhurmë.',
    seeAllNumbers: 'Shiko të gjitha numrat'
  },
  en: {
    central: 'Compared with your 30 days — not with anyone else',
    notEnough: 'Not enough data yet', checkin: 'Do a check-in',
    need: 'The comparison needs at least {n} check-in days. So far: {have}.',
    whyLink: 'Why? The numbers and the rule', patterns: 'Patterns',
    pageNote: 'This page only reports how much your numbers moved. It does not assign labels, does not give a risk level and does not compare you with anyone.',
    eyebrow: 'Comparison with yourself', title: 'Something Changed',
    sentenceSignal: 'of 6 measurements changed more than usual during the last {n} days.',
    sentenceCalm: 'of 6 measurements crossed the threshold. No combined change was identified.',
    summaryTitle: 'Comparison summary', baseline: 'Normal (baseline)', recent: 'Latest period', days: 'days',
    factorsTitle: 'The factors that changed', wentDown: 'went down', wentUp: 'went up',
    flow: 'Normal {base}{unit} → last 7 days {recent}{unit}',
    barLabel: 'Size of the change compared with the largest factor: {n}%', seeMeasures: 'See the measurements',
    normalDays: 'Normal · {n} days', recentDays: 'Last 7 days · {n} days', difference: 'Difference', change: 'Change',
    method: 'Method: change = (7-day average − normal) ÷ normal × 100. z = (7-day average − normal) ÷ standard deviation of the normal. A measurement is marked when it moves in the watched direction and the change is at least 15% or z is at least 1.5.',
    calmTitle: 'No measurable combined change',
    calmText: 'Your measurements stayed close to your normal during the last {n} days. The signal only appears when two or more measurements cross the threshold at the same time; a single one is treated as noise.',
    seeAllNumbers: 'See all the numbers'
  }
};
