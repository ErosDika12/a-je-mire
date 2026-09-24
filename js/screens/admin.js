// Administrimi dhe moderimi. Çdo skedë shfaqet vetëm për rolin që e ka; serveri kontrollon sërish çdo veprim.
// Stafi NUK shfleton: check-ins, shënime, MY 5, kopje të dekriptuara, fjalëkalime sinkronizimi,
// mesazhe të paraportuara apo reflektime AI. Nuk ka asnjë rrugë në ndërfaqe apo në API për këto.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatDateTime } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, hasRole, myRoles, friendlyError, rpc } from '../cloud/session.js';
import { MODULES, loadServerFlags, snapshot } from '../flags.js';
import { withReauth, signInPrompt } from '../social.js';

const state = { tab: null };

function tabsFor() {
  const tabs = [];
  if (hasRole('moderator', 'admin', 'owner')) tabs.push('reports', 'sanctions');
  if (hasRole('admin', 'owner')) tabs.push('flags', 'pilot', 'roles', 'content', 'analytics', 'audit');
  if (hasRole('billing', 'admin', 'owner')) tabs.push('billing');
  return tabs;
}

export async function renderAdmin(container, app) {
  const user = await ensureSession();
  if (!user) { container.innerHTML = head() + signInPrompt(t('admin.signInNeeded')); return; }
  const tabs = tabsFor();
  if (!tabs.length) { container.innerHTML = head() + `<section class="card"><p class="muted">${escapeHtml(t('admin.noRole'))}</p></section>`; return; }
  if (!tabs.includes(state.tab)) state.tab = tabs[0];
  container.innerHTML = head() + `
    <p class="small muted">${escapeHtml(t('admin.roles', { roles: myRoles().join(', ') }))}</p>
    <div class="seg-control connect-tabs mt-3" role="group" aria-label="${escapeHtml(t('admin.title'))}">
      ${tabs.map(tab => `<button type="button" data-tab="${tab}" aria-pressed="${state.tab === tab}">${escapeHtml(t(`admin.tab_${tab}`))}</button>`).join('')}
    </div>
    <section class="card card-soft mt-3"><p class="small">${icon('shield', 14)} ${escapeHtml(t('admin.boundaries'))}</p></section>
    <div class="mt-4" id="admin-body"></div>`;
  for (const button of container.querySelectorAll('[data-tab]')) button.addEventListener('click', () => { state.tab = button.dataset.tab; renderAdmin(container, app); });
  const body = container.querySelector('#admin-body');
  const views = { reports, sanctions, flags, pilot, roles, content, analytics, audit, billing };
  try { await views[state.tab](body, () => renderAdmin(container, app)); }
  catch (error) { body.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; }
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${escapeHtml(t('admin.title'))}</h1>
    <p class="page-sub">${escapeHtml(t('admin.subtitle'))}</p>
  </header>`;
}

// ---------- raportet ----------
async function reports(body, refresh) {
  const data = await rpc('mod_list_reports', { p_status: 'open', p_limit: 50 });
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.openReports', { n: data.length }))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.reportsNote'))}</p>
    <ul class="stack mt-3">${data.map(row => `<li class="row-between list-row">
      <span class="small"><strong>${escapeHtml(t(`report.types.${row.target_type}`))}</strong> · ${escapeHtml(t(`report.reasons.${row.reason}`))}
        · ${escapeHtml(formatDateTime(row.created_at))}${row.same_target_open > 1 ? ` · ${escapeHtml(t('admin.sameTarget', { n: row.same_target_open }))}` : ''}</span>
      <button type="button" class="btn btn-sm" data-open-report="${row.id}">${escapeHtml(t('admin.open'))}</button></li>`).join('') || `<li class="small muted">${escapeHtml(t('admin.queueEmpty'))}</li>`}</ul></section>`;
  const openReport = withReauth(id => rpc('mod_open_report', { p_id: Number(id) }));
  for (const button of body.querySelectorAll('[data-open-report]')) button.addEventListener('click', async () => {
    let report;
    try { report = await openReport(button.dataset.openReport); } catch (error) { toast(error.message, 'err'); return; }
    const snap = report.snapshot || {};
    const panel = openModal(t('admin.reportTitle', { id: report.id }), `
      <p class="small muted">${escapeHtml(t('admin.auditedOpen'))}</p>
      <dl class="mt-3"><div class="data-row"><dt>${escapeHtml(t('admin.type'))}</dt><dd>${escapeHtml(t(`report.types.${report.target_type}`))}</dd></div>
        <div class="data-row"><dt>${escapeHtml(t('report.reason'))}</dt><dd>${escapeHtml(t(`report.reasons.${report.reason}`))}</dd></div>
        <div class="data-row"><dt>${escapeHtml(t('admin.author'))}</dt><dd>${escapeHtml(snap.nickname || '—')}</dd></div></dl>
      ${report.details ? `<p class="small mt-3"><strong>${escapeHtml(t('report.details'))}:</strong> <span id="report-details"></span></p>` : ''}
      <div class="card card-soft mt-3"><p class="post-body small" id="report-snapshot"></p></div>
      ${report.reason === 'safety_concern' ? `<p class="warn mt-3">${escapeHtml(t('admin.safetyGuidance'))}</p>` : ''}
      <div class="field mt-3"><label for="mod-note">${escapeHtml(t('admin.note'))}</label><input id="mod-note" maxlength="200"></div>
      <div class="row mt-4">
        <button type="button" class="btn btn-sm" data-act="dismiss">${escapeHtml(t('admin.dismiss'))}</button>
        ${['post', 'reply'].includes(report.target_type) ? `<button type="button" class="btn btn-sm" data-act="hide">${escapeHtml(t('admin.hide'))}</button>
          <button type="button" class="btn btn-sm btn-danger" data-act="remove">${escapeHtml(t('admin.remove'))}</button>
          <button type="button" class="btn btn-sm" data-act="restore">${escapeHtml(t('admin.restore'))}</button>` : ''}
        ${report.target_user_id ? `<button type="button" class="btn btn-sm btn-danger" data-act="suspend_community_7d">${escapeHtml(t('admin.suspendCommunity'))}</button>
          <button type="button" class="btn btn-sm btn-danger" data-act="suspend_messaging_7d">${escapeHtml(t('admin.suspendMessaging'))}</button>` : ''}
      </div>`);
    // Përmbajtja e raportuar vendoset si tekst, kurrë si HTML.
    panel.querySelector('#report-snapshot').textContent = snap.messages
      ? snap.messages.map(message => `${message.from === 'reporter' ? t('admin.reporter') : t('admin.other')}: ${message.body}`).join('\n')
      : snap.body || snap.bio || '';
    const details = panel.querySelector('#report-details');
    if (details) details.textContent = report.details;
    for (const action of panel.querySelectorAll('[data-act]')) action.addEventListener('click', async () => {
      try {
        await rpc('mod_resolve_report', { p_id: report.id, p_action: action.dataset.act, p_note: panel.querySelector('#mod-note').value });
        closeLayer(); toast(t('admin.resolved'), 'ok'); refresh();
      } catch (error) { toast(error.message, 'err'); }
    });
  });
}

