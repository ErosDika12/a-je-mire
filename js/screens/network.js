// Rrjeti: lidhjet, mesazhet direkte dhe bllokimet. Pa import kontaktesh, pa sugjerime, pa numra ndjekësish.
// Mesazhet NUK janë të enkriptuara skaj-më-skaj; kjo thuhet qartë në ekran.
// MY 5 nuk kthehet kurrë automatikisht në lidhje platforme, dhe KAFE? vazhdon vetëm të kopjojë tekst.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatRelative, formatDateTime } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, currentUser, friendlyError, rpc } from '../cloud/session.js';
import { isEnabled } from '../flags.js';
import { avatarSvg, loadMyProfile, profileSetupCard, wireProfileSetup, openReportDialog, blockUser, muteUser, signInPrompt } from '../social.js';

const PAGE = 30;
const state = { tab: 'connections', open: null, messages: [], cursor: null, done: false, poll: null, token: 0 };

export async function renderNetwork(container, app) {
  stopPolling();
  // Çdo vizatim merr një shenjë; një vizatim i vjetër (p.sh. para një klikimi skede) ndalet vetë.
  const token = ++state.token;
  const stale = () => token !== state.token;
  container.innerHTML = head() + `<section class="card"><p class="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p></section>`;
  const user = await ensureSession();
  if (stale()) return;
  if (!user) { container.innerHTML = head() + signInPrompt(t('network.signInNeeded')); return; }
  const profile = await loadMyProfile();
  if (stale()) return;
  if (!profile) {
    container.innerHTML = head() + profileSetupCard(null);
    wireProfileSetup(container, () => renderNetwork(container, app));
    return;
  }
  const tabs = [
    isEnabled('connections') && ['connections', t('network.tabConnections')],
    isEnabled('messages') && ['messages', t('network.tabMessages')],
    ['safety', t('network.tabSafety')],
    ['profile', t('network.tabProfile')]
  ].filter(Boolean);
  if (!tabs.some(([key]) => key === state.tab)) state.tab = tabs[0][0];
  container.innerHTML = head() + `<div class="seg-control connect-tabs" role="group" aria-label="${escapeHtml(t('network.title'))}">
      ${tabs.map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${state.tab === key}">${escapeHtml(label)}</button>`).join('')}
    </div><div class="mt-4" id="network-body"></div>`;
  for (const button of container.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => { state.tab = button.dataset.tab; state.open = null; renderNetwork(container, app); });
  }
  const body = container.querySelector('#network-body');
  if (state.tab === 'connections') await renderConnections(body, container, app);
  else if (state.tab === 'messages') await (state.open ? renderConversation(body, container, app, state.open, stale) : renderConversationList(body, container, app));
  else if (state.tab === 'safety') await renderSafety(body, container, app);
  else { body.innerHTML = profileSetupCard(profile); wireProfileSetup(body, () => renderNetwork(container, app)); }
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('network.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('network.subtitle'))}</p>
  </header>`;
}

