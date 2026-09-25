// My Week: të dhënat e javës (tekste që shkruan vetë përdoruesi) dhe meta-të dhënat e fotove.
// Vetë fotot ruhen në IndexedDB (photos.js); këtu ruhen vetëm titulli, data, etiketat dhe lidhjet.
export const PHOTO_TAGS = ['school', 'friends', 'family', 'sport', 'music', 'outside', 'food', 'creative', 'rest', 'other'];
export const WEEK_FIELDS = ['title', 'difficult', 'helped', 'completed', 'learned', 'intention'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// E hëna e javës së një date (javët fillojnë të hënën).
export function weekStart(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

export function weekDates(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${start}T12:00:00`);
    date.setDate(date.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
}

export function weekOf(profile, start) {
  profile.week = profile.week || { weeks: {}, photos: [] };
  if (!profile.week.weeks[start]) profile.week.weeks[start] = { title: '', coverId: null, difficult: '', helped: '', completed: '', learned: '', intention: '', story: null };
  return profile.week.weeks[start];
}

export function photosIn(profile, start) {
  const dates = new Set(weekDates(start));
  return ((profile.week && profile.week.photos) || []).filter(p => dates.has(p.date)).sort((a, b) => a.order - b.order);
}

export function cleanWeek(raw) {
  const out = { weeks: {}, photos: [] };
  if (!raw || typeof raw !== 'object') return out;
  const str = (value, max) => String(value || '').slice(0, max);
  for (const [start, week] of Object.entries(raw.weeks || {})) {
    if (!ISO.test(start) || !week || typeof week !== 'object') continue;
    out.weeks[start] = {
      title: str(week.title, 80), coverId: week.coverId ? str(week.coverId, 40) : null,
      difficult: str(week.difficult, 400), helped: str(week.helped, 400), completed: str(week.completed, 400),
      learned: str(week.learned, 400), intention: str(week.intention, 400),
      story: week.story && typeof week.story === 'object' ? {
        text: str(week.story.text, 3000), style: str(week.story.style, 20),
        removed: (Array.isArray(week.story.removed) ? week.story.removed : []).map(r => str(r, 60)).slice(0, 50)
      } : null
    };
  }
  out.photos = (Array.isArray(raw.photos) ? raw.photos : []).filter(p => p && ISO.test(p.date) && p.id).slice(-200).map((p, i) => ({
    id: str(p.id, 40), date: p.date, caption: str(p.caption, 200),
    tags: (Array.isArray(p.tags) ? p.tags : []).filter(tag => PHOTO_TAGS.includes(tag)).slice(0, 5),
    people: (Array.isArray(p.people) ? p.people : []).map(n => str(n, 40)).slice(0, 5),
    best: Boolean(p.best), order: Number.isFinite(p.order) ? p.order : i,
    synthetic: Boolean(p.synthetic), src: p.synthetic ? str(p.src, 200000) : ''
  }));
  return out;
}
