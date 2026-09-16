import { mean } from './stats.js';
import { myNormal, MIN_DAYS } from './patterns.js';

// Fjalë që nuk mbajnë kuptim për vete. Shqip dhe anglisht.
const STOPWORDS = new Set([
  'dhe', 'por', 'për', 'per', 'një', 'nje', 'nga', 'sot', 'ishte', 'ishin', 'kam', 'kisha',
  'jam', 'ishim', 'kur', 'sepse', 'pastaj', 'shumë', 'shume', 'pak', 'mirë', 'mire', 'keq',
  'gjithë', 'gjithe', 'gjithçka', 'gjithcka', 'mua', 'mës', 'më', 'me', 'te', 'të', 'ta',
  'në', 'ne', 'si', 'se', 'që', 'qe', 'ku', 'ka', 'kjo', 'këtë', 'kete', 'ai', 'ajo', 'ata',
  'edhe', 'deri', 'mbi', 'pas', 'para', 'disa', 'asnjë', 'asnje', 'nuk', 'sdo',
  'the', 'and', 'but', 'for', 'was', 'were', 'have', 'had', 'this', 'that', 'with', 'from',
  'today', 'very', 'just', 'not', 'because', 'then', 'them', 'they', 'some', 'about'
]);

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOPWORDS.has(word));
}

function countWords(notes) {
  const counts = new Map();
  for (const note of notes) {
    // Një fjalë numërohet një herë për shënim, që një shënim i gjatë të mos e mbizotërojë.
    for (const word of new Set(tokenize(note))) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word));
}

// Fjalët kryesore në ditët mbi normalen kundrejt ditëve nën normalen.
export function noteKeywords(checkins, settings, metric = 'mood') {
  const withNotes = checkins.filter(checkin => String(checkin.note || '').trim() !== '');
  if (withNotes.length < MIN_DAYS.tag * 2) return null;

  const normal = myNormal(checkins, settings);
  const reference = normal[metric] !== null ? normal[metric] : mean(checkins.map(c => c[metric]));
  if (reference === null) return null;

  const above = withNotes.filter(checkin => checkin[metric] >= reference).map(checkin => checkin.note);
  const below = withNotes.filter(checkin => checkin[metric] < reference).map(checkin => checkin.note);
  if (above.length < MIN_DAYS.tag || below.length < MIN_DAYS.tag) return null;

  const aboveWords = countWords(above);
  const belowWords = countWords(below);
  const belowSet = new Set(belowWords.map(item => item.word));
  const aboveSet = new Set(aboveWords.map(item => item.word));

  return {
    metric,
    reference,
    aboveDays: above.length,
    belowDays: below.length,
    above: aboveWords.slice(0, 6),
    below: belowWords.slice(0, 6),
    onlyAbove: aboveWords.filter(item => !belowSet.has(item.word)).slice(0, 4),
    onlyBelow: belowWords.filter(item => !aboveSet.has(item.word)).slice(0, 4)
  };
}
