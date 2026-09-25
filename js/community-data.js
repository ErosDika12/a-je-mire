// Community — MËNYRA DEMO SINTETIKE.
// Të gjithë profilet, postimet dhe bisedat këtu janë të shpikura dhe shënohen qartë si sintetike.
// Asnjë person nuk është i vërtetë dhe askush nuk shfaqet si "online tani".
// Mesazhet reale mes adoleshentëve NUK aktivizohen pa backend me moderim njerëzor (shih docs).
import { AGE_GROUPS, REPORT_CATEGORIES } from './moderation.js';

export const INTERESTS = ['football', 'basketball', 'gym', 'gaming', 'music', 'movies', 'books', 'art', 'photography', 'technology',
  'coding', 'studying', 'languages', 'travel', 'cooking', 'growth'];
export const LANGS = ['sq', 'en', 'de'];
export const WANTS = ['study', 'play', 'talk_hobby', 'practice_language', 'create', 'move'];

export const CIRCLES = [
  { id: 'study', interest: 'studying' }, { id: 'gaming', interest: 'gaming' }, { id: 'football', interest: 'football' },
  { id: 'basketball', interest: 'basketball' }, { id: 'gym', interest: 'gym' }, { id: 'music', interest: 'music' },
  { id: 'movies', interest: 'movies' }, { id: 'art', interest: 'art' }, { id: 'tech', interest: 'coding' },
  { id: 'books', interest: 'books' }, { id: 'language', interest: 'languages' }, { id: 'habits', interest: 'growth' },
  { id: 'newhere', interest: null }
];

// Profile sintetike, të ndara sipas grupmoshës. Teksti i prezantimit është te i18n (cm.p.<id>).
export const PROFILES = [
  { id: 'rina', nick: 'Rina.music', age: '13-15', langs: ['sq', 'en'], interests: ['music', 'art', 'studying'], color: '#5a52c2', circles: ['music', 'art', 'study'] },
  { id: 'drini', nick: 'Drini_hoops', age: '13-15', langs: ['sq', 'de'], interests: ['basketball', 'gym', 'gaming'], color: '#2672ad', circles: ['basketball', 'gym', 'gaming'] },
  { id: 'lira', nick: 'Lira.draws', age: '13-15', langs: ['sq', 'en'], interests: ['art', 'photography', 'books'], color: '#a8581a', circles: ['art', 'books', 'newhere'] },
  { id: 'ilir', nick: 'Ilir.plays', age: '13-15', langs: ['sq', 'en'], interests: ['gaming', 'technology', 'football'], color: '#0f766e', circles: ['gaming', 'tech', 'football'] },
  { id: 'vesa', nick: 'Vesa.learns', age: '13-15', langs: ['sq', 'en', 'de'], interests: ['languages', 'studying', 'travel'], color: '#3b7d52', circles: ['language', 'study', 'habits'] },
  { id: 'blend', nick: 'Blend_runs', age: '13-15', langs: ['sq'], interests: ['football', 'gym', 'music'], color: '#9c5218', circles: ['football', 'gym', 'music'] },
  { id: 'era', nick: 'Era.codes', age: '16-17', langs: ['sq', 'en'], interests: ['coding', 'technology', 'studying'], color: '#5a52c2', circles: ['tech', 'study', 'habits'] },
  { id: 'leka', nick: 'Leka_B', age: '16-17', langs: ['sq', 'de'], interests: ['basketball', 'music', 'movies'], color: '#2672ad', circles: ['basketball', 'music', 'movies'] },
  { id: 'nora', nick: 'Nora.reads', age: '16-17', langs: ['sq', 'en'], interests: ['books', 'movies', 'languages'], color: '#a8581a', circles: ['books', 'movies', 'language'] },
  { id: 'genti', nick: 'Genti10', age: '16-17', langs: ['sq', 'en'], interests: ['football', 'gym', 'gaming'], color: '#0f766e', circles: ['football', 'gym', 'gaming'] },
  { id: 'dafina', nick: 'Dafina_art', age: '16-17', langs: ['sq', 'en', 'de'], interests: ['art', 'photography', 'music'], color: '#3b7d52', circles: ['art', 'music', 'newhere'] },
  { id: 'arbi', nick: 'Arbi.cooks', age: '16-17', langs: ['sq'], interests: ['cooking', 'travel', 'growth'], color: '#9c5218', circles: ['habits', 'newhere', 'study'] }
];

// Postimet sintetike: tekstet te i18n (cm.post.<id>). "circle" = hapësira ku u postua.
export const POSTS = [
  { id: 'p1', author: 'era', circle: 'study', type: 'study', comments: ['c1'] },
  { id: 'p2', author: 'rina', circle: 'music', type: 'question', comments: ['c2', 'c3'] },
  { id: 'p3', author: 'drini', circle: 'basketball', type: 'invite', comments: [] },
  { id: 'p4', author: 'vesa', circle: 'language', type: 'question', comments: ['c4'] },
  { id: 'p5', author: 'lira', circle: 'art', type: 'creative', comments: ['c5'] },
  { id: 'p6', author: 'genti', circle: 'football', type: 'poll', poll: 3, comments: [] },
  { id: 'p7', author: 'nora', circle: 'books', type: 'recommendation', comments: ['c6'] },
  { id: 'p8', author: 'ilir', circle: 'gaming', type: 'question', comments: [] },
  { id: 'p9', author: 'arbi', circle: 'habits', type: 'achievement', comments: ['c7'] },
  { id: 'p10', author: 'dafina', circle: 'newhere', type: 'highlight', comments: [] },
  { id: 'p11', author: 'blend', circle: 'gym', type: 'invite', comments: [] },
  { id: 'p12', author: 'leka', circle: 'movies', type: 'recommendation', comments: ['c8'] }
];

