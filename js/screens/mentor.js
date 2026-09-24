// Ndarja me një mentor, mësues, këshilltar ose trajner — granulare, me afat, e revokueshme menjëherë.
// Para çdo ndarjeje shfaqet saktësisht çfarë do të shohë mentori.
import { icon, toast, openModal, closeLayer, copyText } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatDateTime, formatNumber } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, friendlyError, rpc } from '../cloud/session.js';
import { METRICS, shiftDate } from '../patterns.js';
import { SHAREABLE, buildDayEntries, buildWeekEntry, grantStatus } from '../mentor.js';
import { signInPrompt } from '../social.js';
import { recordConsent } from '../storage.js';

export async function renderMentor(container, app) {
  container.innerHTML = head() + `<section class="card"><p class="status">${icon('refresh', 14)} ${escapeHtml(t('common.loading'))}</p></section>`;
  const user = await ensureSession();
  if (!user) { container.innerHTML = head() + signInPrompt(t('mentor.signInNeeded')); return; }
  const { data: grants, error } = await getClient().from('sharing_grants').select('*').order('created_at', { ascending: false });
  if (error) { container.innerHTML = head() + `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  const mine = grants.filter(grant => grant.owner_id === user.id);
  const shared = grants.filter(grant => grant.mentor_id === user.id);
  container.innerHTML = head() + `
    <section class="card">
      <div class="row-between"><h2 class="card-title">${escapeHtml(t('mentor.myShares'))}</h2>
        <button type="button" class="btn btn-sm btn-primary" id="new-grant">${icon('plus', 15)} ${escapeHtml(t('mentor.new'))}</button></div>
      <p class="small muted mt-2">${escapeHtml(t('mentor.neverShared'))}</p>
      <div class="stack mt-4">${mine.length ? mine.map(grantCard).join('') : `<p class="small muted">${escapeHtml(t('mentor.noShares'))}</p>`}</div>
    </section>
    <section class="card mt-4">
      <h2 class="card-title">${escapeHtml(t('mentor.asMentor'))}</h2>
      <form class="row mt-3" id="accept-form">
        <label class="sr-only" for="invite-code">${escapeHtml(t('mentor.code'))}</label>
        <input id="invite-code" required minlength="6" maxlength="16" autocomplete="off" placeholder="${escapeHtml(t('mentor.codePlaceholder'))}" style="flex:1;min-width:0;text-transform:uppercase">
        <button type="submit" class="btn">${escapeHtml(t('mentor.accept'))}</button>
      </form>
      <div class="stack mt-4">${shared.length ? shared.map(mentorCard).join('') : `<p class="small muted">${escapeHtml(t('mentor.noneWithMe'))}</p>`}</div>
    </section>`;
  wire(container, app, mine, shared);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('mentor.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('mentor.subtitle'))}</p>
  </header>`;
}

function statusPill(grant) {
  const status = grantStatus(grant);
  return `<span class="pill ${status === 'active' ? 'pill-accent' : ''}">${escapeHtml(t(`mentor.status_${status}`))}</span>`;
}

function categoriesText(categories) {
  return categories.map(key => t(key === 'weekly_summary' ? 'mentor.weeklySummary' : key === 'activities' ? 'mentor.activities' : `metrics.${key}`)).join(', ');
}

function grantCard(grant) {
  const status = grantStatus(grant);
  return `<article class="challenge" data-grant="${grant.id}">
    <div class="row-between"><strong>${escapeHtml(grant.mentor_label)}</strong>${statusPill(grant)}</div>
    <p class="small muted">${escapeHtml(categoriesText(grant.categories))}</p>
    <p class="small muted">${escapeHtml(t('mentor.rangeText', { start: grant.range_start, end: grant.range_end || t('mentor.ongoing') }))}${grant.include_future ? ' · ' + escapeHtml(t('mentor.futureIncluded')) : ''}</p>
    <p class="small muted">${escapeHtml(t('mentor.expires', { date: formatDateTime(grant.expires_at) }))}</p>
    <div class="row mt-3">
      <button type="button" class="btn btn-sm" data-log="${grant.id}">${escapeHtml(t('mentor.history'))}</button>
      <button type="button" class="btn btn-sm" data-summary="${grant.id}">${icon('download', 14)} ${escapeHtml(t('mentor.downloadSummary'))}</button>
      ${status === 'active' || status === 'pending' ? `<button type="button" class="btn btn-sm btn-danger" data-revoke="${grant.id}">${escapeHtml(t('mentor.revoke'))}</button>` : ''}
    </div>
  </article>`;
}

function mentorCard(grant) {
  const status = grantStatus(grant);
  return `<article class="challenge">
    <div class="row-between"><strong>${escapeHtml(grant.owner_label || t('mentor.aStudent'))}</strong>${statusPill(grant)}</div>
    <p class="small muted">${escapeHtml(categoriesText(grant.categories))} · ${escapeHtml(t('mentor.expires', { date: formatDateTime(grant.expires_at) }))}</p>
    <div class="row mt-3">
      ${status === 'active' ? `<button type="button" class="btn btn-sm btn-primary" data-view="${grant.id}">${escapeHtml(t('mentor.view'))}</button>
        <button type="button" class="btn btn-sm" data-mdownload="${grant.id}">${icon('download', 14)} ${escapeHtml(t('mentor.download'))}</button>
        <button type="button" class="btn btn-sm" data-revoke="${grant.id}">${escapeHtml(t('mentor.endAccess'))}</button>` : `<span class="small muted">${escapeHtml(t('mentor.noAccess'))}</span>`}
    </div>
  </article>`;
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wire(container, app, mine, shared) {
  const refresh = () => renderMentor(container, app);
  container.querySelector('#new-grant').addEventListener('click', () => openCreate(app, refresh));
  container.querySelector('#accept-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await rpc('accept_sharing_grant', { p_code: container.querySelector('#invite-code').value.trim() }); toast(t('mentor.accepted'), 'ok'); refresh(); }
    catch (error) { toast(error.message, 'err'); }
  });
  for (const button of container.querySelectorAll('[data-revoke]')) button.addEventListener('click', async () => {
    try { await rpc('revoke_sharing_grant', { p_id: button.dataset.revoke }); toast(t('mentor.revoked'), 'ok'); refresh(); }
    catch (error) { toast(error.message, 'err'); }
  });
  for (const button of container.querySelectorAll('[data-log]')) button.addEventListener('click', async () => {
    const { data } = await getClient().from('sharing_access_log').select('action, created_at').eq('grant_id', button.dataset.log).order('created_at', { ascending: false }).limit(100);
    openModal(t('mentor.history'), `<ul class="changelog">${(data || []).map(row => `<li>${escapeHtml(t(`mentor.log_${row.action}`))} · ${escapeHtml(formatDateTime(row.created_at))}</li>`).join('') || `<li>${escapeHtml(t('mentor.noHistory'))}</li>`}</ul>`);
  });
  for (const button of container.querySelectorAll('[data-summary]')) button.addEventListener('click', async () => {
    const grant = mine.find(item => item.id === button.dataset.summary);
    const [{ data: log }, { data: entries }] = await Promise.all([
      getClient().from('sharing_access_log').select('action, created_at').eq('grant_id', grant.id),
      getClient().from('shared_entries').select('kind, entry_date, payload').eq('grant_id', grant.id)
    ]);
    download(`ndarja-${grant.mentor_label.replace(/\W+/g, '-')}.json`, {
      mentor: grant.mentor_label, categories: grant.categories, range_start: grant.range_start, range_end: grant.range_end,
      include_future: grant.include_future, expires_at: grant.expires_at, status: grantStatus(grant), shared_entries: entries || [], access_history: log || []
    });
  });
  for (const button of container.querySelectorAll('[data-view]')) button.addEventListener('click', () => openMentorView(button.dataset.view, false));
  for (const button of container.querySelectorAll('[data-mdownload]')) button.addEventListener('click', () => openMentorView(button.dataset.mdownload, true));
}

async function openMentorView(id, asDownload) {
  let data;
  try { data = await rpc('mentor_view_grant', { p_id: id, p_download: asDownload }); } catch (error) { toast(error.message, 'err'); return; }
  if (data.error) { toast(t('errors.grant_inactive'), 'err'); return; }
  if (asDownload) { download('permbledhja-e-ndarjes.json', data); return; }
  const days = data.entries.filter(entry => entry.kind === 'day');
  const weeks = data.entries.filter(entry => entry.kind === 'week');
  const columns = data.categories.filter(key => METRICS.includes(key));
  openModal(data.owner_label || t('mentor.aStudent'), `
    <p class="small muted">${escapeHtml(t('mentor.viewNote'))}</p>
    ${days.length ? `<div class="table-wrap mt-3"><table class="data-table"><caption class="sr-only">${escapeHtml(t('mentor.tableCaption'))}</caption>
      <thead><tr><th scope="col">${escapeHtml(t('mentor.date'))}</th>${columns.map(key => `<th scope="col">${escapeHtml(t(`metrics.${key}`))}</th>`).join('')}${data.categories.includes('activities') ? `<th scope="col">${escapeHtml(t('mentor.activities'))}</th>` : ''}</tr></thead>
      <tbody>${days.map(entry => `<tr><th scope="row">${escapeHtml(entry.date)}</th>${columns.map(key => `<td>${escapeHtml(formatNumber(entry.values[key], 1))}</td>`).join('')}
        ${data.categories.includes('activities') ? `<td>${escapeHtml((entry.values.activities || []).join(', '))}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : `<p class="small muted mt-3">${escapeHtml(t('mentor.noEntries'))}</p>`}
    ${weeks.length ? `<h3 class="card-title mt-4">${escapeHtml(t('mentor.weeklySummary'))}</h3>${weeks.map(week => `<p class="small">${escapeHtml(week.date)}: ${(week.values.changes || []).map(change => escapeHtml(`${t(`metrics.${change.metric}`)} ${change.pct > 0 ? '+' : ''}${change.pct}%`)).join(' · ')}</p>`).join('')}` : ''}
    <p class="card-note">${escapeHtml(t('mentor.notDiagnosis'))}</p>`);
}

function openCreate(app, refresh) {
  const today = app.today;
  const panel = openModal(t('mentor.new'), `
    <form class="stack" data-grant-form>
      <div class="field"><label for="g-mentor">${escapeHtml(t('mentor.whom'))}</label><input id="g-mentor" required maxlength="40" placeholder="${escapeHtml(t('mentor.whomPlaceholder'))}"></div>
      <div class="field"><label for="g-owner">${escapeHtml(t('mentor.ownerLabel'))} <span class="field-hint">${escapeHtml(t('social.optional'))}</span></label><input id="g-owner" maxlength="40"></div>
      <fieldset class="stack"><legend class="small">${escapeHtml(t('mentor.categories'))}</legend>
        ${SHAREABLE.map(key => `<label class="check-row"><input type="checkbox" name="cat" value="${key}">
          <span>${escapeHtml(t(key === 'weekly_summary' ? 'mentor.weeklySummary' : key === 'activities' ? 'mentor.activities' : `metrics.${key}`))}</span></label>`).join('')}
        <p class="card-note">${escapeHtml(t('mentor.notesNever'))}</p>
      </fieldset>
      <div class="grid grid-2">
        <div class="field"><label for="g-from">${escapeHtml(t('mentor.from'))}</label><input id="g-from" type="date" value="${shiftDate(today, -13)}" required></div>
        <div class="field"><label for="g-to">${escapeHtml(t('mentor.to'))}</label><input id="g-to" type="date" value="${today}"></div>
      </div>
      <label class="check-row"><input type="checkbox" id="g-future"><span>${escapeHtml(t('mentor.includeFuture'))}</span></label>
      <div class="field"><label for="g-duration">${escapeHtml(t('mentor.duration'))}</label>
        <select id="g-duration">${[7, 30, 90].map(days => `<option value="${days}" ${days === 30 ? 'selected' : ''}>${escapeHtml(t('mentor.days', { n: days }))}</option>`).join('')}</select></div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(t('mentor.preview'))}</button>
      </div>
    </form>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-grant-form]').addEventListener('submit', event => {
    event.preventDefault();
    const categories = [...panel.querySelectorAll('[name=cat]:checked')].map(box => box.value);
    if (!categories.length) { toast(t('mentor.pickCategory'), 'err'); return; }
    const future = panel.querySelector('#g-future').checked;
    const draft = {
      mentor_label: panel.querySelector('#g-mentor').value.trim(), owner_label: panel.querySelector('#g-owner').value.trim(),
      categories, range_start: panel.querySelector('#g-from').value, range_end: future ? (panel.querySelector('#g-to').value || null) : panel.querySelector('#g-to').value,
      include_future: future, days: Number(panel.querySelector('#g-duration').value)
    };
    if (!draft.include_future && !draft.range_end) { toast(t('mentor.pickEnd'), 'err'); return; }
    closeLayer();
    openPreview(app, draft, refresh);
  });
}

