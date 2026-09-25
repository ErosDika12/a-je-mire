// Focus Space: një detyrë aktive, kohëmatës 15/25/45 ose sipas dëshirës, pushim, shënime shpërqendrimi.
// Koha llogaritet nga orari i fillimit (focus.js), prandaj rikuperohet pas rifreskimit.
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml, formatDateLong } from '../format.js';
import { t } from '../i18n/index.js';
import { DURATIONS, OUTCOMES, startSession, startBreak, pause, resume, remainingMs, formatClock, finishSession } from '../focus.js';
import { FRICTION, recordFriction, frictionSummary } from '../life.js';
import { helpMeStart } from '../coach.js';

let draft = { task: '', mode: 'homework', minutes: 25 };
let lastOutcome = null;
let timer = null;
let announcedRecovery = false;

export function renderFocus(container, app) {
  clearInterval(timer);
  const profile = app.profile;
  profile.focus = profile.focus || { active: null, sessions: [] };
  if (app.pendingFocusTask) { draft.task = app.pendingFocusTask; app.pendingFocusTask = null; }
  const active = profile.focus.active;
  const stored = profile.consent && profile.consent.store === true;

  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('focus.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('focus.title')}</h1>
      <p class="page-sub">${t('focus.subtitle')}</p>
      ${stored ? '' : `<p class="card-note">${t('focus.noConsent')}</p>`}
    </header>
    ${active ? runningView(active) : lastOutcome ? afterView() : setupView()}
    ${historyView(profile)}
    ${frictionView(profile)}`;

  wire(container, app);
  if (active) {
    if (!announcedRecovery && active.startedAt < Date.now() - 3000) { toast(t('focus.recovered')); }
    announcedRecovery = true;
    tick(container, app);
    timer = setInterval(() => tick(container, app), 1000);
  }
}

function setupView() {
  const custom = !DURATIONS.includes(draft.minutes);
  return `<section class="card focus-setup" aria-labelledby="focus-setup">
    <h2 id="focus-setup" class="sr-only">${t('focus.start')}</h2>
    <p class="card-sub">${t('focus.mode')}</p>
    <div class="seg-control mt-2" role="group" aria-label="${escapeHtml(t('focus.mode'))}">
      ${['homework', 'exam'].map(m => `<button type="button" data-mode="${m}" aria-pressed="${draft.mode === m}">${t(`focus.${m}`)}</button>`).join('')}
    </div>
    <label class="field mt-4" for="focus-task"><span class="card-title">${t('focus.task')}</span>
      <input id="focus-task" type="text" maxlength="120" value="${escapeHtml(draft.task)}" placeholder="${escapeHtml(t('focus.taskPlaceholder'))}"></label>
    <button type="button" class="btn-link mt-2" data-help-start>${icon('spark', 14)} ${t('focus.helpStart')}</button>
    <p class="card-sub mt-4">${t('focus.minutes')}</p>
    <div class="seg-control mt-2" role="group" aria-label="${escapeHtml(t('focus.minutes'))}">
      ${DURATIONS.map(n => `<button type="button" data-minutes="${n}" aria-pressed="${draft.minutes === n}">${t('focus.minShort', { n })}</button>`).join('')}
      <button type="button" data-minutes="custom" aria-pressed="${custom}">${t('focus.custom')}</button>
    </div>
    ${custom ? `<label class="field mt-3" for="focus-custom"><span class="card-sub">${t('focus.customMin')}</span>
      <input id="focus-custom" type="number" inputmode="numeric" min="1" max="180" value="${draft.minutes}"></label>` : ''}
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-start>${icon('play', 16)} ${t('focus.start')}</button>
      <button type="button" class="btn" data-break>${t('focus.breakStart')}</button>
    </div>
  </section>`;
}

function runningView(active) {
  const isBreak = active.phase === 'break';
  const status = isBreak ? t('focus.onBreak') : active.pausedAt ? t('focus.paused') : t('focus.focusing');
  return `<section class="card focus-run ${isBreak ? 'is-break' : ''}" aria-labelledby="focus-status">
    <div class="focus-ring-wrap">
      <svg class="focus-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="focus-ring-bg"></circle>
        <circle cx="60" cy="60" r="52" class="focus-ring-fg" data-ring stroke-dasharray="326.7" stroke-dashoffset="0"></circle>
      </svg>
      <div class="focus-clock">
        <span class="sr-only">${t('focus.timeLeft')}</span>
        <strong data-clock role="timer" aria-live="off">--:--</strong>
        <span id="focus-status" class="card-sub">${status}</span>
      </div>
    </div>
    ${isBreak ? '' : `<p class="focus-task">${escapeHtml(active.task || t('focus.taskPlaceholder'))}</p>`}
    <div class="mira-actions focus-controls">
      ${isBreak ? `<button type="button" class="btn btn-primary" data-break-end>${t('focus.breakEnd')}</button>`
        : `${active.pausedAt ? `<button type="button" class="btn btn-primary" data-resume>${t('focus.resume')}</button>` : `<button type="button" class="btn" data-pause>${t('focus.pause')}</button>`}
           <button type="button" class="btn" data-stop>${t('focus.stop')}</button>`}
    </div>
    ${isBreak ? '' : `<form class="mt-4" data-distract>
      <label class="field" for="distract-text"><span class="card-sub">${t('focus.distraction')}</span>
        <span class="field-hint">${t('focus.distractionHint')}</span>
        <span class="mira-inline"><input id="distract-text" type="text" maxlength="100"><button type="submit" class="btn btn-sm">${t('focus.distractionAdd')}</button></span></label>
      ${active.distractions.length ? `<p class="card-sub mt-3">${t('focus.distractions')}</p><ul class="mira-read">${active.distractions.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
    </form>`}
  </section>`;
}

function afterView() {
  return `<section class="card card-lav" aria-labelledby="focus-after">
    <h2 id="focus-after" class="card-title">${t('focus.afterQ')}</h2>
    <p class="mira-voice mt-2" role="status">${t(`focus.after.${lastOutcome}`)}</p>
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-break>${t('focus.breakStart')}</button>
      <button type="button" class="btn" data-again>${t('focus.start')}</button>
    </div>
  </section>`;
}

function historyView(profile) {
  const sessions = (profile.focus.sessions || []).slice(-8).reverse();
  return `<section class="card" aria-labelledby="focus-hist"><h2 id="focus-hist" class="card-title">${t('focus.history')}</h2>
    ${sessions.length ? `<ul class="mira-hist">${sessions.map(s => `<li class="mira-hist-row">
      <div><strong>${escapeHtml(s.task || t(`focus.${s.mode}`))}</strong><span class="card-sub">${escapeHtml(formatDateLong(s.date))} · ${t('focus.minShort', { n: s.actualMin })}</span></div>
      <span class="pill ${s.outcome === 'completed' ? 'pill-accent' : 'pill-lav'}">${t(`focus.o.${s.outcome}`)}</span></li>`).join('')}</ul>`
      : `<p class="card-sub mt-2">${t('focus.historyEmpty')}</p>`}</section>`;
}

function frictionView(profile) {
  const summary = frictionSummary(profile, 7);
  return `<section class="card card-amber" aria-labelledby="fric-title">
    <h2 id="fric-title" class="card-title">${t('focus.fricTitle')}</h2>
    <p class="card-sub">${t('focus.fricIntro')}</p>
    ${summary.rows.length ? `<ul class="fric-list">${summary.rows.map(row => `<li><span class="fric-bar" style="--w:${Math.round(row.count / summary.total * 100)}%"></span>${escapeHtml(row.text)}</li>`).join('')}</ul>
      <p class="card-note">${t('focus.fricNote')}</p>` : `<p class="card-sub mt-3">${t('focus.fricEmpty')}</p>`}
  </section>`;
}

function tick(root, app) {
  const active = app.profile.focus && app.profile.focus.active;
  const clock = root.querySelector('[data-clock]');
  if (!active || !clock || !root.isConnected) { clearInterval(timer); return; }
  const left = remainingMs(active);
  clock.textContent = formatClock(left);
  const ring = root.querySelector('[data-ring]');
  if (ring) ring.setAttribute('stroke-dashoffset', String(326.7 * (1 - left / (active.minutes * 60000))));
  if (left <= 0) {
    clearInterval(timer);
    if (active.phase === 'break') { app.profile.focus.active = null; app.save(); renderFocus(root, app); return; }
    askOutcome(root, app);
  }
}

// Pas seancës: katër përgjigje, asnjëra e gabuar. "Më vonë" dhe "u ndal" mund të shënojnë arsye (opsionale).
function askOutcome(root, app) {
  if (document.querySelector('.modal [data-outcome]')) return;
  const modal = openModal(t('focus.afterQ'), `
    <div class="mira-choices">${OUTCOMES.map(o => `<button type="button" class="mira-choice" data-outcome="${o}">${t(`focus.o.${o}`)}</button>`).join('')}</div>
    <div class="focus-reasons" hidden>
      <p class="card-sub mt-4">${t('today.fricQ')}</p>
      <div class="tag-wrap mt-2">${FRICTION.map(r => `<button type="button" class="tag tag-sm" data-reason="${r}" aria-pressed="false">${t(`fric.r.${r}`)}</button>`).join('')}</div>
      <button type="button" class="btn btn-primary mt-3" data-reasons-save>${t('common.save')}</button>
    </div>`);
  const host = modal;
  const chosen = new Set();
  let picked = null;
  const done = () => {
    const task = app.profile.focus.active && app.profile.focus.active.task;
    finishSession(app.profile, picked, app.today);
    if ((picked === 'later' || picked === 'stopped') && chosen.size) recordFriction(app.profile, { date: app.today, task, reasons: [...chosen], source: 'focus' });
    lastOutcome = picked;
    app.save();
    closeLayer();
    renderFocus(root, app);
  };
  host.querySelectorAll('[data-outcome]').forEach(button => button.addEventListener('click', () => {
    picked = button.dataset.outcome;
    if (picked === 'later' || picked === 'stopped') {
      host.querySelectorAll('[data-outcome]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      host.querySelector('.focus-reasons').hidden = false;
    } else done();
  }));
  host.querySelectorAll('[data-reason]').forEach(button => button.addEventListener('click', () => {
    const r = button.dataset.reason;
    if (chosen.has(r)) chosen.delete(r); else chosen.add(r);
    button.setAttribute('aria-pressed', String(chosen.has(r)));
  }));
  const save = host.querySelector('[data-reasons-save]');
  if (save) save.addEventListener('click', done);
}

function wire(root, app) {
  const profile = app.profile;
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', () => fn(el)));
  const rerender = () => renderFocus(root, app);
  const taskInput = root.querySelector('#focus-task');
  if (taskInput) taskInput.addEventListener('input', () => { draft.task = taskInput.value; });
  const customInput = root.querySelector('#focus-custom');
  if (customInput) customInput.addEventListener('change', () => { draft.minutes = Math.max(1, Math.min(180, Number(customInput.value) || 25)); });

  on('[data-mode]', el => { draft.mode = el.dataset.mode; rerender(); });
  on('[data-minutes]', el => { draft.minutes = el.dataset.minutes === 'custom' ? 30 : Number(el.dataset.minutes); rerender(); });
  on('[data-start]', () => { startSession(profile, draft); lastOutcome = null; announcedRecovery = true; app.save(); rerender(); });
  on('[data-again]', () => { lastOutcome = null; rerender(); });
  on('[data-break]', () => { startBreak(profile); lastOutcome = null; announcedRecovery = true; app.save(); rerender(); });
  on('[data-break-end]', () => { profile.focus.active = null; app.save(); rerender(); });
  on('[data-pause]', () => { pause(profile.focus.active); app.save(); rerender(); });
  on('[data-resume]', () => { resume(profile.focus.active); app.save(); rerender(); });
  on('[data-stop]', () => { pause(profile.focus.active); app.save(); askOutcome(root, app); });
  on('[data-help-start]', () => {
    const text = (taskInput && taskInput.value.trim()) || draft.task;
    if (!text) { toast(t('coach.startEmpty')); return; }
    const help = helpMeStart(text);
    openModal(t('coach.startTitle'), `<p class="card-sub">${t('coach.startFirst')}</p><p class="mira-voice">${escapeHtml(help.first)}</p>
      <p class="card-sub mt-4">${t('coach.startNext')}</p><ol class="mira-read">${help.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`);
  });
  const form = root.querySelector('[data-distract]');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (!value) return;
    profile.focus.active.distractions = [...profile.focus.active.distractions, value.slice(0, 100)].slice(0, 10);
    app.save();
    rerender();
    const next = root.querySelector('#distract-text');
    if (next) next.focus();
  });
}

