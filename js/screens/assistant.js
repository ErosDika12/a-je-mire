// Asistenti opsional i reflektimit. Nuk punon vetë, nuk lexon gjithçka, nuk diagnostikon.
// Para çdo kërkese: të dhënat e sakta, pa identitet, pa shënime (përveç nëse i zgjedh), konfirmim,
// ofruesi dhe politika e tij e mbajtjes, dhe një alternativë pa AI.
import { icon, toast } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, getLang } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { ensureSession, friendlyError } from '../cloud/session.js';
import { METRICS, normalReport, shiftDate } from '../patterns.js';
import { weeklyReflection } from '../compose.js';
import { signInPrompt } from '../social.js';
import { recordConsent } from '../storage.js';
import { sanitizeRequest } from '../../supabase/functions/_shared/ai-guard.js';

const PURPOSES = ['explain_chart', 'explain_calculation', 'reflection_questions', 'summarize', 'draft_message', 'organize_notes'];
const state = { purpose: 'summarize', metrics: new Set(METRICS), includeSeries: false, includeNotes: false, removedNotes: new Set(), answer: null, busy: false };

function buildRequest(app) {
  const report = normalReport(app.profile.checkins, app.profile.settings);
  const request = { purpose: state.purpose, lang: getLang(), metrics: {} };
  for (const factor of report) {
    if (!state.metrics.has(factor.metric)) continue;
    request.metrics[factor.metric] = { normal: factor.base ?? undefined, recent: factor.recent ?? undefined, change_pct: factor.pct ?? undefined };
  }
  if (state.includeSeries) {
    request.series = {};
    for (const metric of state.metrics) request.series[metric] = app.profile.checkins.slice(-14).map(entry => entry[metric]);
  }
  if (state.purpose === 'explain_calculation') request.calculation = 'something_changed';
  if (state.purpose === 'draft_message') request.draft = { tone: 'warm' };
  if (state.includeNotes) {
    const since = shiftDate(app.today, -6);
    request.notes = app.profile.checkins.filter(entry => entry.date >= since && entry.note && !state.removedNotes.has(entry.date)).map(entry => entry.note);
  }
  // I njëjti pastrues si në server: parapamja tregon saktësisht atë që do të largohet.
  const clean = sanitizeRequest(request);
  return clean.ok ? clean.value : null;
}

