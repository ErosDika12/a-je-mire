// "Sot" (v3): katër gjëra të vogla — një ndjenjë, një gjë, një person, një pauzë.
// Asgjë nuk është e detyrueshme dhe asgjë nuk ndëshkohet. Mesazhet vetëm kopjohen.
import { icon, toast, copyText, openSheet, closeLayer } from '../ui.js';
import { escapeHtml, formatWeekday, formatDateLong } from '../format.js';
import { t } from '../i18n/index.js';
import { tagLabel } from '../patterns.js';
import { FEELINGS } from '../mira.js';
import { PAUSES, FRICTION, dayOf, peekDay, moveThing, lastContact } from '../life.js';

let draftFeeling = { word: '', strength: 2 };

export function renderDashboard(container, app) {
  const profile = app.profile;
  const day = peekDay(profile, app.today);
  const checked = profile.checkins.some(entry => entry.date === app.today);
  const stored = profile.consent && profile.consent.store === true;

  container.innerHTML = `
    <header class="panel texture today-head">
      <span class="eyebrow">${t('today.eyebrow')} · ${escapeHtml(formatWeekday(app.today))}</span>
      <h1 class="page-title mt-2">${t('today.title')}</h1>
      <p class="page-sub">${t('today.subtitle')}</p>
      <div class="today-status mt-4">
        <span class="pill ${checked ? 'pill-accent' : 'pill-amber'}"><span class="pill-dot"></span>${checked ? t('today.checkinDone') : t('today.checkinTodo')}</span>
        ${checked ? '' : `<button type="button" class="btn btn-sm" data-go="checkin">${icon('check', 14)} ${t('today.checkin')}</button>`}
      </div>
      ${stored ? '' : `<p class="card-note">${t('today.noConsent')}</p>`}
    </header>

    <div class="today-grid mt-4">
      <section class="card today-card today-feel" aria-labelledby="feel-title">${feelingCard(day)}</section>
      <section class="card today-card today-thing" aria-labelledby="thing-title">${thingCard(day)}</section>
      <section class="card today-card today-person" aria-labelledby="person-title">${personCard(day, profile)}</section>
      <section class="card today-card today-pause" aria-labelledby="pause-title">${pauseCard(day)}</section>
    </div>

    <section class="card today-mira mt-4" aria-labelledby="today-mira">
      <span class="mira-orb mira-orb-sm" aria-hidden="true"></span>
      <div>
        <h2 id="today-mira" class="card-title">${t('today.miraTitle')}</h2>
        <p class="card-sub">${t('today.miraText')}</p>
      </div>
      <button type="button" class="btn btn-primary" data-go="mira">${t('today.miraBtn')}</button>
    </section>

    <div class="today-links mt-4">
      <button type="button" class="btn-link" data-go="week">${icon('calendar', 15)} ${t('today.weekLink')}</button>
      <button type="button" class="btn-link" data-go="constellation">${icon('star', 15)} ${t('today.starsLink')}</button>
      <button type="button" class="btn-link" data-go="normal">${icon('normal', 15)} ${t('today.insights')}</button>
    </div>`;

  wire(container, app);
}

// ---------- Një ndjenjë ----------
function feelingCard(day) {
  const head = `<h2 id="feel-title" class="today-label">${icon('heart', 16)} ${t('today.feelTitle')}</h2>`;
  if (day.feeling) {
    return `${head}<p class="today-big">${escapeHtml(t('today.feelSet', { word: day.feeling.word }))}</p>
      <p class="card-sub">${t('today.strength')} ${strengthDots(day.feeling.strength)} ${t(`today.s${day.feeling.strength}`)}</p>
      <button type="button" class="btn btn-sm mt-3" data-feel-change>${t('today.change')}</button>`;
  }
  return `${head}<p class="today-q">${t('today.feelQ')}</p>
    <div class="tag-wrap mt-3" role="group" aria-label="${escapeHtml(t('today.feelQ'))}">
      ${FEELINGS.map(id => { const word = t(`mira.feel.${id}`); return `<button type="button" class="tag tag-sm" data-feel="${escapeHtml(word)}" aria-pressed="${draftFeeling.word === word}">${escapeHtml(word)}</button>`; }).join('')}
    </div>
    <label class="sr-only" for="feel-own">${t('today.feelOwn')}</label>
    <input id="feel-own" class="mt-3" type="text" maxlength="40" placeholder="${escapeHtml(t('today.feelOwn'))}">
    <p class="card-sub mt-3">${t('today.strength')}</p>
    <div class="seg-control mt-2" role="group" aria-label="${escapeHtml(t('today.strength'))}">
      ${[1, 2, 3].map(n => `<button type="button" data-strength="${n}" aria-pressed="${draftFeeling.strength === n}">${t(`today.s${n}`)}</button>`).join('')}
    </div>
    <button type="button" class="btn btn-primary btn-sm mt-3" data-feel-save>${t('today.feelSave')}</button>`;
}

