// Mënyrat e tjera të MIRA-s. Të gjitha lokale; asnjëra nuk ruan biseda pa u kërkuar.
import { icon, toast } from '../ui.js';
import { escapeHtml, fmtNum } from '../format.js';
import { t } from '../i18n/index.js';
import { helpMeStart, talkReply } from '../coach.js';
import { coachHtml, wireCoach } from '../coach-ui.js';
import { FEELINGS } from '../mira.js';
import { PAUSES, dayOf } from '../life.js';
import { METRIC_LABELS, MIN_DAYS, normalReport, activityRanking, tagLabel } from '../patterns.js';

export const MODES = ['path', 'talk', 'start', 'plan', 'coach', 'patterns', 'story'];

const talk = { turns: [] };
let startResult = null;

export function modeTabs(current) {
  return `<nav class="mira-modes" aria-label="${escapeHtml(t('mmode.label'))}">
    ${MODES.map(m => `<button type="button" class="mira-mode" data-mode="${m}" aria-pressed="${m === current}">${t(`mmode.m.${m}`)}</button>`).join('')}
  </nav>`;
}

export function renderModeBody(mode, app) {
  if (mode === 'talk') return talkView();
  if (mode === 'start') return startView();
  if (mode === 'plan') return planView(app);
  if (mode === 'coach') return `<section class="card"><h2 class="card-title">${t('mmode.m.coach')}</h2><p class="card-sub">${t('mmode.coachIntro')}</p>
    ${coachHtml({ people: (app.profile.my5 || []).map(p => p.name) })}</section>`;
  if (mode === 'patterns') return patternsView(app);
  if (mode === 'story') return `<section class="card card-lav"><h2 class="card-title">${t('mmode.m.story')}</h2>
    <p class="mira-voice">${t('mmode.storyIntro')}</p>
    <button type="button" class="btn btn-primary mt-4" data-go="week">${icon('calendar', 16)} ${t('mmode.storyBtn')}</button></section>`;
  return '';
}

// ---------- Talk It Through ----------
function talkView() {
  const bubbles = talk.turns.map(turn => `
    <div class="bubble bubble-me">${escapeHtml(turn.text)}</div>
    <div class="bubble bubble-mira"><span class="sr-only">MIRA:</span>${escapeHtml(turn.reply.echo)} ${escapeHtml(turn.reply.question)}</div>`).join('');
  return `<section class="card" aria-labelledby="talk-title">
    <h2 id="talk-title" class="card-title">${t('mmode.m.talk')}</h2>
    <p class="card-sub">${t('coach.talk.intro')}</p>
    <div class="talk-log mt-4" aria-live="polite">
      <div class="bubble bubble-mira">${t('mmode.talkOpen')}</div>
      ${bubbles}
    </div>
    <form class="mt-4" data-talk-form>
      <label class="sr-only" for="talk-text">${t('coach.talk.placeholder')}</label>
      <textarea id="talk-text" maxlength="800" placeholder="${escapeHtml(t('coach.talk.placeholder'))}"></textarea>
      <div class="mira-actions">
        <button type="submit" class="btn btn-primary">${t('coach.talk.send')}</button>
        ${talk.turns.length ? `<button type="button" class="btn" data-talk-path>${t('coach.talk.toPath')}</button>
        <button type="button" class="btn btn-ghost" data-talk-stop>${t('coach.talk.stop')}</button>` : ''}
      </div>
    </form>
  </section>`;
}

