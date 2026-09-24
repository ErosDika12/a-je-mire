// Komuniteti privat (opsional). Asgjë nga check-ins nuk publikohet vetë: postimi është tekst që
// shkruan përdoruesi, dhe një matje e vetme vetëm pas parapamjes dhe konfirmimit të qartë.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatRelative, formatNumber } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, currentUser, friendlyError, rpc } from '../cloud/session.js';
import { normalReport } from '../patterns.js';
import { avatarSvg, loadMyProfile, profileSetupCard, wireProfileSetup, openReportDialog, blockUser, muteUser, signInPrompt } from '../social.js';

const PAGE = 20;
const state = { posts: [], cursor: null, done: false, loading: false, attached: null, openReplies: new Set(), rules: null };

export async function renderCommunity(container, app) {
  container.innerHTML = `${head()}<section class="card"><p class="status" role="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p></section>`;
  const user = await ensureSession();
  if (!user) { container.innerHTML = head() + signInPrompt(t('community.signInNeeded')); return; }
  const profile = await loadMyProfile();
  if (!profile) {
    container.innerHTML = head() + rulesCard() + profileSetupCard(null);
    wireProfileSetup(container, () => renderCommunity(container, app));
    return;
  }
  if (state.rules === null) loadRules().then(() => { const box = container.querySelector('#rules-body'); if (box && state.rules) box.textContent = state.rules; });
  container.innerHTML = head() + rulesCard() + composer(profile) + `<section class="stack mt-4" id="feed" aria-live="polite"></section>
    <div class="row mt-4" style="justify-content:center"><button type="button" class="btn" id="feed-more" hidden>${escapeHtml(t('common.loadMore'))}</button></div>`;
  wireComposer(container, app);
  container.querySelector('#feed-more').addEventListener('click', () => loadPage(container, false));
  await loadPage(container, true);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('community.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('community.subtitle'))}</p>
  </header>`;
}

async function loadRules() {
  const { data } = await getClient().from('content_pages').select('body').eq('key', 'community_rules').eq('lang', document.documentElement.lang === 'en' ? 'en' : 'sq').eq('published', true).maybeSingle();
  state.rules = data ? data.body : '';
}

function rulesCard() {
  return `<details class="card collapse">
    <summary>${icon('shield', 16)} ${escapeHtml(t('community.rulesTitle'))}</summary>
    <div class="collapse-body">
      <ul class="changelog" id="rules-list">${[1, 2, 3, 4, 5, 6].map(n => `<li>${escapeHtml(t(`community.rule${n}`))}</li>`).join('')}</ul>
      <p class="small muted mt-3" id="rules-body" style="white-space:pre-wrap">${escapeHtml(state.rules || '')}</p>
      <p class="card-note">${escapeHtml(t('community.notAdvice'))}</p>
    </div>
  </details>`;
}

function composer(profile) {
  return `<section class="card mt-4">
    <form class="stack" id="post-form">
      <div class="row" style="gap:var(--s3);align-items:center">${avatarSvg(profile.avatar_seed, 32)}<strong>${escapeHtml(profile.nickname)}</strong></div>
      <label class="sr-only" for="post-body">${escapeHtml(t('community.writeLabel'))}</label>
      <textarea id="post-body" rows="3" maxlength="1000" placeholder="${escapeHtml(t('community.placeholder'))}" required></textarea>
      <div id="attached"></div>
      <div class="row-between">
        <button type="button" class="btn btn-sm" id="attach-measure">${icon('patterns', 15)} ${escapeHtml(t('community.shareMeasure'))}</button>
        <button type="submit" class="btn btn-primary">${icon('check', 16)} ${escapeHtml(t('community.post'))}</button>
      </div>
      <p class="card-note">${escapeHtml(t('community.visibleNote'))}</p>
    </form>
  </section>`;
}

function measureChip(shared) {
  if (!shared) return '';
  const label = t(`metrics.${shared.metric}`);
  const text = shared.kind === 'average'
    ? t('community.measureAverage', { metric: label, value: formatNumber(shared.value, 1), days: shared.days })
    : t('community.measureChange', { metric: label, value: `${shared.value > 0 ? '+' : ''}${formatNumber(shared.value, 0)}%`, days: shared.days });
  return `<p class="pill mt-2">${icon('patterns', 13)} ${escapeHtml(text)}</p>`;
}

function wireComposer(container, app) {
  const form = container.querySelector('#post-form');
  container.querySelector('#attach-measure').addEventListener('click', () => openShareFlow(container, app));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = container.querySelector('#post-body').value.trim();
    if (!body) return;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    const { error } = await getClient().from('posts').insert({ author_id: currentUser().id, body, shared: state.attached });
    button.disabled = false;
    if (error) { toast(friendlyError(error), 'err'); return; }
    state.attached = null;
    container.querySelector('#post-body').value = '';
    container.querySelector('#attached').innerHTML = '';
    toast(t('community.posted'), 'ok');
    await loadPage(container, true);
  });
}

// Ndarja e një matjeje: zgjedhje → parapamje e saktë → konfirmim. Vendimi regjistrohet (ndau / anuloi).
function openShareFlow(container, app) {
  const checkins = app.profile.checkins;
  const report = normalReport(checkins, app.profile.settings);
  const options = [];
  for (const factor of report) {
    if (factor.recent !== null) options.push({ key: `${factor.metric}:average`, shared: { kind: 'average', metric: factor.metric, value: Math.round(factor.recent * 10) / 10, days: factor.recentDays } });
    if (factor.pct !== null) options.push({ key: `${factor.metric}:change_pct`, shared: { kind: 'change_pct', metric: factor.metric, value: Math.round(factor.pct), days: factor.recentDays } });
  }
  if (options.length === 0) { toast(t('community.noMeasures'), 'err'); return; }
  const panel = openModal(t('community.shareTitle'), `
    <div class="stack">
      <div class="field"><label for="share-pick">${escapeHtml(t('community.shareWhich'))}</label>
        <select id="share-pick">${options.map(option => `<option value="${option.key}">${escapeHtml(chipText(option.shared))}</option>`).join('')}</select></div>
      <div class="card card-soft" id="share-preview"></div>
      <ul class="facts">
        <li class="fact"><span class="fact-ic">${icon('check', 14)}</span><span>${escapeHtml(t('community.visibleYes'))}</span></li>
        <li class="fact fact-no"><span class="fact-ic">${icon('close', 14)}</span><span>${escapeHtml(t('community.visibleNo'))}</span></li>
      </ul>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
        <button type="button" class="btn btn-primary" data-confirm>${escapeHtml(t('community.attach'))}</button>
      </div>
    </div>`);
  const pick = panel.querySelector('#share-pick');
  const draw = () => {
    const option = options.find(item => item.key === pick.value);
    panel.querySelector('#share-preview').innerHTML = `<p class="small muted">${escapeHtml(t('community.previewLabel'))}</p>${measureChip(option.shared)}`;
  };
  pick.addEventListener('change', draw);
  draw();
  const decide = decision => {
    const option = options.find(item => item.key === pick.value);
    getClient().from('share_decisions').insert({ user_id: currentUser().id, context: 'community_post', decision, fields: [option.shared.metric, option.shared.kind] }).then(() => {});
    return option;
  };
  panel.querySelector('[data-cancel]').addEventListener('click', () => { decide('cancelled'); closeLayer(); });
  panel.querySelector('[data-confirm]').addEventListener('click', () => {
    const option = decide('shared');
    state.attached = option.shared;
    closeLayer();
    container.querySelector('#attached').innerHTML = `${measureChip(option.shared)}
      <button type="button" class="btn btn-sm mt-2" id="detach">${icon('close', 13)} ${escapeHtml(t('community.detach'))}</button>`;
    container.querySelector('#detach').addEventListener('click', () => { state.attached = null; container.querySelector('#attached').innerHTML = ''; });
  });
}

function chipText(shared) {
  const label = t(`metrics.${shared.metric}`);
  return shared.kind === 'average'
    ? t('community.measureAverage', { metric: label, value: formatNumber(shared.value, 1), days: shared.days })
    : t('community.measureChange', { metric: label, value: `${shared.value > 0 ? '+' : ''}${formatNumber(shared.value, 0)}%`, days: shared.days });
}

async function loadPage(container, reset) {
  // Një rifillim (reset) ka gjithmonë përparësi; një kërkesë e vjetër që mbaron më vonë hidhet.
  if (state.loading && !reset) return;
  const token = (state.token = (state.token || 0) + 1);
  state.loading = true;
  if (reset) { state.posts = []; state.cursor = null; state.done = false; }
  const loadingFeed = container.querySelector('#feed');
  if (reset && loadingFeed) loadingFeed.innerHTML = `<p class="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p>`;
  const { data, error } = await getClient().rpc('community_feed', {
    p_before: state.cursor ? state.cursor.created_at : null, p_before_id: state.cursor ? state.cursor.id : null, p_limit: PAGE
  });
  if (token !== state.token) return;
  state.loading = false;
  // Elementi kërkohet sërish: ekrani mund të jetë rivizatuar ndërkohë.
  const feed = container.querySelector('#feed');
  if (!feed) return;
  if (error) { feed.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  state.posts.push(...data);
  if (data.length) state.cursor = data[data.length - 1];
  state.done = data.length < PAGE;
  if (!state.posts.length) {
    feed.innerHTML = `<section class="card"><p class="muted">${escapeHtml(t('community.empty'))}</p></section>`;
  } else {
    feed.innerHTML = state.posts.map(postCard).join('');
    wireFeed(container);
  }
  const more = container.querySelector('#feed-more');
  if (more) more.hidden = state.done;
}

function postCard(post) {
  const reactions = post.reactions || {};
  const mine = new Set(post.my_reactions || []);
  const hidden = post.status !== 'visible';
  return `<article class="card post" data-post="${post.id}" aria-label="${escapeHtml(t('community.postBy', { name: post.nickname || t('community.anon') }))}">
    <header class="row-between">
      <div class="row" style="gap:var(--s3);align-items:center">${avatarSvg(post.avatar_seed || 0, 32)}
        <div><strong>${escapeHtml(post.nickname || t('community.anon'))}</strong>
        <div class="small muted"><time datetime="${escapeHtml(post.created_at)}">${escapeHtml(formatRelative(post.created_at))}</time></div></div></div>
      <button type="button" class="icon-btn" data-menu="${post.id}" aria-label="${escapeHtml(t('common.more'))}">${icon('more', 18)}</button>
    </header>
    ${hidden ? `<p class="warn mt-3">${icon('info', 14)} ${escapeHtml(t(`community.status_${post.status}`))}</p>` : ''}
    <p class="post-body mt-3">${escapeHtml(post.body)}</p>
    ${measureChip(post.shared)}
    <div class="row mt-3 reaction-row" role="group" aria-label="${escapeHtml(t('community.reactions'))}">
      ${['support', 'thanks', 'same'].map(kind => `<button type="button" class="tag" data-react="${kind}" aria-pressed="${mine.has(kind)}" ${hidden ? 'disabled' : ''}>
        ${escapeHtml(t(`community.react_${kind}`))}${reactions[kind] ? ` · ${reactions[kind]}` : ''}</button>`).join('')}
      <button type="button" class="btn btn-sm" data-replies="${post.id}" aria-expanded="${state.openReplies.has(post.id)}">${icon('why', 14)} ${escapeHtml(t('community.replies', { n: post.reply_count }))}</button>
    </div>
    <div class="replies" id="replies-${post.id}" ${state.openReplies.has(post.id) ? '' : 'hidden'}></div>
  </article>`;
}

function wireFeed(container) {
  for (const article of container.querySelectorAll('[data-post]')) wireArticle(container, article);
}

// Çdo postim lidhet veç e veç, që rivizatimi i njërit të mos dyfishojë dëgjuesit e të tjerëve.
function wireArticle(container, article) {
  {
    const id = article.dataset.post;
    const post = state.posts.find(item => item.id === id);
    for (const button of article.querySelectorAll('[data-react]')) {
      button.addEventListener('click', async () => {
        const kind = button.dataset.react;
        const on = button.getAttribute('aria-pressed') === 'true';
        const query = on
          ? getClient().from('reactions').delete().match({ post_id: id, user_id: currentUser().id, kind })
          : getClient().from('reactions').insert({ post_id: id, user_id: currentUser().id, kind });
        const { error } = await query;
        if (error) { toast(friendlyError(error), 'err'); return; }
        post.my_reactions = on ? post.my_reactions.filter(item => item !== kind) : [...(post.my_reactions || []), kind];
        post.reactions = { ...post.reactions, [kind]: Math.max(0, (post.reactions[kind] || 0) + (on ? -1 : 1)) };
        article.outerHTML = postCard(post);
        wireArticle(container, container.querySelector(`[data-post="${id}"]`));
      });
    }
    article.querySelector('[data-replies]').addEventListener('click', () => toggleReplies(container, post));
    article.querySelector('[data-menu]').addEventListener('click', () => postMenu(container, post));
    if (state.openReplies.has(id)) loadReplies(container, post);
  }
}

function postMenu(container, post) {
  const panel = openModal(t('common.actions'), `<div class="stack">
    ${post.mine
      ? `<button type="button" class="btn btn-danger" data-act="delete">${icon('trash', 15)} ${escapeHtml(t('community.deletePost'))}</button>`
      : `<button type="button" class="btn" data-act="report">${icon('shield', 15)} ${escapeHtml(t('report.title'))}</button>
         <button type="button" class="btn" data-act="mute">${icon('close', 15)} ${escapeHtml(t('social.mute'))}</button>
         <button type="button" class="btn btn-danger" data-act="block">${icon('lock', 15)} ${escapeHtml(t('social.block'))}</button>`}
  </div>`);
  const on = (act, handler) => { const element = panel.querySelector(`[data-act="${act}"]`); if (element) element.addEventListener('click', handler); };
  on('delete', async () => {
    closeLayer();
    try { await rpc('delete_post', { p_id: post.id }); toast(t('community.deleted'), 'ok'); await loadPage(container, true); }
    catch (error) { toast(error.message, 'err'); }
  });
  on('report', () => { closeLayer(); openReportDialog('post', post.id); });
  on('mute', () => { closeLayer(); muteUser(post.author_id, () => loadPage(container, true)); });
  on('block', () => { closeLayer(); blockUser(post.author_id, () => loadPage(container, true)); });
}

async function toggleReplies(container, post) {
  if (state.openReplies.has(post.id)) state.openReplies.delete(post.id); else state.openReplies.add(post.id);
  const box = container.querySelector(`#replies-${post.id}`);
  box.hidden = !state.openReplies.has(post.id);
  container.querySelector(`[data-replies="${post.id}"]`).setAttribute('aria-expanded', String(!box.hidden));
  if (!box.hidden) await loadReplies(container, post);
}

async function loadReplies(container, post) {
  const box = container.querySelector(`#replies-${post.id}`);
  if (!box) return;
  const { data, error } = await getClient().rpc('post_replies', { p_post: post.id, p_limit: 100 });
  if (error) { box.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  box.innerHTML = `${data.map(reply => `<div class="reply" data-reply="${reply.id}">
      <div class="row-between"><div class="row" style="gap:var(--s2);align-items:center">${avatarSvg(reply.avatar_seed || 0, 24)}
        <strong class="small">${escapeHtml(reply.nickname || t('community.anon'))}</strong>
        <time class="small muted" datetime="${escapeHtml(reply.created_at)}">${escapeHtml(formatRelative(reply.created_at))}</time></div>
        ${reply.mine
          ? `<button type="button" class="icon-btn" data-del-reply="${reply.id}" aria-label="${escapeHtml(t('common.delete'))}">${icon('trash', 14)}</button>`
          : `<button type="button" class="icon-btn" data-report-reply="${reply.id}" aria-label="${escapeHtml(t('report.title'))}">${icon('shield', 14)}</button>`}
      </div>
      ${reply.status !== 'visible' ? `<p class="warn small">${escapeHtml(t(`community.status_${reply.status}`))}</p>` : ''}
      <p class="post-body small">${escapeHtml(reply.body)}</p>
    </div>`).join('') || `<p class="small muted">${escapeHtml(t('community.noReplies'))}</p>`}
    ${post.status === 'visible' ? `<form class="row mt-3" data-reply-form>
      <label class="sr-only" for="reply-${post.id}">${escapeHtml(t('community.replyLabel'))}</label>
      <input id="reply-${post.id}" maxlength="500" required placeholder="${escapeHtml(t('community.replyPlaceholder'))}" style="flex:1;min-width:0">
      <button type="submit" class="btn btn-sm btn-primary">${escapeHtml(t('community.reply'))}</button></form>` : ''}`;
  const form = box.querySelector('[data-reply-form]');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const { error: insertError } = await getClient().from('replies').insert({ post_id: post.id, author_id: currentUser().id, body: input.value.trim() });
    if (insertError) { toast(friendlyError(insertError), 'err'); return; }
    post.reply_count += 1;
    await loadReplies(container, post);
    const counter = container.querySelector(`[data-replies="${post.id}"]`);
    if (counter) counter.innerHTML = `${icon('why', 14)} ${escapeHtml(t('community.replies', { n: post.reply_count }))}`;
  });
  for (const button of box.querySelectorAll('[data-del-reply]')) button.addEventListener('click', async () => {
    try { await rpc('delete_reply', { p_id: button.dataset.delReply }); await loadReplies(container, post); } catch (e) { toast(e.message, 'err'); }
  });
  for (const button of box.querySelectorAll('[data-report-reply]')) button.addEventListener('click', () => openReportDialog('reply', button.dataset.reportReply));
}