// Parapamja: tabela e saktë e rreshtave që do të dërgohen, para se të krijohet qasja.
function openPreview(app, draft, refresh) {
  const rows = buildDayEntries(app.profile, draft);
  const week = draft.categories.includes('weekly_summary') ? buildWeekEntry(app.profile, app.today) : null;
  const columns = draft.categories.filter(key => METRICS.includes(key));
  const panel = openModal(t('mentor.previewTitle'), `
    <p class="small">${escapeHtml(t('mentor.previewIntro', { name: draft.mentor_label }))}</p>
    <div class="table-wrap mt-3"><table class="data-table"><caption class="sr-only">${escapeHtml(t('mentor.tableCaption'))}</caption>
      <thead><tr><th scope="col">${escapeHtml(t('mentor.date'))}</th>${columns.map(key => `<th scope="col">${escapeHtml(t(`metrics.${key}`))}</th>`).join('')}${draft.categories.includes('activities') ? `<th scope="col">${escapeHtml(t('mentor.activities'))}</th>` : ''}</tr></thead>
      <tbody>${rows.map(row => `<tr><th scope="row">${escapeHtml(row.entry_date)}</th>${columns.map(key => `<td>${escapeHtml(formatNumber(row.payload[key], 1))}</td>`).join('')}
        ${draft.categories.includes('activities') ? `<td>${escapeHtml((row.payload.activities || []).join(', '))}</td>` : ''}</tr>`).join('') || `<tr><td>${escapeHtml(t('mentor.noEntries'))}</td></tr>`}</tbody></table></div>
    ${week ? `<p class="small mt-3"><strong>${escapeHtml(t('mentor.weeklySummary'))}:</strong> ${week.payload.changes.map(change => escapeHtml(`${t(`metrics.${change.metric}`)} ${change.pct > 0 ? '+' : ''}${change.pct}%`)).join(' · ')}</p>` : ''}
    <ul class="facts mt-3">
      <li class="fact fact-no"><span class="fact-ic">${icon('close', 14)}</span><span>${escapeHtml(t('mentor.neverShared'))}</span></li>
      <li class="fact"><span class="fact-ic">${icon('info', 14)}</span><span>${escapeHtml(draft.include_future ? t('mentor.futureExplain') : t('mentor.noFutureExplain'))}</span></li>
      <li class="fact"><span class="fact-ic">${icon('lock', 14)}</span><span>${escapeHtml(t('mentor.revokeExplain', { n: draft.days }))}</span></li>
    </ul>
    <div class="row mt-4" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
      <button type="button" class="btn btn-primary" data-confirm>${escapeHtml(t('mentor.confirmShare'))}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', async () => {
    closeLayer();
    await getClient().from('share_decisions').insert({ user_id: (await getClient().auth.getUser()).data.user.id, context: 'mentor_grant', decision: 'cancelled', fields: draft.categories });
  });
  panel.querySelector('[data-confirm]').addEventListener('click', async () => {
    try {
      const expires = new Date(Date.now() + draft.days * 86400000).toISOString();
      const created = await rpc('create_sharing_grant', {
        p_mentor_label: draft.mentor_label, p_owner_label: draft.owner_label, p_categories: draft.categories,
        p_range_start: draft.range_start, p_range_end: draft.range_end || null, p_include_future: draft.include_future, p_expires_at: expires
      });
      const upload = [...rows, ...(week ? [week] : [])].map(row => ({ grant_id: created.id, ...row }));
      if (upload.length) {
        const { error } = await getClient().from('shared_entries').upsert(upload, { onConflict: 'grant_id,kind,entry_date' });
        if (error) throw new Error(friendlyError(error));
      }
      recordConsent(app.profile, 'mentor_sharing', true);
      app.save();
      closeLayer();
      showCode(created.code);
      refresh();
    } catch (error) {
      toast(error.message, 'err');
    }
  });
}

function showCode(code) {
  const panel = openModal(t('mentor.codeTitle'), `
    <p class="small">${escapeHtml(t('mentor.codeIntro'))}</p>
    <p class="invite-code" aria-label="${escapeHtml(t('mentor.code'))}">${escapeHtml(code)}</p>
    <p class="card-note">${escapeHtml(t('mentor.codeNote'))}</p>
    <button type="button" class="btn btn-primary" data-copy>${icon('copy', 15)} ${escapeHtml(t('mentor.copyCode'))}</button>`);
  panel.querySelector('[data-copy]').addEventListener('click', async () => {
    const done = await copyText(code);
    toast(done ? t('mentor.copied') : t('errors.generic'), done ? 'ok' : 'err');
  });
}

// Pas çdo check-in-i: nëse një ndarje aktive përfshin të ardhmen, dita e re dërgohet vetëm me kategoritë e lejuara.
export async function syncFutureShares(app) {
  const user = await ensureSession();
  if (!user) return;
  const { data: grants } = await getClient().from('sharing_grants').select('*').eq('owner_id', user.id).eq('include_future', true).is('revoked_at', null);
  for (const grant of grants || []) {
    if (grantStatus(grant) !== 'active' && grantStatus(grant) !== 'pending') continue;
    const rows = buildDayEntries(app.profile, { ...grant, range_start: grant.created_at.slice(0, 10), range_end: null });
    if (rows.length) await getClient().from('shared_entries').upsert(rows.map(row => ({ grant_id: grant.id, ...row })), { onConflict: 'grant_id,kind,entry_date' });
  }
}