export async function renderAssistant(container, app) {
  const user = await ensureSession();
  const request = buildRequest(app);
  const since = shiftDate(app.today, -6);
  const recentNotes = app.profile.checkins.filter(entry => entry.date >= since && entry.note);

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">${escapeHtml(t('ai.title'))}</h1>
      <p class="page-sub">${escapeHtml(t('ai.subtitle'))}</p>
    </header>
    <section class="card card-soft"><ul class="facts">
      <li class="fact fact-no"><span class="fact-ic">${icon('close', 14)}</span><span>${escapeHtml(t('ai.never'))}</span></li>
      <li class="fact"><span class="fact-ic">${icon('info', 14)}</span><span>${escapeHtml(t('ai.notSupport'))}</span></li>
    </ul></section>
    ${user ? '' : `<div class="mt-4">${signInPrompt(t('ai.signInNeeded'))}</div>`}
    <section class="card mt-4">
      <div class="field"><label for="ai-purpose">${escapeHtml(t('ai.purpose'))}</label>
        <select id="ai-purpose">${PURPOSES.map(key => `<option value="${key}" ${state.purpose === key ? 'selected' : ''}>${escapeHtml(t(`ai.p_${key}`))}</option>`).join('')}</select></div>
      <fieldset class="stack mt-4"><legend class="small">${escapeHtml(t('ai.dataPick'))}</legend>
        <div class="tone-wrap">${METRICS.map(metric => `<button type="button" class="tag" data-metric="${metric}" aria-pressed="${state.metrics.has(metric)}">${escapeHtml(t(`metrics.${metric}`))}</button>`).join('')}</div>
        <label class="check-row"><input type="checkbox" id="ai-series" ${state.includeSeries ? 'checked' : ''}><span>${escapeHtml(t('ai.includeSeries'))}</span></label>
        <label class="check-row"><input type="checkbox" id="ai-notes" ${state.includeNotes ? 'checked' : ''}><span>${escapeHtml(t('ai.includeNotes'))}</span></label>
        ${state.includeNotes ? `<ul class="stack">${recentNotes.map(entry => `<li class="row-between small"><span>${escapeHtml(entry.date)}: ${escapeHtml(entry.note)}</span>
          <button type="button" class="btn btn-sm" data-note="${entry.date}">${escapeHtml(state.removedNotes.has(entry.date) ? t('ai.addBack') : t('ai.remove'))}</button></li>`).join('') || `<li class="small muted">${escapeHtml(t('ai.noNotes'))}</li>`}</ul>` : ''}
        <p class="card-note">${escapeHtml(t('ai.my5Never'))}</p>
      </fieldset>
    </section>
    <section class="card mt-4">
      <h2 class="card-title">${escapeHtml(t('ai.previewTitle'))}</h2>
      <p class="small muted mt-2">${escapeHtml(t('ai.previewIntro'))}</p>
      <pre class="json mt-3" id="ai-preview" tabindex="0" aria-label="${escapeHtml(t('ai.previewTitle'))}"></pre>
      <p class="small mt-3">${icon('cloud', 14)} ${escapeHtml(t('ai.provider'))}</p>
      <p class="small muted">${escapeHtml(t('ai.retention'))}</p>
      <label class="check-row mt-3"><input type="checkbox" id="ai-confirm"><span>${escapeHtml(t('ai.confirm'))}</span></label>
      <div class="row mt-4">
        <button type="button" class="btn btn-primary" id="ai-send" disabled ${user ? '' : 'hidden'}>${icon('spark', 16)} ${escapeHtml(t('ai.send'))}</button>
        <button type="button" class="btn" id="ai-local">${icon('edit', 16)} ${escapeHtml(t('ai.localAlternative'))}</button>
      </div>
      <div id="ai-status" class="mt-3" role="status" aria-live="polite"></div>
    </section>
    <section class="card mt-4" id="ai-answer" ${state.answer ? '' : 'hidden'}></section>`;

  // textContent: parapamja nuk interpretohet kurrë si HTML.
  container.querySelector('#ai-preview').textContent = request ? JSON.stringify(request, null, 2) : t('ai.invalid');
  if (state.answer) drawAnswer(container, app, state.answer);

  const rerender = () => renderAssistant(container, app);
  container.querySelector('#ai-purpose').addEventListener('change', event => { state.purpose = event.target.value; rerender(); });
  for (const button of container.querySelectorAll('[data-metric]')) button.addEventListener('click', () => {
    const metric = button.dataset.metric;
    if (state.metrics.has(metric)) state.metrics.delete(metric); else state.metrics.add(metric);
    rerender();
  });
  container.querySelector('#ai-series').addEventListener('change', event => { state.includeSeries = event.target.checked; rerender(); });
  container.querySelector('#ai-notes').addEventListener('change', event => { state.includeNotes = event.target.checked; rerender(); });
  for (const button of container.querySelectorAll('[data-note]')) button.addEventListener('click', () => {
    const date = button.dataset.note;
    if (state.removedNotes.has(date)) state.removedNotes.delete(date); else state.removedNotes.add(date);
    rerender();
  });
  const confirm = container.querySelector('#ai-confirm');
  const send = container.querySelector('#ai-send');
  confirm.addEventListener('change', () => { send.disabled = !confirm.checked || !request; });
  send.addEventListener('click', () => ask(container, app, request));
  container.querySelector('#ai-local').addEventListener('click', () => {
    // Alternativa pa AI: reflektimi lokal nga template, krejt në pajisje.
    const reflection = weeklyReflection(app.profile);
    const text = !reflection.enough
      ? t('ai.localEmpty')
      : [reflection.moved.length
          ? t('ai.localMoved', { list: reflection.moved.map(item => `${item.label} ${item.down ? '↓' : '↑'}${item.pct}%`).join(', ') })
          : t('ai.localStable'),
        reflection.question, reflection.step].join('\n\n');
    state.answer = { text, local: true };
    drawAnswer(container, app, state.answer);
  });
}

async function ask(container, app, request) {
  if (state.busy || !request) return;
  state.busy = true;
  const status = container.querySelector('#ai-status');
  status.innerHTML = `<p class="status">${icon('refresh', 14)} ${escapeHtml(t('ai.waiting'))}</p>`;
  recordConsent(app.profile, 'ai_assistant', true);
  app.save();
  const { data, error } = await getClient().functions.invoke('ai-reflect', { body: request });
  state.busy = false;
  if (error || !data || data.error) {
    let code = data && data.error;
    if (!code && error && error.context && typeof error.context.json === 'function') code = (await error.context.json().catch(() => ({}))).error;
    status.innerHTML = `<p class="warn">${escapeHtml(code ? friendlyError({ message: code }) : t('errors.generic'))}</p>`;
    return;
  }
  status.innerHTML = `<p class="small muted">${escapeHtml(t('ai.remaining', { n: data.remaining }))}</p>`;
  state.answer = { text: data.text, local: false };
  drawAnswer(container, app, state.answer);
}

// Përgjigja nuk ruhet vetë: vetëm nëse përdoruesi shtyp "Ruaje".
function drawAnswer(container, app, answer) {
  const box = container.querySelector('#ai-answer');
  box.hidden = false;
  box.innerHTML = `<h2 class="card-title">${escapeHtml(answer.local ? t('ai.localTitle') : t('ai.answerTitle'))}</h2>
    <p class="post-body mt-3" id="ai-text"></p>
    <p class="card-note">${escapeHtml(t('ai.answerNote'))}</p>
    <div class="row mt-3"><button type="button" class="btn" id="ai-save">${icon('download', 15)} ${escapeHtml(t('ai.save'))}</button>
      <button type="button" class="btn" id="ai-discard">${escapeHtml(t('ai.discard'))}</button></div>`;
  box.querySelector('#ai-text').textContent = answer.text;
  box.querySelector('#ai-save').addEventListener('click', () => {
    app.profile.savedReflections = [...(app.profile.savedReflections || []), { date: app.today, text: answer.text.slice(0, 2500), local: answer.local }].slice(-50);
    app.save();
    toast(t('ai.saved'), 'ok');
  });
  box.querySelector('#ai-discard').addEventListener('click', () => { state.answer = null; box.hidden = true; });
}

