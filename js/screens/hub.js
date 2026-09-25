// Community — demo sintetike. Miqësi të sigurta rreth interesave, jo rreth vështirësive.
// Rregullat: pa mesazhe mes të panjohurve (vetëm pas pranimit të dyanshëm), pa renditje popullariteti,
// pa "online tani", pa scroll të pafund, bllokim/raportim kudo, moderim që shqyrtohet nga njerëz.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, tList } from '../i18n/index.js';
import {
  INTERESTS, LANGS, WANTS, CIRCLES, PROFILES, POSTS, COMMENT_AUTHORS, QUESTIONS, CHALLENGES, ICEBREAKERS, REACTIONS,
  profilesFor, demoFriend, sharedInterests, emptyCommunity
} from '../community-data.js';
import { REPORT_CATEGORIES, AGE_GROUPS, checkText, rateCheck, recordRate, checkImage, canMatch } from '../moderation.js';
import { SOCIAL_HELP, socialHelp } from '../coach.js';

const TABS = ['feed', 'discover', 'friends', 'circles', 'messages', 'activities', 'safety'];
const ui = { tab: 'feed', circle: null, chat: null, replyTo: null, filter: null, focusRoom: null, buddy: null, draftType: 'text', audience: 'circle' };
const chatPhotos = new Map();   // fotot e ndara në chat mbeten vetëm në memorie (demo)
const byId = Object.fromEntries(PROFILES.map(p => [p.id, p]));

function state(app) {
  if (!app.profile.community) app.profile.community = emptyCommunity();
  return app.profile.community;
}

const avatar = (p, size = 40) => `<span class="avatar" style="background:${escapeHtml(p.color)};width:${size}px;height:${size}px" aria-hidden="true">${escapeHtml(p.nick.charAt(0).toUpperCase())}</span>`;
const synthBadge = () => `<span class="pill pill-amber synth-badge">${t('cm.synthetic')}</span>`;