// ---------- lidhjet ----------
async function renderConnections(body, container, app) {
  const { data, error } = await getClient().rpc('my_connections');
  if (error) { body.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  const incoming = data.filter(row => row.status === 'pending' && row.direction === 'incoming');
  const outgoing = data.filter(row => row.status === 'pending' && row.direction === 'outgoing');
  const accepted = data.filter(row => row.status === 'accepted');
  const person = row => `<span class="row" style="gap:var(--s2);align-items:center">${avatarSvg(row.avatar_seed || 0, 28)}<strong>${escapeHtml(row.nickname || '—')}</strong></span>`;
  body.innerHTML = `
    <section class="card">
      <h2 class="card-title">${escapeHtml(t('network.addTitle'))}</h2>
      <form class="row mt-3" id="request-form">
        <label class="sr-only" for="request-nick">${escapeHtml(t('social.nickname'))}</label>
        <input id="request-nick" required minlength="3" maxlength="24" autocomplete="off" placeholder="${escapeHtml(t('network.nickPlaceholder'))}" style="flex:1;min-width:0">
        <button type="submit" class="btn btn-primary">${escapeHtml(t('network.send'))}</button>
      </form>
      <p class="card-note">${escapeHtml(t('network.noSuggestions'))}</p>
    </section>
    <section class="card mt-4"><h2 class="card-title">${escapeHtml(t('network.incoming'))}</h2>
      ${incoming.length ? incoming.map(row => `<div class="row-between list-row">${person(row)}<span class="row">
        <button type="button" class="btn btn-sm btn-primary" data-accept="${row.id}">${escapeHtml(t('network.accept'))}</button>
        <button type="button" class="btn btn-sm" data-decline="${row.id}">${escapeHtml(t('network.decline'))}</button>
        <button type="button" class="icon-btn" data-block="${row.other_id}" aria-label="${escapeHtml(t('social.block'))}">${icon('lock', 15)}</button></span></div>`).join('')
      : `<p class="small muted mt-2">${escapeHtml(t('network.noIncoming'))}</p>`}
    </section>
    <section class="card mt-4"><h2 class="card-title">${escapeHtml(t('network.outgoing'))}</h2>
      ${outgoing.length ? outgoing.map(row => `<div class="row-between list-row">${person(row)}
        <button type="button" class="btn btn-sm" data-remove="${row.id}">${escapeHtml(t('network.cancelRequest'))}</button></div>`).join('')
      : `<p class="small muted mt-2">${escapeHtml(t('network.noOutgoing'))}</p>`}
    </section>
    <section class="card mt-4"><h2 class="card-title">${escapeHtml(t('network.connections'))}</h2>
      ${accepted.length ? accepted.map(row => `<div class="row-between list-row">${person(row)}<span class="row">
        ${isEnabled('messages') ? `<button type="button" class="btn btn-sm" data-message="${row.other_id}">${icon('edit', 14)} ${escapeHtml(t('network.message'))}</button>` : ''}
        <button type="button" class="icon-btn" data-more="${row.id}" aria-label="${escapeHtml(t('common.more'))}">${icon('more', 16)}</button></span></div>`).join('')
      : `<p class="small muted mt-2">${escapeHtml(t('network.noConnections'))}</p>`}
      <p class="card-note">${escapeHtml(t('network.my5Note'))}</p>
    </section>`;

  const refresh = () => renderNetwork(container, app);
  body.querySelector('#request-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await rpc('request_connection', { p_nickname: body.querySelector('#request-nick').value.trim() }); toast(t('network.requested'), 'ok'); refresh(); }
    catch (error) { toast(error.message, 'err'); }
  });
  const act = (selector, handler) => { for (const button of body.querySelectorAll(selector)) button.addEventListener('click', () => handler(button)); };
  act('[data-accept]', async button => { try { await rpc('respond_connection', { p_id: button.dataset.accept, p_accept: true }); refresh(); } catch (e) { toast(e.message, 'err'); } });
  act('[data-decline]', async button => { try { await rpc('respond_connection', { p_id: button.dataset.decline, p_accept: false }); refresh(); } catch (e) { toast(e.message, 'err'); } });
  act('[data-remove]', async button => { try { await rpc('remove_connection', { p_id: button.dataset.remove }); refresh(); } catch (e) { toast(e.message, 'err'); } });
  act('[data-block]', button => blockUser(button.dataset.block, refresh));
  act('[data-message]', async button => {
    try { state.open = { id: await rpc('start_conversation', { p_other: button.dataset.message }) }; state.tab = 'messages'; refresh(); }
    catch (e) { toast(e.message, 'err'); }
  });
  act('[data-more]', button => {
    const row = accepted.find(item => item.id === button.dataset.more);
    const panel = openModal(row.nickname || '—', `<div class="stack">
      <button type="button" class="btn" data-a="report">${icon('shield', 15)} ${escapeHtml(t('network.reportProfile'))}</button>
      <button type="button" class="btn" data-a="mute">${icon('close', 15)} ${escapeHtml(t('social.mute'))}</button>
      <button type="button" class="btn" data-a="remove">${icon('trash', 15)} ${escapeHtml(t('network.removeConnection'))}</button>
      <button type="button" class="btn btn-danger" data-a="block">${icon('lock', 15)} ${escapeHtml(t('social.block'))}</button></div>`);
    panel.querySelector('[data-a="report"]').addEventListener('click', () => { closeLayer(); openReportDialog('profile', row.other_id); });
    panel.querySelector('[data-a="mute"]').addEventListener('click', () => { closeLayer(); muteUser(row.other_id); });
    panel.querySelector('[data-a="remove"]').addEventListener('click', async () => { closeLayer(); try { await rpc('remove_connection', { p_id: row.id }); refresh(); } catch (e) { toast(e.message, 'err'); } });
    panel.querySelector('[data-a="block"]').addEventListener('click', () => { closeLayer(); blockUser(row.other_id, refresh); });
  });
}