function strengthDots(n) {
  return `<span class="dots" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

// ---------- Një gjë ----------
function thingCard(day) {
  const head = `<h2 id="thing-title" class="today-label">${icon('check', 16)} ${t('today.thingTitle')}</h2>`;
  const thing = day.thing;
  if (!thing) {
    return `${head}<p class="today-q">${t('today.thingQ')}</p>
      <form class="mira-inline mt-3" data-thing-form>
        <label class="sr-only" for="thing-text">${t('today.thingQ')}</label>
        <input id="thing-text" type="text" maxlength="120" placeholder="${escapeHtml(t('today.thingPlaceholder'))}">
        <button type="submit" class="btn btn-primary">${t('today.thingSet')}</button>
      </form>`;
  }
  if (thing.movedTo) {
    return `${head}<p class="today-big muted">${escapeHtml(thing.text)}</p>
      <p class="card-sub">${escapeHtml(t('today.movedTo', { date: formatDateLong(thing.movedTo) }))}</p>`;
  }
  const steps = thing.steps.map((step, i) => `
    <li><label class="today-step"><input type="checkbox" data-step="${i}" ${step.done ? 'checked' : ''}> <span>${escapeHtml(step.text)}</span></label></li>`).join('');
  return `${head}
    <p class="today-big ${thing.done ? 'is-done' : ''}">${escapeHtml(thing.text)}</p>
    ${thing.movedFrom ? `<p class="card-sub">${escapeHtml(t('today.movedFrom', { date: formatDateLong(thing.movedFrom) }))}</p>` : ''}
    ${steps ? `<ul class="today-steps">${steps}</ul>` : ''}
    ${thing.steps.length < 3 && !thing.done ? `<form class="mira-inline mt-2" data-step-form>
      <label class="sr-only" for="step-text">${t('today.stepAdd')}</label>
      <input id="step-text" type="text" maxlength="80" placeholder="${escapeHtml(t('today.stepPlaceholder'))}">
      <button type="submit" class="btn btn-sm">${t('today.stepAdd')}</button></form>` : ''}
    ${thing.done ? `<p class="card-sub mt-2">${t('today.doneNote')}</p>` : ''}
    <div class="mira-actions">
      ${thing.done ? '' : `<button type="button" class="btn btn-primary btn-sm" data-thing-focus>${icon('play', 14)} ${t('today.focus')}</button>`}
      <button type="button" class="btn btn-sm" data-thing-done>${thing.done ? t('today.undone') : t('today.done')}</button>
      ${thing.done ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-thing-move>${t('today.move')}</button>`}
      <button type="button" class="btn btn-ghost btn-sm" data-thing-remove>${t('today.remove')}</button>
    </div>`;
}

// ---------- Një person ----------
function personCard(day, profile) {
  const head = `<h2 id="person-title" class="today-label">${icon('users', 16)} ${t('today.personTitle')}</h2>`;
  const person = day.person;
  const names = (profile.my5 || []).map(p => p.name);
  if (person && person.notToday) {
    return `${head}<p class="today-big">${t('today.notTodaySet')}</p><button type="button" class="btn btn-sm mt-3" data-person-undo>${t('today.undo')}</button>`;
  }
  if (!person || !person.name) {
    return `${head}<p class="today-q">${t('today.personQ')}</p>
      ${names.length ? `<div class="tag-wrap mt-3" role="group" aria-label="${escapeHtml(t('today.personPick'))}">
        ${names.map(n => `<button type="button" class="tag tag-sm" data-person="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>` : ''}
      <form class="mira-inline mt-3" data-person-form>
        <label class="sr-only" for="person-other">${t('today.personOther')}</label>
        <input id="person-other" type="text" maxlength="40" placeholder="${escapeHtml(t('today.personOther'))}">
        <button type="submit" class="btn btn-sm">${t('today.thingSet')}</button>
      </form>
      <button type="button" class="btn btn-ghost btn-sm mt-3" data-person-not>${t('today.notToday')}</button>`;
  }
  const info = (profile.my5 || []).find(p => p.name === person.name);
  const activity = tagLabel((info && info.sharedActivity) || 'kafe').toLowerCase();
  const last = lastContact(profile, person.name);
  const draftText = person.draft || t('today.draftDefault', { name: person.name, activity });
  return `${head}
    <p class="today-big">${escapeHtml(person.name)}</p>
    <p class="card-sub">${last ? escapeHtml(t('today.last', { date: formatDateLong(last) })) : t('today.lastNone')}</p>
    <p class="card-sub">${escapeHtml(t('today.activity', { activity }))}</p>
    <label class="field mt-3" for="person-draft"><span class="card-sub">${t('today.draftLabel')}</span>
      <textarea id="person-draft" maxlength="400">${escapeHtml(draftText)}</textarea></label>
    <div class="mira-actions">
      <button type="button" class="btn btn-primary btn-sm" data-person-copy>${icon('copy', 14)} ${t('today.copy')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-person-clear>${t('today.change')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-person-not>${t('today.notToday')}</button>
    </div>`;
}

// ---------- Një pauzë ----------
function pauseCard(day) {
  const head = `<h2 id="pause-title" class="today-label">${icon('leaf', 16)} ${t('today.pauseTitle')}</h2>`;
  const pause = day.pause;
  if (pause) {
    const label = pause.id === 'custom' ? pause.custom : t(`today.p.${pause.id}`);
    return `${head}<p class="today-big ${pause.done ? 'is-done' : ''}">${escapeHtml(label)}</p>
      ${pause.done ? `<p class="card-sub">${t('today.pauseDoneNote')}</p>` : ''}
      <div class="mira-actions">
        ${pause.done ? '' : `<button type="button" class="btn btn-primary btn-sm" data-pause-done>${t('today.pauseDone')}</button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-pause-clear>${t('today.change')}</button>
      </div>`;
  }
  return `${head}<p class="today-q">${t('today.pauseQ')}</p>
    <div class="tag-wrap mt-3" role="group" aria-label="${escapeHtml(t('today.pauseQ'))}">
      ${PAUSES.map(id => `<button type="button" class="tag tag-sm" data-pause="${id}">${t(`today.p.${id}`)}</button>`).join('')}
    </div>
    <form class="mira-inline mt-3" data-pause-form>
      <label class="sr-only" for="pause-own">${t('today.pauseCustom')}</label>
      <input id="pause-own" type="text" maxlength="80" placeholder="${escapeHtml(t('today.pauseCustom'))}">
      <button type="submit" class="btn btn-sm">${t('today.thingSet')}</button>
    </form>`;
}

// ---------- ngjarjet ----------
function wire(root, app) {
  const profile = app.profile;
  const day = () => dayOf(profile, app.today);
  const commit = () => { app.save(); renderDashboard(root, app); };
  const on = (selector, fn) => root.querySelectorAll(selector).forEach(el => el.addEventListener('click', () => fn(el)));
  const submit = (selector, fn) => root.querySelectorAll(selector).forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const value = form.querySelector('input').value.trim();
    if (value) fn(value);
  }));

  on('[data-feel]', el => {
    draftFeeling.word = el.dataset.feel;
    root.querySelectorAll('[data-feel]').forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  });
  on('[data-strength]', el => {
    draftFeeling.strength = Number(el.dataset.strength);
    root.querySelectorAll('[data-strength]').forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  });
  on('[data-feel-save]', () => {
    const own = root.querySelector('#feel-own').value.trim();
    const word = own || draftFeeling.word;
    if (!word) return;
    day().feeling = { word: word.slice(0, 40), strength: draftFeeling.strength };
    draftFeeling = { word: '', strength: 2 };
    commit();
  });
  on('[data-feel-change]', () => { day().feeling = null; commit(); });

  submit('[data-thing-form]', value => { day().thing = { text: value.slice(0, 120), steps: [], done: false, movedFrom: null }; commit(); });
  submit('[data-step-form]', value => { if (day().thing.steps.length < 3) day().thing.steps.push({ text: value.slice(0, 80), done: false }); commit(); });
  root.querySelectorAll('[data-step]').forEach(box => box.addEventListener('change', () => {
    day().thing.steps[Number(box.dataset.step)].done = box.checked; commit();
  }));
  on('[data-thing-done]', () => { day().thing.done = !day().thing.done; commit(); });
  on('[data-thing-remove]', () => { day().thing = null; commit(); });
  on('[data-thing-focus]', () => { app.pendingFocusTask = day().thing.text; app.goTo('focus'); });
  on('[data-thing-move]', () => openMoveSheet(app, () => renderDashboard(root, app)));

  on('[data-person]', el => { day().person = { name: el.dataset.person, notToday: false, draft: '' }; commit(); });
  submit('[data-person-form]', value => { day().person = { name: value.slice(0, 40), notToday: false, draft: '' }; commit(); });
  on('[data-person-not]', () => { day().person = { name: '', notToday: true, draft: '' }; commit(); });
  on('[data-person-undo]', () => { day().person = null; commit(); });
  on('[data-person-clear]', () => { day().person = null; commit(); });
  const draftBox = root.querySelector('#person-draft');
  if (draftBox) draftBox.addEventListener('change', () => { day().person.draft = draftBox.value.slice(0, 400); app.save(); });
  on('[data-person-copy]', async () => { await copyText(draftBox.value); toast(t('today.copied'), 'success'); });

  on('[data-pause]', el => { day().pause = { id: el.dataset.pause, custom: '', done: false }; commit(); });
  submit('[data-pause-form]', value => { day().pause = { id: 'custom', custom: value.slice(0, 80), done: false }; commit(); });
  on('[data-pause-done]', () => { day().pause.done = true; commit(); });
  on('[data-pause-clear]', () => { day().pause = null; commit(); });
}

// "Kaloje në një ditë tjetër" me arsye opsionale (Friction Map). Asnjë ndëshkim.
function openMoveSheet(app, done) {
  const chosen = new Set();
  const panel = openSheet(t('today.move'), `
    <p class="card-sub">${t('today.fricQ')}</p>
    <div class="tag-wrap mt-3">${FRICTION.map(r => `<button type="button" class="tag tag-sm" data-reason="${r}" aria-pressed="false">${t(`fric.r.${r}`)}</button>`).join('')}</div>
    <div class="mira-actions">
      <button type="button" class="btn btn-primary" data-move-save>${t('today.fricSave')}</button>
      <button type="button" class="btn btn-ghost" data-move-skip>${t('today.fricSkip')}</button>
    </div>`);
  panel.querySelectorAll('[data-reason]').forEach(button => button.addEventListener('click', () => {
    const r = button.dataset.reason;
    if (chosen.has(r)) chosen.delete(r); else chosen.add(r);
    button.setAttribute('aria-pressed', String(chosen.has(r)));
  }));
  const finish = reasons => {
    const target = moveThing(app.profile, app.today, reasons);
    app.save();
    closeLayer();
    if (target) toast(t('today.moved', { date: formatDateLong(target) }));
    done();
  };
  panel.querySelector('[data-move-save]').addEventListener('click', () => finish([...chosen]));
  panel.querySelector('[data-move-skip]').addEventListener('click', () => finish([]));
}