// Autori i komenteve sintetike.
export const COMMENT_AUTHORS = { c1: 'vesa', c2: 'dafina', c3: 'blend', c4: 'nora', c5: 'rina', c6: 'era', c7: 'leka', c8: 'genti' };

export const QUESTIONS = 8;         // cm.q.0 … cm.q.7 (Question of the Day)
export const CHALLENGES = ['focus3', 'walk', 'read15', 'photo', 'words5', 'old_friend'];
export const ICEBREAKERS = 5;       // cm.ice.0 … cm.ice.4
export const REACTIONS = ['👍', '❤️', '😂', '👏'];

// Profilet që i përkasin grupmoshës së përdoruesit; asnjë i rritur me të mitur.
export function profilesFor(age) {
  return PROFILES.filter(p => p.age === age);
}

// Shoku demonstrues (për bisedën shembull) — i pari i grupmoshës, i pranuar që në fillim.
export function demoFriend(age) {
  return profilesFor(age)[0] || null;
}

export function sharedInterests(me, profile) {
  return profile.interests.filter(i => (me.interests || []).includes(i));
}

export function emptyCommunity() {
  return { me: null, requests: {}, friends: [], muted: [], blocked: [], chats: {}, posts: [], reactions: {}, comments: {}, votes: {},
    reports: [], flagged: [], joined: [], challenges: {}, kindness: [], rate: [], suspended: [], seenDemoFriend: false };
}

export function cleanCommunity(raw) {
  const out = emptyCommunity();
  if (!raw || typeof raw !== 'object') return out;
  const str = (v, max) => String(v || '').slice(0, max);
  const ids = new Set(PROFILES.map(p => p.id));
  const idList = v => (Array.isArray(v) ? v.filter(id => ids.has(id)) : []);
  const me = raw.me;
  if (me && typeof me === 'object' && me.nick) {
    out.me = {
      nick: str(me.nick, 24), color: /^#[0-9a-f]{6}$/i.test(me.color) ? me.color : '#5a52c2',
      age: AGE_GROUPS.includes(me.age) ? me.age : '13-15',
      langs: (Array.isArray(me.langs) ? me.langs : []).filter(l => LANGS.includes(l)),
      interests: (Array.isArray(me.interests) ? me.interests : []).filter(i => INTERESTS.includes(i)).slice(0, 8),
      intro: str(me.intro, 200), wants: (Array.isArray(me.wants) ? me.wants : []).filter(w => WANTS.includes(w))
    };
  }
  for (const [id, status] of Object.entries(raw.requests || {})) if (ids.has(id) && ['pending', 'accepted', 'incoming'].includes(status)) out.requests[id] = status;
  out.friends = idList(raw.friends); out.muted = idList(raw.muted); out.blocked = idList(raw.blocked); out.suspended = idList(raw.suspended);
  for (const [id, list] of Object.entries(raw.chats || {})) {
    if (!ids.has(id) || !Array.isArray(list)) continue;
    out.chats[id] = list.slice(-100).map(m => ({
      id: str(m.id, 20), from: m.from === 'them' ? 'them' : 'me', text: str(m.text, 500), key: str(m.key, 40),
      replyTo: m.replyTo ? str(m.replyTo, 20) : null, reactions: typeof m.reactions === 'object' && m.reactions ? m.reactions : {},
      deleted: Boolean(m.deleted), kind: ['text', 'photo', 'focus', 'challenge'].includes(m.kind) ? m.kind : 'text', held: Boolean(m.held)
    }));
  }
  out.posts = (Array.isArray(raw.posts) ? raw.posts : []).slice(-50).map(p => ({
    id: str(p.id, 20), circle: str(p.circle, 20), audience: ['circle', 'friends', 'selected'].includes(p.audience) ? p.audience : 'circle',
    selected: idList(p.selected), type: str(p.type, 20), text: str(p.text, 500),
    poll: Array.isArray(p.poll) ? p.poll.map(o => str(o, 60)).slice(0, 4) : null, held: Boolean(p.held), at: Number(p.at) || 0
  }));
  out.reactions = typeof raw.reactions === 'object' && raw.reactions ? raw.reactions : {};
  out.votes = typeof raw.votes === 'object' && raw.votes ? raw.votes : {};
  for (const [id, list] of Object.entries(raw.comments || {})) if (Array.isArray(list)) out.comments[str(id, 20)] = list.slice(-20).map(c => str(c, 300));
  out.reports = (Array.isArray(raw.reports) ? raw.reports : []).slice(-50).map(r => ({
    id: str(r.id, 20), target: str(r.target, 40), type: str(r.type, 20),
    category: REPORT_CATEGORIES.includes(r.category) ? r.category : 'other', note: str(r.note, 300),
    status: ['open', 'actioned', 'dismissed'].includes(r.status) ? r.status : 'open', at: Number(r.at) || 0
  }));
  out.flagged = (Array.isArray(raw.flagged) ? raw.flagged : []).slice(-50).map(f => ({
    id: str(f.id, 20), where: str(f.where, 40), text: str(f.text, 500), reason: str(f.reason, 30),
    status: ['open', 'actioned', 'dismissed'].includes(f.status) ? f.status : 'open'
  }));
  out.joined = (Array.isArray(raw.joined) ? raw.joined : []).filter(id => CIRCLES.some(c => c.id === id));
  for (const id of CHALLENGES) if (raw.challenges && raw.challenges[id] === true) out.challenges[id] = true;
  out.kindness = (Array.isArray(raw.kindness) ? raw.kindness : []).slice(-30).map(k => ({ text: str(k.text, 200), at: Number(k.at) || 0, held: Boolean(k.held) }));
  out.seenDemoFriend = Boolean(raw.seenDemoFriend);
  return out;
}