// ---------- Help Me Start ----------
function startView() {
  return `<section class="card" aria-labelledby="start-title">
    <h2 id="start-title" class="card-title">${t('coach.startTitle')}</h2>
    <p class="card-sub">${t('coach.startIntro')}</p>
    <form class="mira-inline mt-4" data-start-form>
      <label class="sr-only" for="start-text">${t('coach.startTitle')}</label>
      <input id="start-text" type="text" maxlength="120" placeholder="${escapeHtml(t('coach.startPlaceholder'))}" value="${escapeHtml(startResult ? startResult.task : '')}">
      <button type="submit" class="btn btn-primary">${t('coach.startBtn')}</button>
    </form>
    ${startResult ? `<div class="start-result mt-4" role="status">
      <p class="card-sub">${t('coach.startFirst')}</p>
      <p class="start-first">${escapeHtml(startResult.first)}</p>
      <p class="card-sub mt-4">${t('coach.startNext')}</p>
      <ol class="mira-read">${startResult.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      <button type="button" class="btn btn-primary mt-3" data-start-focus>${icon('play', 14)} ${t('coach.startFocus')}</button>
    </div>` : ''}
  </section>`;
}

// ---------- Plan My Day ----------
function planView(app) {
  const day = (app.profile.days && app.profile.days[app.today]) || {};
  const names = (app.profile.my5 || []).map(p => p.name);
  return `<section class="card" aria-labelledby="plan-title">
    <h2 id="plan-title" class="card-title">${t('mmode.m.plan')}</h2>
    <p class="card-sub">${t('mmode.planIntro')}</p>
    <form class="plan-day mt-4" data-plan-form>
      <label class="field"><span class="card-title">${t('today.feelTitle')}</span>
        <input name="feeling" list="plan-feelings" maxlength="40" value="${escapeHtml(day.feeling ? day.feeling.word : '')}" placeholder="${escapeHtml(t('today.feelQ'))}">
        <datalist id="plan-feelings">${FEELINGS.map(id => `<option value="${escapeHtml(t(`mira.feel.${id}`))}">`).join('')}</datalist></label>
      <label class="field"><span class="card-title">${t('today.thingTitle')}</span>
        <input name="thing" maxlength="120" value="${escapeHtml(day.thing ? day.thing.text : '')}" placeholder="${escapeHtml(t('today.thingPlaceholder'))}"></label>
      <label class="field"><span class="card-title">${t('today.personTitle')}</span>
        <input name="person" list="plan-people" maxlength="40" value="${escapeHtml(day.person ? day.person.name : '')}" placeholder="${escapeHtml(t('today.personOther'))}">
        <datalist id="plan-people">${names.map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist></label>
      <label class="field"><span class="card-title">${t('today.pauseTitle')}</span>
        <select name="pause"><option value="">—</option>${PAUSES.map(p => `<option value="${p}" ${day.pause && day.pause.id === p ? 'selected' : ''}>${t(`today.p.${p}`)}</option>`).join('')}</select></label>
      <div class="mira-actions"><button type="submit" class="btn btn-primary">${t('mmode.planSave')}</button></div>
    </form>
  </section>`;
}

// ---------- Understand My Patterns ----------
// Tregon gjithmonë: çfarë të dhënash u përdorën, sa ditë, dhe që lidhja nuk është shkak.
function patternsView(app) {
  const checkins = app.profile.checkins;
  const head = `<h2 class="card-title">${t('mmode.m.patterns')}</h2>`;
  if (checkins.length < MIN_DAYS.patterns) {
    return `<section class="card">${head}<p class="mira-voice">${t('mmode.patNotEnough', { n: MIN_DAYS.patterns, have: checkins.length })}</p>
      <button type="button" class="btn mt-3" data-go="checkin">${t('nav.checkin')}</button></section>`;
  }
  const report = normalReport(checkins, app.profile.settings).filter(f => f.flagged);
  const ranking = activityRanking(checkins).slice(0, 2);
  const lines = [
    ...report.slice(0, 3).map(f => t('mmode.patChange', { metric: METRIC_LABELS[f.metric].toLowerCase(), base: fmtNum(f.base), recent: fmtNum(f.recent) })),
    ...ranking.map(r => t('mmode.patActivity', { activity: tagLabel(r.tag), with: fmtNum(r.withMean), without: fmtNum(r.withoutMean), days: r.daysWith }))
  ];
  return `<section class="card" aria-labelledby="pat-title">
    <h2 id="pat-title" class="card-title">${t('mmode.m.patterns')}</h2>
    <div class="pat-used mt-3">
      <p><strong>${t('mmode.patUsed')}</strong> ${t('mmode.patUsedText')}</p>
      <p><strong>${t('mmode.patDays')}</strong> ${t('mmode.patDaysText', { n: checkins.length, base: app.profile.settings.baselineDays, recent: app.profile.settings.recentDays })}</p>
    </div>
    ${lines.length ? `<ul class="pat-lines mt-4">${lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : `<p class="mira-voice mt-4">${t('mmode.patNone')}</p>`}
    <p class="card-note">${t('mmode.patNotCause')}</p>
    <p class="card-note">${t('mmode.patNotDiagnosis')}</p>
    <button type="button" class="btn-link mt-3" data-go="why">${t('mmode.patMore')} ${icon('next', 14)}</button>
  </section>`;
}

export function wireMode(mode, root, app, rerender, setMode) {
  wireCoach(root);
  const talkForm = root.querySelector('[data-talk-form]');
  if (talkForm) {
    talkForm.addEventListener('submit', event => {
      event.preventDefault();
      const text = talkForm.querySelector('textarea').value.trim();
      talk.turns.push({ text, reply: talkReply(talk.turns.length, text) });
      rerender();
      const next = root.querySelector('#talk-text');
      if (next) next.focus();
    });
    const toPath = root.querySelector('[data-talk-path]');
    if (toPath) toPath.addEventListener('click', () => {
      const text = talk.turns.map(turn => turn.text).filter(Boolean).join(' ');
      talk.turns = [];
      setMode('path', text);
    });
    const stop = root.querySelector('[data-talk-stop]');
    if (stop) stop.addEventListener('click', () => { talk.turns = []; toast(t('coach.talk.stopped')); rerender(); });
  }
  const startForm = root.querySelector('[data-start-form]');
  if (startForm) {
    startForm.addEventListener('submit', event => {
      event.preventDefault();
      const task = startForm.querySelector('input').value.trim();
      if (!task) { toast(t('coach.startEmpty')); return; }
      startResult = { task, ...helpMeStart(task) };
      rerender();
    });
    const focus = root.querySelector('[data-start-focus]');
    if (focus) focus.addEventListener('click', () => { app.pendingFocusTask = startResult.task; app.goTo('focus'); });
  }
  const planForm = root.querySelector('[data-plan-form]');
  if (planForm) planForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(planForm);
    const day = dayOf(app.profile, app.today);
    const feeling = String(data.get('feeling') || '').trim();
    const thing = String(data.get('thing') || '').trim();
    const person = String(data.get('person') || '').trim();
    const pause = String(data.get('pause') || '');
    if (feeling) day.feeling = { word: feeling.slice(0, 40), strength: day.feeling ? day.feeling.strength : 2 };
    if (thing && (!day.thing || day.thing.text !== thing)) day.thing = { text: thing.slice(0, 120), steps: [], done: false, movedFrom: null };
    if (person) day.person = { name: person.slice(0, 40), notToday: false, draft: '' };
    if (pause) day.pause = { id: pause, custom: '', done: false };
    app.save();
    toast(t('mmode.planSaved'), 'success');
    app.goTo('dashboard');
  });
}