export function renderHub(container, app) {
  const s = state(app);
  // Shoku demonstrues dhe një kërkesë hyrëse shfaqen një herë, që demoja të tregojë të gjithë rrjedhën.
  if (s.me && !s.seenDemoFriend) seedDemoFriend(s);
  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('cm.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('cm.title')}</h1>
      <p class="page-sub">${t('cm.subtitle')}</p>
    </header>
    <div class="cm-demo-banner" role="note">${icon('info', 16)} <span>${t('cm.demoBanner')}</span></div>
    ${s.me ? `${tabsHtml()}<div class="cm-body">${tabBody(app, s)}</div>` : onboarding(s)}`;
  wire(container, app);
}

function seedDemoFriend(s) {
  const friend = demoFriend(s.me.age);
  const second = profilesFor(s.me.age)[1];
  if (friend && !s.friends.includes(friend.id)) {
    s.friends.push(friend.id);
    s.requests[friend.id] = 'accepted';
    s.chats[friend.id] = [0, 1, 2, 3].map(i => ({ id: `d${i}`, from: i % 2 ? 'me' : 'them', text: '', key: `cm.chat.${i}`, replyTo: null, reactions: {}, deleted: false, kind: 'text', held: false }));
  }
  if (second && !s.requests[second.id]) s.requests[second.id] = 'incoming';
  s.seenDemoFriend = true;
}

// ---------- profili i Community-t ----------
function onboarding(s) {
  const me = s.me || { nick: '', age: '13-15', langs: ['sq'], interests: [], intro: '', wants: [] };
  return `<section class="card" aria-labelledby="cm-join">
    <h2 id="cm-join" class="card-title">${t('cm.joinTitle')}</h2>
    <p class="card-sub">${t('cm.joinIntro')}</p>
    <ul class="mira-read mt-2">${tList('cm.neverShown').map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    ${profileForm(me)}
  </section>
  <section class="card card-amber"><h2 class="card-title">${t('cm.rulesTitle')}</h2>${rulesList()}</section>`;
}

function profileForm(me) {
  const chips = (name, list, selected, labelKey) => `<div class="tag-wrap mt-2" role="group" aria-label="${escapeHtml(t(`cm.form.${name}`))}">
    ${list.map(v => `<button type="button" class="tag tag-sm" data-pick="${name}:${v}" aria-pressed="${selected.includes(v)}">${t(`${labelKey}.${v}`)}</button>`).join('')}</div>`;
  return `<form class="cm-form mt-4" data-profile-form>
    <label class="field"><span class="card-sub">${t('cm.form.nick')}</span><input name="nick" maxlength="24" required value="${escapeHtml(me.nick)}" autocomplete="off"></label>
    <label class="field mt-3"><span class="card-sub">${t('cm.form.age')}</span>
      <select name="age">${AGE_GROUPS.map(a => `<option value="${a}" ${me.age === a ? 'selected' : ''}>${t(`cm.age.${a}`)}</option>`).join('')}</select></label>
    <p class="card-sub mt-3">${t('cm.form.langs')}</p>${chips('langs', LANGS, me.langs, 'cm.lang')}
    <p class="card-sub mt-3">${t('cm.form.interests')}</p>${chips('interests', INTERESTS, me.interests, 'cm.int')}
    <p class="card-sub mt-3">${t('cm.form.wants')}</p>${chips('wants', WANTS, me.wants, 'cm.want')}
    <label class="field mt-3"><span class="card-sub">${t('cm.form.intro')}</span>
      <textarea name="intro" maxlength="200" placeholder="${escapeHtml(t('cm.form.introHint'))}">${escapeHtml(me.intro)}</textarea></label>
    <button type="button" class="btn-link mt-2" data-intro-help>${icon('spark', 14)} ${t('cm.introHelp')}</button>
    <button type="submit" class="btn btn-primary mt-4">${t('cm.form.save')}</button>
  </form>`;
}

function rulesList() {
  return `<ol class="mira-read">${tList('cm.rules').map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ol>`;
}

function tabsHtml() {
  return `<nav class="cm-tabs" aria-label="${escapeHtml(t('cm.tabsLabel'))}">
    ${TABS.map(tab => `<button type="button" data-tab="${tab}" aria-pressed="${ui.tab === tab}">${t(`cm.tab.${tab}`)}</button>`).join('')}</nav>`;
}

function tabBody(app, s) {
  if (ui.tab === 'discover') return discoverView(s);
  if (ui.tab === 'friends') return friendsView(s);
  if (ui.tab === 'circles') return ui.circle ? circleView(s, ui.circle) : circlesView(s);
  if (ui.tab === 'messages') return ui.chat ? chatView(s, ui.chat) : inboxView(s);
  if (ui.tab === 'activities') return activitiesView(app, s);
  if (ui.tab === 'safety') return safetyView(s);
  return feedView(app, s);
}

// ---------- Feed ----------
function visiblePosts(s, circle = null) {
  const hidden = new Set([...s.blocked, ...s.muted, ...s.suspended]);
  const group = new Set(profilesFor(s.me.age).map(p => p.id));
  const circles = s.joined.length ? s.joined : CIRCLES.filter(c => c.interest && s.me.interests.includes(c.interest)).map(c => c.id);
  // Pa renditje popullariteti: fillimisht circles e tua/interesat e tua, pastaj të tjerat e grupmoshës.
  const synthetic = POSTS.filter(p => group.has(p.author) && !hidden.has(p.author) && (!circle || p.circle === circle))
    .sort((a, b) => Number(circles.includes(b.circle)) - Number(circles.includes(a.circle)));
  const mine = s.posts.filter(p => (circle ? p.circle === circle && p.audience === 'circle' : true));
  return { synthetic, mine };
}

function composer(s, circle = null) {
  const types = ['text', 'question', 'poll', 'achievement', 'study', 'invite', 'creative', 'recommendation', 'highlight'];
  return `<form class="card cm-composer" data-post-form>
    <h2 class="card-title">${t('cm.newPost')}</h2>
    <div class="cm-row">
      <label class="field"><span class="card-sub">${t('cm.postType')}</span>
        <select name="type" data-post-type>${types.map(x => `<option value="${x}" ${ui.draftType === x ? 'selected' : ''}>${t(`cm.type.${x}`)}</option>`).join('')}</select></label>
      ${circle ? `<input type="hidden" name="circle" value="${circle}"><input type="hidden" name="audience" value="circle">` : `
      <label class="field"><span class="card-sub">${t('cm.audience')}</span>
        <select name="audience" data-audience>${['circle', 'friends', 'selected'].map(a => `<option value="${a}" ${ui.audience === a ? 'selected' : ''}>${t(`cm.aud.${a}`)}</option>`).join('')}</select></label>
      <label class="field" ${ui.audience === 'circle' ? '' : 'hidden'}><span class="card-sub">${t('cm.circle')}</span>
        <select name="circle">${CIRCLES.map(c => `<option value="${c.id}">${t(`cm.c.${c.id}.name`)}</option>`).join('')}</select></label>`}
    </div>
    ${!circle && ui.audience === 'selected' ? `<fieldset class="mt-2"><legend class="card-sub">${t('cm.pickFriends')}</legend>
      <div class="tag-wrap">${s.friends.map(id => `<label class="tag tag-sm"><input type="checkbox" name="selected" value="${id}"> ${escapeHtml(byId[id].nick)}</label>`).join('') || `<span class="card-sub">${t('cm.noFriends')}</span>`}</div></fieldset>` : ''}
    <label class="field mt-2"><span class="sr-only">${t('cm.postText')}</span>
      <textarea name="text" maxlength="500" placeholder="${escapeHtml(t('cm.postPlaceholder'))}"></textarea></label>
    ${ui.draftType === 'poll' ? `<div class="cm-poll-edit">${[0, 1, 2].map(i => `<input name="opt${i}" maxlength="60" placeholder="${escapeHtml(t('cm.pollOption', { n: i + 1 }))}">`).join('')}</div>` : ''}
    <p class="card-note">${t('cm.postNote')}</p>
    <button type="submit" class="btn btn-primary">${t('cm.publish')}</button>
  </form>`;
}

function postCard(s, post, mine = false) {
  const author = mine ? { nick: s.me.nick, color: s.me.color } : byId[post.author];
  const text = mine ? post.text : t(`cm.post.${post.id}`);
  const pollOpts = mine ? post.poll : (post.poll ? tList(`cm.poll.${post.id}`) : null);
  const vote = s.votes[post.id];
  const reaction = s.reactions[post.id];
  const comments = [...(mine ? [] : (post.comments || []).map(c => ({ who: byId[COMMENT_AUTHORS[c]], text: t(`cm.comment.${c}`) }))), ...((s.comments[post.id] || []).map(text => ({ who: { nick: s.me.nick, color: s.me.color }, text, me: true })))];
  return `<article class="card cm-post" aria-label="${escapeHtml(author.nick)}">
    <header class="cm-post-head">${avatar(author)}<div><strong>${escapeHtml(author.nick)}</strong>
      <span class="card-sub">${t(`cm.type.${post.type}`)} · ${post.audience && post.audience !== 'circle' ? t(`cm.aud.${post.audience}`) : t(`cm.c.${post.circle}.name`)}</span></div>
      ${mine ? `<span class="pill pill-accent">${t('cm.you')}</span>` : synthBadge()}</header>
    ${post.held ? `<p class="cm-held">${icon('shield', 14)} ${t('cm.heldForReview')}</p>` : ''}
    <p class="cm-post-text">${escapeHtml(text)}</p>
    ${pollOpts ? `<div class="cm-poll" role="group" aria-label="${escapeHtml(t('cm.type.poll'))}">${pollOpts.map((o, i) => `<button type="button" class="mira-choice" data-vote="${post.id}:${i}" aria-pressed="${vote === i}">${escapeHtml(o)}</button>`).join('')}
      ${vote !== undefined ? `<p class="card-note">${t('cm.voted')}</p>` : ''}</div>` : ''}
    <div class="cm-reacts">${REACTIONS.map(r => `<button type="button" class="cm-react" data-react="${post.id}:${r}" aria-pressed="${reaction === r}" aria-label="${escapeHtml(t('cm.react', { r }))}">${r}</button>`).join('')}
      ${mine ? '' : `<button type="button" class="btn btn-ghost btn-sm cm-report" data-report="post:${post.id}">${t('cm.report')}</button>`}</div>
    ${comments.length ? `<ul class="cm-comments">${comments.map(c => `<li>${avatar(c.who, 24)}<span><strong>${escapeHtml(c.who.nick)}</strong> ${escapeHtml(c.text)}</span>${c.me ? '' : ''}</li>`).join('')}</ul>` : ''}
    <form class="mira-inline mt-2" data-comment="${post.id}"><label class="sr-only" for="cmt-${post.id}">${t('cm.comment.label')}</label>
      <input id="cmt-${post.id}" maxlength="300" placeholder="${escapeHtml(t('cm.comment.label'))}"><button type="submit" class="btn btn-sm">${t('cm.comment.send')}</button></form>
  </article>`;
}

function feedView(app, s) {
  const { synthetic, mine } = visiblePosts(s);
  const q = Number(app.today.replace(/-/g, '')) % QUESTIONS;
  // Pa scroll të pafund: feed-i ndalet me një pikë të natyrshme mbarimi.
  const shown = synthetic.slice(0, 10);
  return `<section class="card card-lav cm-qotd" aria-labelledby="qotd"><span class="eyebrow">${t('cm.qotd')}</span>
      <h2 id="qotd" class="card-title mt-2">${t(`cm.q.${q}`)}</h2>
      <form class="mira-inline mt-3" data-qotd="${q}"><label class="sr-only" for="qotd-a">${t('cm.qotdAnswer')}</label>
        <input id="qotd-a" maxlength="200" placeholder="${escapeHtml(t('cm.qotdAnswer'))}"><button type="submit" class="btn btn-sm">${t('cm.publish')}</button></form>
      <p class="card-note">${t('cm.qotdNote')}</p></section>
    ${composer(s)}
    ${mine.slice().reverse().map(p => postCard(s, p, true)).join('')}
    ${shown.map(p => postCard(s, p)).join('')}
    <div class="cm-caught-up" role="status">${icon('check', 18)} <strong>${t('cm.caughtUp')}</strong><span>${t('cm.caughtUpText')}</span></div>`;
}

// ---------- Discover ----------
function discoverView(s) {
  if (s.me.age === '18+') return `<section class="card"><p class="mira-voice">${t('cm.adultNote')}</p></section>`;
  const hidden = new Set([...s.blocked, ...s.suspended]);
  let list = profilesFor(s.me.age).filter(p => !hidden.has(p.id) && canMatch(s.me.age, p.age));
  if (ui.filter) list = list.filter(p => p.interests.includes(ui.filter));
  list.sort((a, b) => sharedInterests(s.me, b).length - sharedInterests(s.me, a).length);
  return `<section class="card"><h2 class="card-title">${t('cm.discoverTitle')}</h2><p class="card-sub">${t('cm.discoverIntro')}</p>
    <div class="tag-wrap mt-3" role="group" aria-label="${escapeHtml(t('cm.filter'))}">
      <button type="button" class="tag tag-sm" data-filter="" aria-pressed="${!ui.filter}">${t('cm.all')}</button>
      ${INTERESTS.map(i => `<button type="button" class="tag tag-sm" data-filter="${i}" aria-pressed="${ui.filter === i}">${t(`cm.int.${i}`)}</button>`).join('')}</div></section>
    <div class="cm-people">${list.map(p => personCard(s, p)).join('') || `<p class="card-sub">${t('cm.noMatches')}</p>`}</div>`;
}

function personCard(s, p) {
  const shared = sharedInterests(s.me, p);
  const mutual = p.circles.filter(c => s.joined.includes(c));
  const status = s.friends.includes(p.id) ? 'friends' : s.requests[p.id];
  return `<article class="card cm-person">
    <header class="cm-post-head">${avatar(p, 48)}<div><strong>${escapeHtml(p.nick)}</strong><span class="card-sub">${t(`cm.age.${p.age}`)} · ${p.langs.map(l => t(`cm.lang.${l}`)).join(', ')}</span></div>${synthBadge()}</header>
    <p class="mt-2">${escapeHtml(t(`cm.p.${p.id}`))}</p>
    ${shared.length ? `<p class="card-sub mt-2">${t('cm.shared')}: ${shared.map(i => t(`cm.int.${i}`)).join(', ')}</p>` : ''}
    ${mutual.length ? `<p class="card-sub">${t('cm.mutualCircles')}: ${mutual.map(c => t(`cm.c.${c}.name`)).join(', ')}</p>` : ''}
    <div class="mira-actions">
      ${status === 'friends' ? `<button type="button" class="btn btn-sm" data-open-chat="${p.id}">${t('cm.message')}</button>`
        : status === 'pending' ? `<span class="pill pill-lav">${t('cm.requestSent')}</span>`
        : status === 'incoming' ? `<button type="button" class="btn btn-primary btn-sm" data-tab="friends">${t('cm.answerRequest')}</button>`
        : `<button type="button" class="btn btn-primary btn-sm" data-hello="${p.id}">${t('cm.sayHello')}</button>`}
      <button type="button" class="btn btn-ghost btn-sm" data-block="${p.id}">${t('cm.block')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-report="profile:${p.id}">${t('cm.report')}</button>
    </div></article>`;
}

// ---------- Friends ----------
function friendsView(s) {
  const incoming = Object.entries(s.requests).filter(([id, st]) => st === 'incoming' && !s.blocked.includes(id)).map(([id]) => byId[id]);
  const pending = Object.entries(s.requests).filter(([, st]) => st === 'pending').map(([id]) => byId[id]);
  const friends = s.friends.filter(id => !s.blocked.includes(id)).map(id => byId[id]);
  return `${incoming.length ? `<section class="card card-lav"><h2 class="card-title">${t('cm.incoming')}</h2>
      ${incoming.map(p => `<div class="cm-row-item">${avatar(p)}<div><strong>${escapeHtml(p.nick)}</strong> ${synthBadge()}<p class="card-sub">${escapeHtml(t(`cm.p.${p.id}`))}</p></div>
        <div class="mira-actions"><button type="button" class="btn btn-primary btn-sm" data-accept="${p.id}">${t('cm.accept')}</button>
        <button type="button" class="btn btn-sm" data-decline="${p.id}">${t('cm.decline')}</button></div></div>`).join('')}</section>` : ''}
    <section class="card"><h2 class="card-title">${t('cm.friendsTitle')}</h2>
      ${friends.length ? friends.map(p => `<div class="cm-row-item">${avatar(p)}<div><strong>${escapeHtml(p.nick)}</strong> ${synthBadge()}${s.muted.includes(p.id) ? `<span class="card-sub">${t('cm.mutedLabel')}</span>` : ''}</div>
        <div class="mira-actions">
          <button type="button" class="btn btn-sm" data-open-chat="${p.id}">${t('cm.message')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-mute="${p.id}">${s.muted.includes(p.id) ? t('cm.unmute') : t('cm.mute')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-unfriend="${p.id}">${t('cm.removeFriend')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-block="${p.id}">${t('cm.block')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-report="profile:${p.id}">${t('cm.report')}</button>
        </div></div>`).join('') : `<p class="card-sub">${t('cm.noFriends')}</p>`}</section>
    ${pending.length ? `<section class="card"><h2 class="card-title">${t('cm.sent')}</h2><p class="card-sub">${t('cm.sentNote')}</p>
      ${pending.map(p => `<div class="cm-row-item">${avatar(p, 32)}<strong>${escapeHtml(p.nick)}</strong><span class="pill pill-lav">${t('cm.requestSent')}</span></div>`).join('')}</section>` : ''}
    ${s.blocked.length ? `<section class="card"><h2 class="card-title">${t('cm.blockedTitle')}</h2>
      ${s.blocked.map(id => `<div class="cm-row-item"><strong>${escapeHtml(byId[id].nick)}</strong><button type="button" class="btn btn-ghost btn-sm" data-unblock="${id}">${t('cm.unblock')}</button></div>`).join('')}</section>` : ''}`;
}

// ---------- Circles ----------
function circlesView(s) {
  return `<p class="card-sub">${t('cm.circlesIntro')}</p><div class="kit-grid mt-3">${CIRCLES.map((c, i) => `
    <button type="button" class="kit-card kit-tone-${i % 4}" data-circle="${c.id}">
      <strong>${t(`cm.c.${c.id}.name`)}</strong><span>${t(`cm.c.${c.id}.desc`)}</span>
      <span class="kit-open">${s.joined.includes(c.id) ? t('cm.joined') : t('cm.open')} ${icon('next', 14)}</span></button>`).join('')}</div>`;
}

function circleView(s, id) {
  const members = profilesFor(s.me.age).filter(p => p.circles.includes(id) && !s.blocked.includes(p.id));
  const { synthetic, mine } = visiblePosts(s, id);
  const joined = s.joined.includes(id);
  return `<button type="button" class="btn btn-ghost btn-sm" data-circle="">${icon('back', 15)} ${t('cm.allCircles')}</button>
    <section class="card mt-2"><h2 class="card-title">${t(`cm.c.${id}.name`)}</h2><p>${t(`cm.c.${id}.desc`)}</p>
      <p class="kit-tip mt-3"><strong>${t('cm.weeklyTopic')}</strong> ${t(`cm.c.${id}.topic`)}</p>
      <div class="mira-actions"><button type="button" class="btn ${joined ? '' : 'btn-primary'}" data-join="${id}">${joined ? t('cm.leave') : t('cm.join')}</button>
        <button type="button" class="btn" data-room="${id}">${icon('play', 14)} ${t('cm.groupFocus')}</button>
        <button type="button" class="btn btn-ghost" data-report="circle:${id}">${t('cm.report')}</button></div>
      <h3 class="card-sub mt-4">${t('cm.members')} (${t('cm.membersNote')})</h3>
      <div class="cm-members">${members.map(p => `<span class="cm-member">${avatar(p, 28)}${escapeHtml(p.nick)}</span>`).join('') || `<span class="card-sub">—</span>`}</div>
    </section>
    ${joined ? composer(s, id) : `<p class="card-note">${t('cm.joinToPost')}</p>`}
    ${mine.slice().reverse().map(p => postCard(s, p, true)).join('')}
    ${synthetic.map(p => postCard(s, p)).join('')}
    <div class="cm-caught-up" role="status">${icon('check', 18)} <strong>${t('cm.caughtUp')}</strong></div>`;
}

// ---------- Messages ----------
function inboxView(s) {
  const friends = s.friends.filter(id => !s.blocked.includes(id));
  return `<section class="card"><h2 class="card-title">${t('cm.messagesTitle')}</h2><p class="card-sub">${t('cm.messagesIntro')}</p>
    ${friends.length ? `<ul class="cm-inbox">${friends.map(id => { const p = byId[id]; const last = (s.chats[id] || []).filter(m => !m.deleted).slice(-1)[0];
      return `<li><button type="button" class="cm-inbox-row" data-open-chat="${id}">${avatar(p)}<span><strong>${escapeHtml(p.nick)}</strong>
        <span class="card-sub">${last ? escapeHtml(messageText(last)).slice(0, 60) : t('cm.noMessages')}</span></span>${s.muted.includes(id) ? `<span class="pill">${t('cm.mutedLabel')}</span>` : ''}</button></li>`; }).join('')}</ul>`
      : `<p class="mt-3">${t('cm.noFriendsChat')}</p><button type="button" class="btn btn-primary btn-sm mt-2" data-tab="discover">${t('cm.tab.discover')}</button>`}</section>`;
}

function messageText(m) {
  if (m.deleted) return t('cm.deletedMsg');
  if (m.kind === 'photo') return t('cm.photoMsg');
  if (m.kind === 'focus') return t('cm.focusInvite');
  if (m.kind === 'challenge') return t('cm.challengeInvite', { name: t(`cm.ch.${m.text}`) });
  return m.key ? t(m.key) : m.text;
}

function chatView(s, id) {
  const p = byId[id];
  if (!s.friends.includes(id) || s.blocked.includes(id)) return `<p class="card-sub">${t('cm.notFriends')}</p>`;
  const msgs = s.chats[id] || [];
  const find = mid => msgs.find(m => m.id === mid);
  return `<button type="button" class="btn btn-ghost btn-sm" data-open-chat="">${icon('back', 15)} ${t('cm.messagesTitle')}</button>
    <section class="card cm-chat mt-2" aria-labelledby="chat-with">
      <header class="cm-post-head">${avatar(p)}<div><h2 id="chat-with" class="card-title">${escapeHtml(p.nick)}</h2><span class="card-sub">${t('cm.chatPrivacy')}</span></div>${synthBadge()}</header>
      <div class="mira-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-mute="${id}">${s.muted.includes(id) ? t('cm.unmute') : t('cm.muteChat')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-block="${id}">${t('cm.block')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-report="conversation:${id}">${t('cm.report')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-ask-mira>${icon('heart', 14)} ${t('cm.askMira')}</button>
      </div>
      <ol class="cm-messages" aria-live="polite">${msgs.map(m => {
        const reply = m.replyTo ? find(m.replyTo) : null;
        const photo = m.kind === 'photo' ? chatPhotos.get(m.id) : null;
        return `<li class="cm-msg ${m.from === 'me' ? 'is-me' : ''}">
          ${reply ? `<blockquote class="cm-quote">${escapeHtml(messageText(reply)).slice(0, 80)}</blockquote>` : ''}
          ${m.held ? `<p class="cm-held">${t('cm.heldForReview')}</p>` : ''}
          ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(t('cm.photoMsg'))}" class="cm-photo">` : `<p>${escapeHtml(messageText(m))}</p>`}
          ${Object.keys(m.reactions).length ? `<span class="cm-msg-reacts">${Object.keys(m.reactions).join(' ')}</span>` : ''}
          ${m.deleted ? '' : `<div class="cm-msg-actions">
            <button type="button" class="btn-link" data-reply="${m.id}">${t('cm.reply')}</button>
            ${REACTIONS.slice(0, 3).map(r => `<button type="button" class="cm-react cm-react-sm" data-msg-react="${m.id}:${r}" aria-label="${escapeHtml(t('cm.react', { r }))}">${r}</button>`).join('')}
            ${m.from === 'me' ? `<button type="button" class="btn-link" data-del-msg="${m.id}">${t('common.delete')}</button>` : `<button type="button" class="btn-link" data-report="message:${id}:${m.id}">${t('cm.report')}</button>`}
          </div>`}
        </li>`; }).join('')}</ol>
      ${ui.replyTo ? `<p class="cm-replying">${t('cm.replyingTo')}: “${escapeHtml(messageText(find(ui.replyTo) || {})).slice(0, 60)}” <button type="button" class="btn-link" data-reply="">${t('common.cancel')}</button></p>` : ''}
      <div class="tag-wrap mt-2" role="group" aria-label="${escapeHtml(t('cm.icebreakers'))}">
        ${Array.from({ length: ICEBREAKERS }, (_, i) => `<button type="button" class="tag tag-xs" data-ice-fill="${i}">${escapeHtml(t(`cm.ice.${i}`))}</button>`).join('')}</div>
      <form class="cm-send mt-2" data-send="${id}">
        <label class="sr-only" for="chat-text">${t('cm.writeMessage')}</label>
        <textarea id="chat-text" maxlength="500" rows="2" placeholder="${escapeHtml(t('cm.writeMessage'))}"></textarea>
        <div class="mira-actions">
          <button type="submit" class="btn btn-primary">${t('cm.send')}</button>
          <label class="btn btn-sm">${t('cm.sharePhoto')}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-chat-photo="${id}"></label>
          <button type="button" class="btn btn-sm" data-invite-focus="${id}">${t('cm.inviteFocus')}</button>
          <select class="cm-inline-select" data-invite-challenge="${id}" aria-label="${escapeHtml(t('cm.inviteChallenge'))}"><option value="">${t('cm.inviteChallenge')}</option>
            ${CHALLENGES.map(c => `<option value="${c}">${t(`cm.ch.${c}`)}</option>`).join('')}</select>
        </div>
      </form>
      <p class="card-note">${t('cm.demoNoReplies')}</p>
    </section>`;
}

// ---------- Activities ----------
function activitiesView(app, s) {
  const room = ui.focusRoom;
  const group = profilesFor(s.me.age).filter(p => !s.blocked.includes(p.id));
  const members = room ? group.filter(p => room === 'buddy' || p.circles.includes(room)).slice(0, 4) : [];
  const minute = Math.floor(Date.now() / 60000);
  const statuses = ['focusing', 'focusing', 'paused', 'finished'];
  return `<section class="card" aria-labelledby="ft"><h2 id="ft" class="card-title">${t('cm.focusTogether')}</h2><p class="card-sub">${t('cm.focusTogetherIntro')}</p>
      ${room ? `<p class="kit-tip mt-3">${t('cm.roomOf', { circle: room === 'buddy' ? t('cm.buddyRoom') : t(`cm.c.${room}.name`) })}</p>
        <ul class="cm-room">${members.map((p, i) => `<li>${avatar(p, 32)}<strong>${escapeHtml(p.nick)}</strong> ${synthBadge()}
          <span class="pill ${statuses[(i + minute) % 4] === 'focusing' ? 'pill-accent' : 'pill-lav'}">${t(`cm.st.${statuses[(i + minute) % 4]}`)}</span>
          <span class="card-sub">${t('cm.minutesLeft', { n: 25 - ((minute + i * 7) % 25) })}</span></li>`).join('')}</ul>
        <p class="card-note">${t('cm.tasksHidden')}</p>
        <div class="mira-actions"><button type="button" class="btn btn-primary" data-go="focus">${icon('play', 14)} ${t('cm.startMyTimer')}</button>
          <button type="button" class="btn btn-ghost" data-room="">${t('cm.leaveRoom')}</button></div>`
        : `<div class="tag-wrap mt-3">${CIRCLES.slice(0, 6).map(c => `<button type="button" class="tag tag-sm" data-room="${c.id}">${t(`cm.c.${c.id}.name`)}</button>`).join('')}</div>`}
    </section>
    <section class="card" aria-labelledby="buddy"><h2 id="buddy" class="card-title">${t('cm.buddyTitle')}</h2><p class="card-sub">${t('cm.buddyIntro')}</p>
      <form class="cm-row mt-3" data-buddy-form>
        <label class="field"><span class="card-sub">${t('cm.subject')}</span><select name="subject">${tList('cm.subjects').map((x, i) => `<option value="${i}">${escapeHtml(x)}</option>`).join('')}</select></label>
        <label class="field"><span class="card-sub">${t('cm.form.langs')}</span><select name="lang">${LANGS.map(l => `<option value="${l}">${t(`cm.lang.${l}`)}</option>`).join('')}</select></label>
        <label class="field"><span class="card-sub">${t('cm.time')}</span><select name="time">${tList('cm.times').map((x, i) => `<option value="${i}">${escapeHtml(x)}</option>`).join('')}</select></label>
        <label class="field"><span class="card-sub">${t('cm.style')}</span><select name="style">${tList('cm.styles').map((x, i) => `<option value="${i}">${escapeHtml(x)}</option>`).join('')}</select></label>
        <button type="submit" class="btn btn-primary">${t('cm.findBuddy')}</button>
      </form>
      ${ui.buddy ? `<div class="cm-people mt-3">${ui.buddy.map(id => { const p = byId[id]; return `<div class="cm-row-item">${avatar(p)}<div><strong>${escapeHtml(p.nick)}</strong> ${synthBadge()}<span class="card-sub">${p.langs.map(l => t(`cm.lang.${l}`)).join(', ')}</span></div>
        <button type="button" class="btn btn-sm" data-room="buddy">${t('cm.joinRoom')}</button></div>`; }).join('') || `<p class="card-sub">${t('cm.noMatches')}</p>`}
        <p class="card-note">${t('cm.buddyNote')}</p></div>` : ''}
    </section>
    <section class="card" aria-labelledby="chal"><h2 id="chal" class="card-title">${t('cm.challengesTitle')}</h2><p class="card-sub">${t('cm.challengesIntro')}</p>
      <ul class="kit-can">${CHALLENGES.map(c => `<li><label><input type="checkbox" data-challenge="${c}" ${s.challenges[c] ? 'checked' : ''}> ${t(`cm.ch.${c}`)}</label></li>`).join('')}</ul>
      <p class="card-note">${t('cm.noLeaderboard')}</p></section>
    <section class="card card-lav" aria-labelledby="kind"><h2 id="kind" class="card-title">${t('cm.kindnessTitle')}</h2><p class="card-sub">${t('cm.kindnessIntro')}</p>
      <form class="mira-inline mt-3" data-kindness><label class="sr-only" for="kind-text">${t('cm.kindnessTitle')}</label>
        <input id="kind-text" maxlength="200" placeholder="${escapeHtml(t('cm.kindnessPlaceholder'))}"><button type="submit" class="btn btn-sm">${t('cm.publish')}</button></form>
      <ul class="cm-kind">${[...s.kindness.slice().reverse().map(k => `<li><strong>${escapeHtml(s.me.nick)}</strong> ${escapeHtml(k.text)}${k.held ? ` <em>${t('cm.heldForReview')}</em>` : ''}</li>`),
        ...[0, 1, 2].map(i => `<li><strong>${escapeHtml(group[i] ? group[i].nick : '')}</strong> ${escapeHtml(t(`cm.kind.${i}`))} ${synthBadge()}</li>`)].join('')}</ul>
    </section>`;
}

// ---------- Safety ----------
function safetyView(s) {
  const queue = [...s.reports.map(r => ({ ...r, kindOf: 'report' })), ...s.flagged.map(f => ({ ...f, kindOf: 'flag' }))];
  return `<section class="card"><h2 class="card-title">${t('cm.rulesTitle')}</h2>${rulesList()}</section>
    <section class="card"><h2 class="card-title">${t('cm.howBlock')}</h2><ul class="mira-read">${socialHelp('block_report').map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      <p class="card-sub mt-2">${t('cm.reportCats')}: ${REPORT_CATEGORIES.map(c => t(`cm.rc.${c}`)).join(', ')}</p></section>
    <section class="card card-amber" aria-labelledby="modq"><h2 id="modq" class="card-title">${t('cm.modTitle')}</h2>
      <p class="card-sub">${t('cm.modIntro')}</p>
      ${queue.length ? `<ul class="cm-queue">${queue.map(q => `<li>
        <span class="pill ${q.status === 'open' ? 'pill-signal' : 'pill-lav'}">${t(`cm.qs.${q.status}`)}</span>
        <div><strong>${q.kindOf === 'report' ? t('cm.reportOf', { cat: t(`cm.rc.${q.category}`) }) : t('cm.autoFlag', { reason: t(`cm.fr.${q.reason}`) })}</strong>
          <span class="card-sub">${escapeHtml(q.kindOf === 'report' ? `${q.type}: ${q.target}${q.note ? ` — ${q.note}` : ''}` : q.text)}</span></div>
        ${q.status === 'open' ? `<div class="mira-actions"><button type="button" class="btn btn-sm" data-mod="${q.kindOf}:${q.id}:actioned">${t('cm.modAction')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-mod="${q.kindOf}:${q.id}:dismissed">${t('cm.modDismiss')}</button>
          ${q.kindOf === 'report' && byId[q.target.split(':')[0]] ? `<button type="button" class="btn btn-ghost btn-sm" data-suspend="${q.target.split(':')[0]}">${t('cm.suspend')}</button>` : ''}</div>` : ''}
      </li>`).join('')}</ul>` : `<p class="card-sub mt-2">${t('cm.modEmpty')}</p>`}
      <p class="card-note">${t('cm.modNote')}</p>
    </section>
    <section class="card"><h2 class="card-title">${t('cm.profileTitle')}</h2>${profileForm(s.me)}</section>
    <section class="card"><h2 class="card-title">${t('cm.realMode')}</h2><p>${t('cm.realModeText')}</p></section>`;
}

// ---------- veprimet ----------
function openReport(app, target) {
  const [type, ...rest] = target.split(':');
  const panel = openModal(t('cm.reportTitle'), `
    <p class="card-sub">${t('cm.reportIntro')}</p>
    <div class="mira-choices mt-3">${REPORT_CATEGORIES.map(c => `<button type="button" class="mira-choice" data-cat="${c}" aria-pressed="false">${t(`cm.rc.${c}`)}</button>`).join('')}</div>
    <label class="field mt-3"><span class="card-sub">${t('cm.reportNote')}</span><textarea data-note maxlength="300"></textarea></label>
    <button type="button" class="btn btn-danger mt-3" data-send-report disabled>${t('cm.report')}</button>`);
  let cat = null;
  panel.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    panel.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    panel.querySelector('[data-send-report]').disabled = false;
  }));
  panel.querySelector('[data-send-report]').addEventListener('click', () => {
    const s = state(app);
    s.reports.push({ id: `r${Date.now().toString(36)}`, target: rest.join(':'), type, category: cat, note: panel.querySelector('[data-note]').value.trim().slice(0, 300), status: 'open', at: Date.now() });
    app.save(); closeLayer(); toast(t('cm.reported'), 'success');
    app.rerender();
  });
}

function openHello(app, id) {
  const p = byId[id];
  const panel = openModal(t('cm.sayHelloTo', { nick: p.nick }), `
    <p class="card-sub">${t('cm.helloIntro')}</p>
    <div class="mira-choices mt-3">${Array.from({ length: ICEBREAKERS }, (_, i) => `<button type="button" class="mira-choice" data-ice="${i}">${escapeHtml(t(`cm.ice.${i}`))}</button>`).join('')}</div>
    <p class="card-note">${t('cm.helloNote')}</p>`);
  panel.querySelectorAll('[data-ice]').forEach(b => b.addEventListener('click', () => {
    const s = state(app);
    s.requests[id] = 'pending';
    app.save(); closeLayer(); toast(t('cm.requestSentToast'));
    app.rerender();
    // Demo: disa profile sintetike "pranojnë" pas pak sekondash. Të tjerët thjesht nuk përgjigjen —
    // refuzimi nuk krijon kurrë njoftim të turpshëm.
    if (PROFILES.indexOf(p) % 2 === 1) {
      setTimeout(() => {
        const st = state(app);
        if (st.requests[id] !== 'pending') return;
        st.requests[id] = 'accepted';
        if (!st.friends.includes(id)) st.friends.push(id);
        st.chats[id] = st.chats[id] || [];
        app.save();
        toast(t('cm.acceptedDemo', { nick: p.nick }));
        app.rerender();
      }, 2500);
    }
  }));
}

function openMiraHelp() {
  openModal(t('cm.askMira'), `
    <p class="card-sub">${t('cm.miraHelpIntro')}</p>
    <label class="field mt-3"><span class="card-sub">${t('cm.pasteMessage')}</span><textarea data-paste maxlength="500"></textarea></label>
    <div class="tag-wrap mt-3">${SOCIAL_HELP.map(k => `<button type="button" class="tag tag-sm" data-help="${k}">${t(`cm.help.${k}`)}</button>`).join('')}</div>
    <ul class="mira-read mt-3" data-help-out aria-live="polite"></ul>
    <p class="card-note">${t('cm.miraHelpNote')}</p>`).querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => {
    const out = document.querySelector('[data-help-out]');
    out.innerHTML = socialHelp(b.dataset.help).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  }));
}

// Kontrolli i përbashkët para çdo postimi/mesazhi: shpejtësia, lidhjet, të dhënat private, fjalët fyese.
function guard(app, text, where) {
  const s = state(app);
  const rate = rateCheck(s, text);
  if (rate) { toast(t(`cm.err.${rate}`)); return null; }
  const check = checkText(text);
  if (!check.ok) { toast(t(`cm.err.${check.reason}`)); return null; }
  recordRate(s, text);
  if (check.flag) {
    s.flagged.push({ id: `f${Date.now().toString(36)}`, where, text: text.slice(0, 500), reason: check.flag, status: 'open' });
    toast(t('cm.heldToast'));
  }
  return { held: Boolean(check.flag) };
}

function wire(root, app) {
  const s = state(app);
  const rerender = () => renderHub(root, app);
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', event => fn(el, event)));
  const commit = () => { app.save(); rerender(); };

  on('[data-tab]', el => { ui.tab = el.dataset.tab; ui.circle = null; if (ui.tab !== 'messages') ui.chat = null; rerender(); });

  // Formulari i profilit
  const pick = {};
  const form = root.querySelector('[data-profile-form]');
  if (form) {
    const base = s.me || { langs: ['sq'], interests: [], wants: [] };
    pick.langs = [...base.langs]; pick.interests = [...base.interests]; pick.wants = [...base.wants];
    on('[data-pick]', el => {
      const [name, value] = el.dataset.pick.split(':');
      pick[name] = pick[name].includes(value) ? pick[name].filter(v => v !== value) : [...pick[name], value];
      el.setAttribute('aria-pressed', String(pick[name].includes(value)));
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const nick = String(data.get('nick') || '').trim();
      const intro = String(data.get('intro') || '').trim();
      if (nick.length < 3) { toast(t('cm.err.nick')); return; }
      for (const text of [nick, intro].filter(Boolean)) {
        const check = checkText(text);
        if (!check.ok || check.flag) { toast(t(`cm.err.${check.ok ? 'intro_private' : check.reason}`)); return; }
      }
      const color = s.me ? s.me.color : ['#5a52c2', '#2672ad', '#0f766e', '#a8581a', '#3b7d52'][nick.length % 5];
      const age = String(data.get('age'));
      if (s.me && s.me.age !== age) { s.friends = []; s.requests = {}; s.chats = {}; s.seenDemoFriend = false; }
      s.me = { nick: nick.slice(0, 24), color, age, langs: pick.langs, interests: pick.interests.slice(0, 8), intro: intro.slice(0, 200), wants: pick.wants };
      app.save(); toast(t('cm.profileSaved'), 'success'); ui.tab = 'feed'; rerender();
    });
    on('[data-intro-help]', () => openModal(t('cm.introHelp'), `<ul class="mira-read">${socialHelp('intro').map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`));
  }
  if (!s.me) return;

  // Feed dhe postimet
  const typeSel = root.querySelector('[data-post-type]');
  if (typeSel) typeSel.addEventListener('change', () => { ui.draftType = typeSel.value; rerender(); });
  const audSel = root.querySelector('[data-audience]');
  if (audSel) audSel.addEventListener('change', () => { ui.audience = audSel.value; rerender(); });
  root.querySelectorAll('[data-post-form]').forEach(pf => pf.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(pf);
    const text = String(data.get('text') || '').trim();
    const result = guard(app, text, 'post');
    if (!result) return;
    const poll = data.get('type') === 'poll' ? [0, 1, 2].map(i => String(data.get(`opt${i}`) || '').trim()).filter(Boolean) : null;
    s.posts.push({ id: `u${Date.now().toString(36)}`, circle: String(data.get('circle') || 'newhere'), audience: String(data.get('audience') || 'circle'),
      selected: data.getAll('selected').map(String), type: String(data.get('type')), text, poll: poll && poll.length >= 2 ? poll : null, held: result.held, at: Date.now() });
    commit();
  }));
  on('[data-vote]', el => { const [id, i] = el.dataset.vote.split(':'); s.votes[id] = Number(i); commit(); });
  on('[data-react]', el => { const i = el.dataset.react.indexOf(':'); const id = el.dataset.react.slice(0, i); const r = el.dataset.react.slice(i + 1); s.reactions[id] = s.reactions[id] === r ? undefined : r; commit(); });
  root.querySelectorAll('[data-comment]').forEach(cf => cf.addEventListener('submit', event => {
    event.preventDefault();
    const text = cf.querySelector('input').value.trim();
    const result = guard(app, text, 'comment');
    if (!result) return;
    if (!result.held) (s.comments[cf.dataset.comment] = s.comments[cf.dataset.comment] || []).push(text);
    commit();
  }));
  const qotd = root.querySelector('[data-qotd]');
  if (qotd) qotd.addEventListener('submit', event => {
    event.preventDefault();
    const text = qotd.querySelector('input').value.trim();
    const result = guard(app, text, 'qotd');
    if (!result) return;
    s.posts.push({ id: `u${Date.now().toString(36)}`, circle: 'newhere', audience: 'circle', selected: [], type: 'question', text: `${t(`cm.q.${qotd.dataset.qotd}`)} — ${text}`, poll: null, held: result.held, at: Date.now() });
    commit();
  });

  // Discover, kërkesat, shokët
  on('[data-filter]', el => { ui.filter = el.dataset.filter || null; rerender(); });
  on('[data-hello]', el => openHello(app, el.dataset.hello));
  on('[data-accept]', el => { const id = el.dataset.accept; s.requests[id] = 'accepted'; if (!s.friends.includes(id)) s.friends.push(id); s.chats[id] = s.chats[id] || []; toast(t('cm.nowFriends')); commit(); });
  on('[data-decline]', el => { delete s.requests[el.dataset.decline]; toast(t('cm.declinedQuiet')); commit(); });
  on('[data-unfriend]', el => { const id = el.dataset.unfriend; s.friends = s.friends.filter(x => x !== id); delete s.requests[id]; if (ui.chat === id) ui.chat = null; commit(); });
  on('[data-mute]', el => { const id = el.dataset.mute; s.muted = s.muted.includes(id) ? s.muted.filter(x => x !== id) : [...s.muted, id]; commit(); });
  on('[data-block]', el => {
    const id = el.dataset.block;
    if (!s.blocked.includes(id)) s.blocked.push(id);
    s.friends = s.friends.filter(x => x !== id); delete s.requests[id];
    if (ui.chat === id) ui.chat = null;
    toast(t('cm.blocked', { nick: byId[id].nick })); commit();
  });
  on('[data-unblock]', el => { s.blocked = s.blocked.filter(x => x !== el.dataset.unblock); commit(); });
  on('[data-report]', el => openReport(app, el.dataset.report));

  // Circles
  on('[data-circle]', el => { ui.circle = el.dataset.circle || null; rerender(); });
  on('[data-join]', el => { const id = el.dataset.join; s.joined = s.joined.includes(id) ? s.joined.filter(x => x !== id) : [...s.joined, id]; commit(); });
  on('[data-room]', el => { ui.focusRoom = el.dataset.room || null; ui.tab = 'activities'; ui.circle = null; rerender(); });

  // Mesazhet — vetëm me shokë të pranuar.
  on('[data-open-chat]', el => { ui.chat = el.dataset.openChat || null; ui.tab = 'messages'; ui.replyTo = null; rerender(); });
  on('[data-reply]', el => { ui.replyTo = el.dataset.reply || null; rerender(); const box = root.querySelector('#chat-text'); if (box) box.focus(); });
  on('[data-msg-react]', el => {
    const [mid, r] = [el.dataset.msgReact.slice(0, el.dataset.msgReact.indexOf(':')), el.dataset.msgReact.slice(el.dataset.msgReact.indexOf(':') + 1)];
    const m = (s.chats[ui.chat] || []).find(x => x.id === mid);
    if (m) { if (m.reactions[r]) delete m.reactions[r]; else m.reactions[r] = true; commit(); }
  });
  on('[data-del-msg]', el => { const m = (s.chats[ui.chat] || []).find(x => x.id === el.dataset.delMsg); if (m && m.from === 'me') { m.deleted = true; m.text = ''; chatPhotos.delete(m.id); commit(); } });
  on('[data-ice-fill]', el => { const box = root.querySelector('#chat-text'); if (box) { box.value = t(`cm.ice.${el.dataset.iceFill}`); box.focus(); } });
  const send = root.querySelector('[data-send]');
  if (send) send.addEventListener('submit', event => {
    event.preventDefault();
    const id = send.dataset.send;
    if (!s.friends.includes(id)) return;
    const text = send.querySelector('textarea').value.trim();
    const result = guard(app, text, `chat:${id}`);
    if (!result) return;
    (s.chats[id] = s.chats[id] || []).push({ id: `m${Date.now().toString(36)}`, from: 'me', text, key: '', replyTo: ui.replyTo, reactions: {}, deleted: false, kind: 'text', held: result.held });
    ui.replyTo = null;
    commit();
  });
  const photoIn = root.querySelector('[data-chat-photo]');
  if (photoIn) photoIn.addEventListener('change', () => {
    const file = photoIn.files[0];
    const problem = checkImage(file);
    if (problem) { toast(t(`cm.err.${problem}`)); return; }
    const id = photoIn.dataset.chatPhoto;
    const mid = `m${Date.now().toString(36)}`;
    chatPhotos.set(mid, URL.createObjectURL(file));
    (s.chats[id] = s.chats[id] || []).push({ id: mid, from: 'me', text: '', key: '', replyTo: null, reactions: {}, deleted: false, kind: 'photo', held: false });
    toast(t('cm.photoDemo'));
    commit();
  });
  on('[data-invite-focus]', el => { const id = el.dataset.inviteFocus; (s.chats[id] = s.chats[id] || []).push({ id: `m${Date.now().toString(36)}`, from: 'me', text: '', key: '', replyTo: null, reactions: {}, deleted: false, kind: 'focus', held: false }); commit(); });
  const chal = root.querySelector('[data-invite-challenge]');
  if (chal) chal.addEventListener('change', () => {
    if (!chal.value) return;
    const id = chal.dataset.inviteChallenge;
    (s.chats[id] = s.chats[id] || []).push({ id: `m${Date.now().toString(36)}`, from: 'me', text: chal.value, key: '', replyTo: null, reactions: {}, deleted: false, kind: 'challenge', held: false });
    commit();
  });
  on('[data-ask-mira]', () => openMiraHelp());

  // Aktivitetet
  const buddy = root.querySelector('[data-buddy-form]');
  if (buddy) buddy.addEventListener('submit', event => {
    event.preventDefault();
    const lang = new FormData(buddy).get('lang');
    ui.buddy = profilesFor(s.me.age).filter(p => !s.blocked.includes(p.id) && p.langs.includes(lang) && (p.interests.includes('studying') || p.interests.includes('languages') || p.interests.includes('coding'))).map(p => p.id);
    rerender();
  });
  root.querySelectorAll('[data-challenge]').forEach(box => box.addEventListener('change', () => { if (box.checked) s.challenges[box.dataset.challenge] = true; else delete s.challenges[box.dataset.challenge]; app.save(); }));
  const kind = root.querySelector('[data-kindness]');
  if (kind) kind.addEventListener('submit', event => {
    event.preventDefault();
    const text = kind.querySelector('input').value.trim();
    const result = guard(app, text, 'kindness');
    if (!result) return;
    s.kindness.push({ text, at: Date.now(), held: result.held });
    commit();
  });

  // Moderimi (pamje demo e moderatorit)
  on('[data-mod]', el => {
    const [kindOf, id, status] = el.dataset.mod.split(':');
    const list = kindOf === 'report' ? s.reports : s.flagged;
    const item = list.find(x => x.id === id);
    if (item) { item.status = status; commit(); }
  });
  on('[data-suspend]', el => { const id = el.dataset.suspend; if (!s.suspended.includes(id)) s.suspended.push(id); toast(t('cm.suspended')); commit(); });
}
