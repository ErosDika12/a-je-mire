// MIRA Weekly Story: një përmbledhje e javës e ndërtuar VETËM nga faktet që përdoruesi regjistroi.
// Çdo fjali lidhet me një fakt të dukshëm; përdoruesi mund ta heqë çdo fakt. Asgjë nuk shpiket.
// Matjet private (humori, gjumi, etj.) nuk përdoren kurrë këtu.
import { t } from './i18n/index.js';
import { weekDates, weekOf, photosIn } from './week-data.js';
import { situationOf } from './mira.js';

export const STYLES = ['simple', 'reflective', 'story', 'social'];

export function collectFacts(profile, start) {
  const dates = weekDates(start);
  const inWeek = date => dates.includes(date);
  const week = weekOf(profile, start);
  const facts = [];
  const push = (id, text, source) => { if (text) facts.push({ id, text, source }); };
  // Teksti i përdoruesit pa pikën në fund, që shablloni të mos japë "..".
  const trim = value => String(value || '').trim().replace(/[.!?…]+$/, '');

  const sessions = ((profile.focus && profile.focus.sessions) || []).filter(s => inWeek(s.date));
  const completed = sessions.filter(s => s.outcome === 'completed').length;
  if (sessions.length) push('focus', t('week.fact.focus', { n: sessions.length, done: completed }), t('week.src.focus'));

  const people = new Set();
  for (const date of dates) {
    const day = profile.days && profile.days[date];
    if (day && day.person && day.person.name) people.add(day.person.name);
  }
  for (const c of profile.connections || []) if (inWeek(c.date)) people.add(c.personName);
  for (const p of photosIn(profile, start)) for (const name of p.people) people.add(name);
  if (people.size) push('people', t('week.fact.people', { names: [...people].join(', ') }), t('week.src.people'));

  const best = photosIn(profile, start).filter(p => p.best && p.caption);
  if (best.length) push('best', t('week.fact.best', { items: best.map(p => p.caption).join(', ') }), t('week.src.photos'));

  const done = dates.map(d => profile.days && profile.days[d] && profile.days[d].thing).filter(th => th && th.done).map(th => th.text);
  if (done.length) push('done', t('week.fact.done', { items: done.join(', ') }), t('week.src.today'));

  const feelings = dates.map(d => profile.days && profile.days[d] && profile.days[d].feeling).filter(Boolean).map(f => f.word);
  if (feelings.length) push('feelings', t('week.fact.feelings', { words: [...new Set(feelings)].join(', ') }), t('week.src.today'));

  const paths = ((profile.mira && profile.mira.paths) || []).filter(p => inWeek(p.date));
  if (paths.length) push('mira', t('week.fact.mira', { topics: [...new Set(paths.map(p => t(`mira.sit.${situationOf(p.situation).id}`)))].join(', ') }), t('week.src.mira'));

  const pauses = dates.map(d => profile.days && profile.days[d] && profile.days[d].pause).filter(p => p && p.done)
    .map(p => (p.id === 'custom' ? p.custom : t(`today.p.${p.id}`)));
  if (pauses.length) push('pauses', t('week.fact.pauses', { items: [...new Set(pauses)].join(', ') }), t('week.src.today'));

  if (week.difficult) push('difficult', t('week.fact.difficult', { text: trim(week.difficult) }), t('week.src.notes'));
  if (week.helped) push('helped', t('week.fact.helped', { text: trim(week.helped) }), t('week.src.notes'));
  if (week.completed) push('completed', t('week.fact.completed', { text: trim(week.completed) }), t('week.src.notes'));
  if (week.learned) push('learned', t('week.fact.learned', { text: trim(week.learned) }), t('week.src.notes'));
  if (week.intention) push('intention', t('week.fact.intention', { text: trim(week.intention) }), t('week.src.notes'));
  return facts;
}

export function composeStory(facts, removed, style) {
  const kept = facts.filter(f => !removed.includes(f.id));
  if (!kept.length) return t('week.storyEmpty');
  const s = STYLES.includes(style) ? style : 'simple';
  const body = kept.filter(f => f.id !== 'intention');
  const closing = kept.find(f => f.id === 'intention');
  if (s === 'social') {
    return [t('week.style.socialOpen'), ...body.slice(0, 4).map(f => `• ${f.text}`), closing ? `→ ${closing.text}` : ''].filter(Boolean).join('\n');
  }
  const sentences = body.map(f => f.text).join(' ');
  return [t(`week.style.${s}Open`), sentences, closing ? closing.text : '', t(`week.style.${s}Close`)].filter(Boolean).join(' ');
}
