// Sfidat private (në pajisje) dhe sfidat me miqtë (opsionale, në server).
// Pjesëmarrja është gjithmonë opsionale; arritjet mund të fshihen; festimi respekton "reduced motion".
import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml } from '../format.js';
import { t, formatDateTime } from '../i18n/index.js';
import { getClient } from '../cloud/client.js';
import { currentUser, friendlyError, ensureSession } from '../cloud/session.js';
import { serverEnabled } from '../flags.js';
import { TEMPLATES, challengeProgress, newChallenge, achievements } from '../challenges.js';

export async function renderChallenges(container, app) {
  const profile = app.profile;
  profile.challenges = profile.challenges || [];
  const celebrate = [];
  // Përfundimi shënohet një herë, që festimi të mos përsëritet.
  for (const challenge of profile.challenges) {
    const progress = challengeProgress(challenge, profile);
    if (progress.done && !challenge.completedAt) { challenge.completedAt = new Date().toISOString(); celebrate.push(challenge); }
  }
  if (celebrate.length) app.save();

  const active = profile.challenges.filter(challenge => challenge.end >= app.today);
  const past = profile.challenges.filter(challenge => challenge.end < app.today).slice(-6).reverse();

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">${escapeHtml(t('challenges.title'))}</h1>
      <p class="page-sub">${escapeHtml(t('challenges.subtitle'))}</p>
    </header>
    ${celebrate.length ? `<section class="card celebrate" role="status">${icon('spark', 18)} ${escapeHtml(t('challenges.celebrate', { name: challengeName(celebrate[0]) }))}</section>` : ''}
    <section class="card ${celebrate.length ? 'mt-4' : ''}">
      <div class="row-between"><h2 class="card-title">${escapeHtml(t('challenges.private'))}</h2>
        <button type="button" class="btn btn-sm btn-primary" id="new-challenge">${icon('plus', 15)} ${escapeHtml(t('challenges.new'))}</button></div>
      <p class="small muted mt-2">${escapeHtml(t('challenges.privateNote'))}</p>
      <div class="stack mt-4">${active.length ? active.map(challenge => challengeCard(challenge, profile, app.today)).join('') : `<p class="small muted">${escapeHtml(t('challenges.none'))}</p>`}</div>
      ${past.length ? `<details class="collapse mt-4"><summary>${escapeHtml(t('challenges.past'))}</summary><div class="collapse-body stack">
        ${past.map(challenge => challengeCard(challenge, profile, app.today, true)).join('')}</div></details>` : ''}
    </section>
    <section class="card mt-4" id="friends-section"></section>
    <section class="card mt-4">
      <h2 class="card-title">${escapeHtml(t('challenges.achievements'))}</h2>
      <p class="small muted mt-2">${escapeHtml(t('challenges.achievementsNote'))}</p>
      <ul class="achievement-list mt-3">${achievements(profile).map(item => `<li class="achievement ${item.earned ? 'is-earned' : ''}">
        <span>${icon(item.earned ? 'check' : 'spark', 16)} ${escapeHtml(item.hidden ? t('challenges.hiddenAchievement') : t(`challenges.ach_${item.key}`))}</span>
        ${item.earned ? `<button type="button" class="btn btn-sm" data-hide-ach="${item.key}" aria-pressed="${item.hidden}">${escapeHtml(item.hidden ? t('challenges.show') : t('challenges.hide'))}</button>` : `<span class="small muted">${escapeHtml(t('challenges.notYet'))}</span>`}
      </li>`).join('')}</ul>
    </section>`;

  wirePrivate(container, app);
  await renderFriends(container.querySelector('#friends-section'), app);
}

function challengeName(challenge) {
  return challenge.title || t(`challenges.t_${challenge.template}`);
}

function challengeCard(challenge, profile, today, past = false) {
  const progress = challengeProgress(challenge, profile);
  const manual = TEMPLATES[challenge.template].manual;
  const tickedToday = (challenge.ticks || []).includes(today);
  const percent = Math.round((progress.count / progress.target) * 100);
  return `<article class="challenge ${progress.done ? 'is-done' : ''}" data-challenge="${challenge.id}">
    <div class="row-between"><strong>${escapeHtml(challengeName(challenge))}</strong>
      <span class="pill ${progress.done ? 'pill-accent' : ''}">${escapeHtml(progress.done ? t('challenges.done') : t('challenges.progress', { n: progress.count, target: progress.target }))}</span></div>
    <p class="small muted">${escapeHtml(t('challenges.range', { start: challenge.start, end: challenge.end }))}</p>
    <div class="progress-bar mt-2" role="progressbar" aria-valuemin="0" aria-valuemax="${progress.target}" aria-valuenow="${progress.count}"
      aria-label="${escapeHtml(t('challenges.progress', { n: progress.count, target: progress.target }))}"><span style="width:${percent}%"></span></div>
    ${past ? '' : `<div class="row mt-3">
      ${manual && !progress.done ? `<button type="button" class="btn btn-sm" data-tick="${challenge.id}" ${tickedToday ? 'disabled' : ''}>${icon('check', 14)} ${escapeHtml(tickedToday ? t('challenges.tickedToday') : t(challenge.template === 'reach_out' ? 'challenges.tickReach' : 'challenges.tickRoutine'))}</button>` : ''}
      <button type="button" class="btn btn-sm" data-leave="${challenge.id}">${escapeHtml(t('challenges.leave'))}</button>
    </div>`}
    ${challenge.template === 'reach_out' && !past ? `<p class="card-note">${escapeHtml(t('challenges.reachNote'))}</p>` : ''}
  </article>`;
}

function wirePrivate(container, app) {
  const profile = app.profile;
  container.querySelector('#new-challenge').addEventListener('click', () => openCreate(app, container, false));
  for (const button of container.querySelectorAll('[data-tick]')) button.addEventListener('click', () => {
    const challenge = profile.challenges.find(item => item.id === button.dataset.tick);
    challenge.ticks = [...new Set([...(challenge.ticks || []), app.today])];
    app.save();
    renderChallenges(container, app);
  });
  for (const button of container.querySelectorAll('[data-leave]')) button.addEventListener('click', () => {
    profile.challenges = profile.challenges.filter(item => item.id !== button.dataset.leave);
    app.save();
    toast(t('challenges.left'));
    renderChallenges(container, app);
  });
  for (const button of container.querySelectorAll('[data-hide-ach]')) button.addEventListener('click', () => {
    const hidden = new Set(profile.settings.hiddenAchievements || []);
    if (hidden.has(button.dataset.hideAch)) hidden.delete(button.dataset.hideAch); else hidden.add(button.dataset.hideAch);
    profile.settings.hiddenAchievements = [...hidden];
    app.save();
    renderChallenges(container, app);
  });
}

function openCreate(app, container, withFriends) {
  const panel = openModal(withFriends ? t('challenges.newFriends') : t('challenges.new'), `
    <form class="stack" data-create>
      <div class="field"><label for="c-template">${escapeHtml(t('challenges.template'))}</label>
        <select id="c-template">${Object.keys(TEMPLATES).map(key => `<option value="${key}">${escapeHtml(t(`challenges.t_${key}`))}</option>`).join('')}</select></div>
      <div class="field"><label for="c-title">${escapeHtml(t('challenges.titleLabel'))} <span class="field-hint">${escapeHtml(t('social.optional'))}</span></label>
        <input id="c-title" maxlength="60"></div>
      <div class="grid grid-2">
        <div class="field"><label for="c-start">${escapeHtml(t('challenges.start'))}</label><input id="c-start" type="date" value="${app.today}" required></div>
        <div class="field"><label for="c-end">${escapeHtml(t('challenges.end'))}</label><input id="c-end" type="date" required></div>
      </div>
      <div class="field"><label for="c-target">${escapeHtml(t('challenges.target'))}</label><input id="c-target" type="number" min="1" max="60" required></div>
      ${withFriends ? `<p class="card-note">${escapeHtml(t('challenges.friendsNote'))}</p>` : ''}
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-cancel>${escapeHtml(t('common.cancel'))}</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(t('challenges.create'))}</button>
      </div>
    </form>`);
  const template = panel.querySelector('#c-template');
  const syncDefaults = () => {
    const base = TEMPLATES[template.value];
    const start = panel.querySelector('#c-start').value || app.today;
    const draft = newChallenge(template.value, start);
    panel.querySelector('#c-end').value = draft.end;
    panel.querySelector('#c-target').value = base.target;
  };
  template.addEventListener('change', syncDefaults);
  syncDefaults();
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-create]').addEventListener('submit', async event => {
    event.preventDefault();
    let challenge;
    try {
      challenge = newChallenge(template.value, app.today, {
        title: panel.querySelector('#c-title').value, start: panel.querySelector('#c-start').value,
        end: panel.querySelector('#c-end').value, target: panel.querySelector('#c-target').value
      });
    } catch (error) { toast(t('challenges.invalidDates'), 'err'); return; }
    if (withFriends) {
      const { error } = await getClient().from('challenges').insert({
        owner_id: currentUser().id, template: challenge.template, title: challenge.title,
        target: challenge.target, start_date: challenge.start, end_date: challenge.end
      });
      if (error) { toast(friendlyError(error), 'err'); return; }
    } else {
      app.profile.challenges.push(challenge);
      app.save();
    }
    closeLayer();
    toast(t('challenges.created'), 'ok');
    renderChallenges(container, app);
  });
}

// ---------- me miqtë ----------
async function renderFriends(section, app) {
  if (!serverEnabled('challenges')) {
    section.innerHTML = `<h2 class="card-title">${escapeHtml(t('challenges.friends'))}</h2><p class="small muted mt-2">${escapeHtml(t('challenges.friendsOff'))}</p>`;
    return;
  }
  const user = await ensureSession();
  if (!user) {
    section.innerHTML = `<h2 class="card-title">${escapeHtml(t('challenges.friends'))}</h2><p class="small muted mt-2">${escapeHtml(t('challenges.friendsSignIn'))}</p>`;
    return;
  }
  const [{ data: list, error }, { data: mine }] = await Promise.all([
    getClient().from('challenges').select('*').order('end_date', { ascending: false }).limit(30),
    getClient().from('challenge_participants').select('challenge_id, progress, completed_at, hide_achievement').eq('user_id', user.id)
  ]);
  if (error) { section.innerHTML = `<p class="warn">${escapeHtml(friendlyError(error))}</p>`; return; }
  const joined = new Map((mine || []).map(row => [row.challenge_id, row]));
  section.innerHTML = `<div class="row-between"><h2 class="card-title">${escapeHtml(t('challenges.friends'))}</h2>
      <button type="button" class="btn btn-sm" id="new-friends">${icon('plus', 15)} ${escapeHtml(t('challenges.newFriends'))}</button></div>
    <p class="small muted mt-2">${escapeHtml(t('challenges.friendsExplain'))}</p>
    <div class="stack mt-4">${list.length ? list.map(row => friendCard(row, joined.get(row.id), app)).join('') : `<p class="small muted">${escapeHtml(t('challenges.noneFriends'))}</p>`}</div>`;
  section.querySelector('#new-friends').addEventListener('click', () => openCreate(app, section.closest('.screen') || section.parentElement, true));
  for (const button of section.querySelectorAll('[data-join]')) button.addEventListener('click', async () => {
    const { error: joinError } = await getClient().from('challenge_participants').insert({ challenge_id: button.dataset.join, user_id: user.id });
    if (joinError) toast(friendlyError(joinError), 'err'); else renderFriends(section, app);
  });
  for (const button of section.querySelectorAll('[data-update]')) button.addEventListener('click', async () => {
    const row = list.find(item => item.id === button.dataset.update);
    // Dërgohet vetëm numri i herëve, i llogaritur në pajisje — asnjë vlerë matjeje.
    const local = challengeProgress({ template: row.template, start: row.start_date, end: row.end_date, target: row.target,
      ticks: (app.profile.challenges.find(item => item.serverId === row.id) || {}).ticks || [] }, app.profile);
    const { error: updateError } = await getClient().from('challenge_participants').update({ progress: local.count }).match({ challenge_id: row.id, user_id: user.id });
    if (updateError) toast(friendlyError(updateError), 'err'); else { toast(t('challenges.progressSent', { n: local.count }), 'ok'); renderFriends(section, app); }
  });
  for (const button of section.querySelectorAll('[data-fleave]')) button.addEventListener('click', async () => {
    await getClient().from('challenge_participants').delete().match({ challenge_id: button.dataset.fleave, user_id: user.id });
    renderFriends(section, app);
  });
  for (const button of section.querySelectorAll('[data-fhide]')) button.addEventListener('click', async () => {
    const current = joined.get(button.dataset.fhide);
    await getClient().from('challenge_participants').update({ hide_achievement: !current.hide_achievement }).match({ challenge_id: button.dataset.fhide, user_id: user.id });
    renderFriends(section, app);
  });
  for (const button of section.querySelectorAll('[data-board]')) button.addEventListener('click', async () => {
    const { data } = await getClient().rpc('challenge_board', { p_challenge: button.dataset.board });
    openModal(t('challenges.participants'), `<p class="small muted">${escapeHtml(t('challenges.boardNote'))}</p>
      <ul class="changelog mt-3">${(data || []).map(item => `<li>${escapeHtml(item.nickname || '—')} · ${escapeHtml(item.completed ? t('challenges.done') : t('challenges.ongoing'))}</li>`).join('')}</ul>`);
  });
}

function friendCard(row, participation, app) {
  const ended = row.end_date < app.today;
  return `<article class="challenge">
    <div class="row-between"><strong>${escapeHtml(row.title || t(`challenges.t_${row.template}`))}</strong>
      ${participation ? `<span class="pill ${participation.completed_at ? 'pill-accent' : ''}">${escapeHtml(participation.completed_at ? t('challenges.done') : t('challenges.progress', { n: participation.progress, target: row.target }))}</span>` : ''}</div>
    <p class="small muted">${escapeHtml(t('challenges.range', { start: row.start_date, end: row.end_date }))}${row.owner_id === currentUser().id ? ' · ' + escapeHtml(t('challenges.yours')) : ''}</p>
    <div class="row mt-3">
      ${participation
        ? `${ended ? '' : `<button type="button" class="btn btn-sm" data-update="${row.id}">${escapeHtml(t('challenges.sendProgress'))}</button>`}
           <button type="button" class="btn btn-sm" data-board="${row.id}">${escapeHtml(t('challenges.participants'))}</button>
           <button type="button" class="btn btn-sm" data-fhide="${row.id}" aria-pressed="${participation.hide_achievement}">${escapeHtml(participation.hide_achievement ? t('challenges.show') : t('challenges.hide'))}</button>
           <button type="button" class="btn btn-sm" data-fleave="${row.id}">${escapeHtml(t('challenges.leave'))}</button>`
        : ended ? '' : `<button type="button" class="btn btn-sm btn-primary" data-join="${row.id}">${escapeHtml(t('challenges.join'))}</button>`}
    </div>
    <p class="card-note">${escapeHtml(t('challenges.createdAt', { date: formatDateTime(row.created_at, false) }))}</p>
  </article>`;
}