async function sanctions(body, refresh) {
  const data = await rpc('mod_list_sanctions');
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_sanctions'))}</h2>
    <ul class="stack mt-3">${data.map(row => `<li class="row-between list-row"><span class="small"><strong>${escapeHtml(row.nickname || '—')}</strong>
      · ${escapeHtml(t(`admin.k_${row.kind}`))} · ${escapeHtml(t('admin.until', { date: formatDateTime(row.until) }))}${row.revoked_at ? ' · ' + escapeHtml(t('admin.revoked')) : ''}</span>
      ${row.revoked_at ? '' : `<button type="button" class="btn btn-sm" data-revoke-sanction="${row.id}">${escapeHtml(t('admin.revokeSanction'))}</button>`}</li>`).join('')
      || `<li class="small muted">${escapeHtml(t('admin.noSanctions'))}</li>`}</ul></section>`;
  for (const button of body.querySelectorAll('[data-revoke-sanction]')) button.addEventListener('click', async () => {
    try { await rpc('mod_revoke_sanction', { p_id: Number(button.dataset.revokeSanction) }); refresh(); } catch (error) { toast(error.message, 'err'); }
  });
}

// ---------- flamujt ----------
async function flags(body, refresh) {
  await loadServerFlags();
  const view = snapshot();
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_flags'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.flagsNote'))}</p>
    <div class="table-wrap mt-3"><table class="data-table"><caption class="sr-only">${escapeHtml(t('admin.tab_flags'))}</caption>
      <thead><tr><th scope="col">${escapeHtml(t('admin.module'))}</th><th scope="col">dev</th><th scope="col">preview</th><th scope="col">prod</th>
        <th scope="col">${escapeHtml(t('admin.server'))}</th><th scope="col">${escapeHtml(t('admin.pilotOnly'))}</th><th scope="col">${escapeHtml(t('admin.buildCeiling'))}</th><th scope="col"></th></tr></thead>
      <tbody>${MODULES.map(key => {
        const row = view[key].server || {};
        const box = (field) => `<td><input type="checkbox" data-flag="${key}" data-field="${field}" ${row[field] ? 'checked' : ''} aria-label="${escapeHtml(`${key} ${field}`)}"></td>`;
        return `<tr><th scope="row">${escapeHtml(t(`admin.m_${key}`))}</th>${box('enabled_development')}${box('enabled_preview')}${box('enabled_production')}${box('server_enabled')}${box('pilot_only')}
          <td>${escapeHtml(view[key].build ? t('admin.allowed') : t('admin.blocked'))}</td>
          <td><button type="button" class="btn btn-sm" data-save-flag="${key}">${escapeHtml(t('common.save'))}</button></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  const save = withReauth((key, values) => rpc('set_feature_flag', { p_key: key, ...values }));
  for (const button of body.querySelectorAll('[data-save-flag]')) button.addEventListener('click', async () => {
    const key = button.dataset.saveFlag;
    const read = field => body.querySelector(`[data-flag="${key}"][data-field="${field}"]`).checked;
    try {
      await save(key, { p_development: read('enabled_development'), p_preview: read('enabled_preview'), p_production: read('enabled_production'), p_server: read('server_enabled'), p_pilot_only: read('pilot_only') });
      toast(t('admin.flagSaved'), 'ok'); refresh();
    } catch (error) { toast(error.message, 'err'); }
  });
}