// ---------- bisedat ----------
async function renderConversationList(body, container, app) {
  const { data, error } = await getClient().rpc('my_conversations');
  if (error) { body.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  body.innerHTML = `${encryptionNotice()}
    <section class="card mt-4" aria-label="${escapeHtml(t('network.conversations'))}">
      ${data.length ? data.map(row => `<button type="button" class="conv-row" data-open="${row.id}">
        ${avatarSvg(row.avatar_seed || 0, 36)}
        <span class="conv-main"><strong>${escapeHtml(row.nickname || '—')}</strong>
          <span class="small muted conv-preview">${row.last_from_me ? escapeHtml(t('network.you')) + ': ' : ''}${escapeHtml(row.last_body || '')}</span></span>
        <span class="conv-side"><time class="small muted" datetime="${escapeHtml(row.last_message_at)}">${escapeHtml(formatRelative(row.last_message_at))}</time>
          ${row.unread ? `<span class="pill pill-accent" aria-label="${escapeHtml(t('network.unreadCount', { n: row.unread }))}">${row.unread}</span>` : ''}</span>
      </button>`).join('') : `<p class="small muted">${escapeHtml(t('network.noConversations'))}</p>`}
    </section>`;
  for (const button of body.querySelectorAll('[data-open]')) {
    button.addEventListener('click', () => { state.open = { id: button.dataset.open }; renderNetwork(container, app); });
  }
}

function encryptionNotice() {
  return `<section class="card card-soft"><p class="small">${icon('info', 14)} ${escapeHtml(t('network.encryptionNotice'))}</p></section>`;
}

async function renderConversation(body, container, app, open, stale) {
  const { data: list } = await getClient().rpc('my_conversations');
  if (stale()) return;
  const meta = (list || []).find(row => row.id === open.id) || { nickname: '—', other_id: null, blocked: false };
  state.messages = []; state.cursor = null; state.done = false;
  body.innerHTML = `
    <div class="row-between">
      <button type="button" class="btn btn-sm" id="conv-back">${icon('back', 14)} ${escapeHtml(t('common.back'))}</button>
      <button type="button" class="icon-btn" id="conv-menu" aria-label="${escapeHtml(t('common.more'))}">${icon('more', 18)}</button>
    </div>
    <section class="card mt-3 conversation">
      <h2 class="card-title">${escapeHtml(meta.nickname || '—')}</h2>
      <div class="row mt-2" style="justify-content:center"><button type="button" class="btn btn-sm" id="older" hidden>${escapeHtml(t('network.older'))}</button></div>
      <ol class="message-list" id="message-list" aria-live="polite" aria-label="${escapeHtml(t('network.messagesLabel'))}"></ol>
      ${meta.blocked ? `<p class="warn mt-3">${escapeHtml(t('network.blockedConversation'))}</p>` : `
      <form class="composer" id="send-form">
        <label class="sr-only" for="send-body">${escapeHtml(t('network.writeMessage'))}</label>
        <textarea id="send-body" rows="1" maxlength="2000" required enterkeyhint="send" placeholder="${escapeHtml(t('network.writeMessage'))}"></textarea>
        <button type="submit" class="btn btn-primary" aria-label="${escapeHtml(t('network.send'))}">${icon('next', 18)}</button>
      </form>
      <p class="card-note">${escapeHtml(t('network.intentional'))}</p>`}
    </section>`;
  body.querySelector('#conv-back').addEventListener('click', () => { state.open = null; renderNetwork(container, app); });
  body.querySelector('#older').addEventListener('click', () => loadMessages(body, open, false));
  body.querySelector('#conv-menu').addEventListener('click', () => conversationMenu(meta, open, container, app));
  const form = body.querySelector('#send-form');
  if (form) {
    const input = body.querySelector('#send-body');
    // Tastiera e celularit: fusha mbetet e dukshme dhe lartësia rritet me tekstin.
    input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'end', behavior: 'smooth' }), 250));
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; });
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      const { error } = await getClient().from('messages').insert({ conversation_id: open.id, sender_id: currentUser().id, body: text });
      button.disabled = false;
      if (error) { toast(friendlyError(error), 'err'); return; }
      input.value = '';
      input.style.height = 'auto';
      await loadMessages(body, open, true);
    });
  }
  await loadMessages(body, open, true);
  if (stale()) return;
  await getClient().rpc('mark_conversation_read', { p_conversation: open.id });
  if (stale()) return;
  // Rifreskim i butë vetëm kur biseda është e hapur dhe faqja e dukshme.
  state.poll = setInterval(async () => {
    if (document.hidden || !body.isConnected) { if (!body.isConnected) stopPolling(); return; }
    await loadMessages(body, open, true, true);
    await getClient().rpc('mark_conversation_read', { p_conversation: open.id });
  }, 5000);
}