// ---------- pilot dhe rolet ----------
async function pilot(body, refresh) {
  const staff = await rpc('admin_list_staff');
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_pilot'))}</h2>
    <form class="row mt-3" id="pilot-form"><label class="sr-only" for="pilot-email">Email</label>
      <input id="pilot-email" type="email" required placeholder="email@example.com" style="flex:1;min-width:0" autocomplete="off">
      <button type="submit" class="btn btn-primary" data-grant="1">${escapeHtml(t('admin.grantPilot'))}</button>
      <button type="button" class="btn" id="pilot-revoke">${escapeHtml(t('admin.revokePilot'))}</button></form>
    <ul class="stack mt-4">${staff.filter(row => row.pilot).map(row => `<li class="small">${escapeHtml(row.nickname || '—')} · ${escapeHtml(row.email_masked)}</li>`).join('') || `<li class="small muted">${escapeHtml(t('admin.noPilot'))}</li>`}</ul></section>`;
  const input = body.querySelector('#pilot-email');
  body.querySelector('#pilot-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await rpc('set_pilot_access', { p_email: input.value.trim(), p_grant: true }); toast(t('admin.done'), 'ok'); refresh(); } catch (error) { toast(error.message, 'err'); }
  });
  body.querySelector('#pilot-revoke').addEventListener('click', async () => {
    try { await rpc('set_pilot_access', { p_email: input.value.trim(), p_grant: false }); toast(t('admin.done'), 'ok'); refresh(); } catch (error) { toast(error.message, 'err'); }
  });
}

async function roles(body, refresh) {
  const staff = await rpc('admin_list_staff');
  const grantable = hasRole('owner') ? ['admin', 'moderator', 'billing', 'mentor'] : ['moderator', 'billing', 'mentor'];
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_roles'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.rolesNote'))}</p>
    <form class="stack mt-3" id="role-form">
      <div class="grid grid-2"><div class="field"><label for="role-email">Email</label><input id="role-email" type="email" required autocomplete="off"></div>
      <div class="field"><label for="role-name">${escapeHtml(t('admin.role'))}</label><select id="role-name">${grantable.map(role => `<option value="${role}">${escapeHtml(role)}</option>`).join('')}</select></div></div>
      <div class="row"><button type="submit" class="btn btn-primary">${escapeHtml(t('admin.grantRole'))}</button><button type="button" class="btn" id="role-revoke">${escapeHtml(t('admin.revokeRole'))}</button></div>
    </form>
    <ul class="stack mt-4">${staff.filter(row => row.roles.length).map(row => `<li class="small">${escapeHtml(row.nickname || '—')} · ${escapeHtml(row.email_masked)} · ${escapeHtml(row.roles.join(', '))}</li>`).join('')}</ul></section>`;
  const setRole = withReauth((email, role, grant) => rpc('set_role', { p_email: email, p_role: role, p_grant: grant }));
  const run = async grant => {
    try { await setRole(body.querySelector('#role-email').value.trim(), body.querySelector('#role-name').value, grant); toast(t('admin.done'), 'ok'); refresh(); }
    catch (error) { toast(error.message, 'err'); }
  };
  body.querySelector('#role-form').addEventListener('submit', event => { event.preventDefault(); run(true); });
  body.querySelector('#role-revoke').addEventListener('click', () => run(false));
}