function stopPolling() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
}

async function loadMessages(body, open, reset, quiet = false) {
  const { data, error } = await getClient().rpc('conversation_messages', {
    p_conversation: open.id,
    p_before: reset ? null : state.cursor && state.cursor.created_at,
    p_before_id: reset ? null : state.cursor && state.cursor.id,
    p_limit: PAGE
  });
  if (error) { if (!quiet) toast(friendlyError(error), 'err'); return; }
  if (reset) state.messages = data; else state.messages.push(...data);
  if (data.length) state.cursor = state.messages[state.messages.length - 1];
  if (reset) state.done = data.length < PAGE; else state.done = data.length < PAGE;
  const list = body.querySelector('#message-list');
  if (!list) return;
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const ordered = [...state.messages].reverse();
  list.innerHTML = ordered.map(message => `<li class="bubble ${message.mine ? 'mine' : 'theirs'}" data-message="${message.id}">
      <p class="post-body">${escapeHtml(message.body)}</p>
      <span class="bubble-meta">
        <time datetime="${escapeHtml(message.created_at)}" title="${escapeHtml(formatDateTime(message.created_at))}">${escapeHtml(formatRelative(message.created_at))}</time>
        ${message.mine ? `<span>· ${escapeHtml(message.read_by_other ? t('network.read') : t('network.delivered'))}</span>` : `<button type="button" class="linklike" data-report-message="${message.id}">${escapeHtml(t('report.short'))}</button>`}
      </span>
    </li>`).join('') || `<li class="small muted">${escapeHtml(t('network.noMessages'))}</li>`;
  body.querySelector('#older').hidden = state.done;
  for (const button of list.querySelectorAll('[data-report-message]')) button.addEventListener('click', () => openReportDialog('message', button.dataset.reportMessage));
  if (reset && (atBottom || !quiet)) list.scrollTop = list.scrollHeight;
}