// ---------- përmbajtja ----------
async function content(body, refresh) {
  const { data } = await getClient().from('content_pages').select('*');
  const value = (key, lang) => (data || []).find(row => row.key === key && row.lang === lang) || { body: '', published: false };
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_content'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.contentNote'))}</p>
    ${['community_rules', 'help', 'announcement'].map(key => ['sq', 'en'].map(lang => `<form class="stack mt-4" data-content="${key}:${lang}">
      <label for="c-${key}-${lang}"><strong>${escapeHtml(t(`admin.c_${key}`))}</strong> · ${lang.toUpperCase()}</label>
      <textarea id="c-${key}-${lang}" rows="4" maxlength="8000">${escapeHtml(value(key, lang).body)}</textarea>
      <label class="check-row"><input type="checkbox" name="published" ${value(key, lang).published ? 'checked' : ''}><span>${escapeHtml(t('admin.published'))}</span></label>
      <button type="submit" class="btn btn-sm">${escapeHtml(t('common.save'))}</button></form>`).join('')).join('')}</section>`;
  for (const form of body.querySelectorAll('[data-content]')) form.addEventListener('submit', async event => {
    event.preventDefault();
    const [key, lang] = form.dataset.content.split(':');
    try { await rpc('update_content_page', { p_key: key, p_lang: lang, p_body: form.querySelector('textarea').value, p_published: form.querySelector('[name=published]').checked }); toast(t('admin.done'), 'ok'); }
    catch (error) { toast(error.message, 'err'); }
  });
}

async function analytics(body) {
  const data = await rpc('analytics_summary', { p_days: 30 });
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_analytics'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.analyticsNote'))}</p>
    <ul class="stack mt-3">${data.map(row => `<li class="row-between small"><span>${escapeHtml(row.name)} · ${escapeHtml(row.label)}</span><strong>${row.events}</strong></li>`).join('') || `<li class="small muted">${escapeHtml(t('admin.noEvents'))}</li>`}</ul></section>`;
}

async function audit(body) {
  const data = await rpc('admin_audit', { p_limit: 100 });
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_audit'))}</h2>
    <ul class="stack mt-3">${data.map(row => `<li class="small"><time datetime="${escapeHtml(row.created_at)}">${escapeHtml(formatDateTime(row.created_at))}</time>
      · <strong>${escapeHtml(row.actor_nickname || '—')}</strong> · ${escapeHtml(row.action)} · ${escapeHtml(row.target_type || '')} ${escapeHtml(row.target_id || '')}</li>`).join('') || `<li class="small muted">${escapeHtml(t('admin.noAudit'))}</li>`}</ul></section>`;
}

async function billing(body) {
  const data = await rpc('billing_list_subscriptions', { p_limit: 100 });
  body.innerHTML = `<section class="card"><h2 class="card-title">${escapeHtml(t('admin.tab_billing'))}</h2>
    <p class="small muted mt-2">${escapeHtml(t('admin.billingNote'))}</p>
    <ul class="stack mt-3">${data.map(row => `<li class="small">${escapeHtml(row.user_id.slice(0, 8))}… · ${escapeHtml(row.status)} · ${escapeHtml(row.price_key || '—')} · ${escapeHtml(formatDateTime(row.current_period_end, false))}${row.cancel_at_period_end ? ' · ' + escapeHtml(t('plus.endsOn')) : ''}</li>`).join('') || `<li class="small muted">${escapeHtml(t('admin.noSubscriptions'))}</li>`}</ul></section>`;
}