function conversationMenu(meta, open, container, app) {
  const panel = openModal(meta.nickname || '—', `<div class="stack">
    <button type="button" class="btn" data-a="hide">${icon('trash', 15)} ${escapeHtml(t('network.deleteLocal'))}</button>
    <p class="card-note">${escapeHtml(t('network.deleteLocalNote'))}</p>
    <button type="button" class="btn" data-a="report">${icon('shield', 15)} ${escapeHtml(t('network.reportConversation'))}</button>
    ${meta.other_id ? `<button type="button" class="btn btn-danger" data-a="block">${icon('lock', 15)} ${escapeHtml(t('social.block'))}</button>` : ''}
  </div>`);
  panel.querySelector('[data-a="hide"]').addEventListener('click', async () => {
    closeLayer();
    try { await rpc('hide_conversation', { p_conversation: open.id }); state.open = null; renderNetwork(container, app); }
    catch (e) { toast(e.message, 'err'); }
  });
  panel.querySelector('[data-a="report"]').addEventListener('click', () => { closeLayer(); openReportDialog('conversation', open.id); });
  const block = panel.querySelector('[data-a="block"]');
  if (block) block.addEventListener('click', () => { closeLayer(); blockUser(meta.other_id, () => renderNetwork(container, app)); });
}

// ---------- siguria ----------
async function renderSafety(body, container, app) {
  const [{ data: blocks }, { data: mutes }] = await Promise.all([
    getClient().rpc('my_blocks'),
    getClient().from('mutes').select('muted_id, created_at')
  ]);
  const mutedIds = (mutes || []).map(row => row.muted_id);
  const { data: mutedProfiles } = mutedIds.length
    ? await getClient().from('public_profiles').select('user_id, nickname').in('user_id', mutedIds)
    : { data: [] };
  body.innerHTML = `
    <section class="card"><h2 class="card-title">${escapeHtml(t('network.blocked'))}</h2>
      <p class="small muted mt-2">${escapeHtml(t('network.blockedExplain'))}</p>
      ${(blocks || []).length ? blocks.map(row => `<div class="row-between list-row"><strong>${escapeHtml(row.nickname)}</strong>
        <button type="button" class="btn btn-sm" data-unblock="${row.user_id}">${escapeHtml(t('network.unblock'))}</button></div>`).join('')
      : `<p class="small muted mt-2">${escapeHtml(t('network.noneBlocked'))}</p>`}
    </section>
    <section class="card mt-4"><h2 class="card-title">${escapeHtml(t('network.mutedTitle'))}</h2>
      <p class="small muted mt-2">${escapeHtml(t('network.mutedExplain'))}</p>
      ${(mutes || []).length ? mutes.map(row => `<div class="row-between list-row"><strong>${escapeHtml((mutedProfiles || []).find(p => p.user_id === row.muted_id)?.nickname || '—')}</strong>
        <button type="button" class="btn btn-sm" data-unmute="${row.muted_id}">${escapeHtml(t('network.unmute'))}</button></div>`).join('')
      : `<p class="small muted mt-2">${escapeHtml(t('network.noneMuted'))}</p>`}
    </section>
    <section class="card mt-4"><h2 class="card-title">${escapeHtml(t('network.myReports'))}</h2>${await myReportsList()}</section>`;
  for (const button of body.querySelectorAll('[data-unblock]')) button.addEventListener('click', async () => {
    try { await rpc('unblock_user', { p_target: button.dataset.unblock }); renderNetwork(container, app); } catch (e) { toast(e.message, 'err'); }
  });
  for (const button of body.querySelectorAll('[data-unmute]')) button.addEventListener('click', async () => {
    await getClient().from('mutes').delete().match({ muter_id: currentUser().id, muted_id: button.dataset.unmute });
    renderNetwork(container, app);
  });
}

async function myReportsList() {
  const { data } = await getClient().from('reports').select('id, target_type, reason, status, created_at').order('created_at', { ascending: false }).limit(20);
  if (!data || !data.length) return `<p class="small muted mt-2">${escapeHtml(t('network.noReports'))}</p>`;
  return data.map(row => `<div class="row-between list-row"><span class="small">${escapeHtml(t(`report.types.${row.target_type}`))} · ${escapeHtml(t(`report.reasons.${row.reason}`))}</span>
    <span class="pill">${escapeHtml(t(`report.status.${row.status}`))}</span></div>`).join('');
}
