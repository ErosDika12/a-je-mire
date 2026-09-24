import { icon, toast, openModal, closeLayer } from '../ui.js';
import { formatDateLong } from '../format.js';
import { initials, escapeHtml } from '../format.js';
import { PERSON_COLORS } from '../storage.js';
import { CONNECT_ACTIVITIES, daysSince } from '../compose.js';
import { emptyState as emptyBlock } from '../components.js';
import { t } from '../i18n/index.js';

const MAX_PEOPLE = 5;

export function renderMy5(container, app) {
  const people = app.profile.my5 || [];

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">${t('my5.title')}</h1>
      <p class="page-sub">${t('my5.subtitle')}</p>
    </header>

    <div class="row-between" style="margin-bottom:var(--s4)">
      <span class="pill">${icon('users', 13)} ${t('my5.count', { n: people.length, max: MAX_PEOPLE })}</span>
      <button type="button" class="btn btn-primary" data-add ${people.length >= MAX_PEOPLE ? 'disabled' : ''}>
        ${icon('plus', 16)} ${t('my5.add')}
      </button>
    </div>

    ${people.length === 0
      ? `<section class="card">${emptyBlock('users', t('my5.empty'), t('my5.emptyText'))}</section>`
      : `<div class="person-grid">${people.map((person, index) => personCard(person, index, app.today)).join('')}</div>`}

    ${app.profile.mode === 'demo' ? `<p class="card-note" style="margin-top:var(--s4)">
      ${icon('info', 14)} ${t('my5.demoNote')}
    </p>` : ''}

    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="row" style="gap:var(--s3)">
        <span class="fact-ic">${icon('shield', 18)}</span>
        <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
          ${t('my5.noNotify')}
        </p>
      </div>
    </section>`;

  wire(container, app);
}

function personCard(person, index, today) {
  const gap = daysSince(person.lastReached, today);
  const gapText = gap === null ? t('my5.noDate') : gap === 0 ? t('my5.today') : t('my5.daysAgo', { n: gap });
  return `<article class="person">
    <div class="avatar" style="background:${escapeHtml(person.color || PERSON_COLORS[0])}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
    <div class="person-info">
      <div class="person-name">${escapeHtml(person.name)}</div>
      <div class="person-rel">${escapeHtml(person.relation || '—')}</div>
      <div class="person-meta">${icon('calendar', 12)} ${escapeHtml(gapText)}</div>
      <div class="person-meta">${icon('coffee', 12)} ${escapeHtml(CONNECT_ACTIVITIES[person.sharedActivity] || t('my5.defaultActivity'))}</div>
    </div>
    <div class="person-actions">
      <button type="button" class="icon-btn" data-edit="${index}" aria-label="${escapeHtml(t('my5.edit', { name: person.name }))}">${icon('edit', 16)}</button>
      <button type="button" class="icon-btn" data-remove="${index}" aria-label="${escapeHtml(t('my5.remove', { name: person.name }))}">${icon('trash', 16)}</button>
    </div>
  </article>`;
}

function formMarkup(person) {
  const color = person.color || PERSON_COLORS[0];
  return `<form class="stack" id="person-form">
    <div class="field">
      <label for="person-name">${t('my5.name')}</label>
      <input type="text" id="person-name" maxlength="40" required value="${escapeHtml(person.name || '')}" autocomplete="off">
    </div>
    <div class="field">
      <label for="person-relation">${t('my5.relation')} <span class="field-hint">${t('my5.relationHint')}</span></label>
      <input type="text" id="person-relation" maxlength="40" value="${escapeHtml(person.relation || '')}" autocomplete="off">
    </div>
    <div class="field">
      <label for="person-activity">${t('my5.activity')}</label>
      <select id="person-activity">
        ${Object.entries(CONNECT_ACTIVITIES).map(([key, label]) =>
          `<option value="${key}" ${person.sharedActivity === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="person-date">${t('my5.lastContact')} <span class="field-hint">${t('my5.optional')}</span></label>
      <input type="date" id="person-date" value="${escapeHtml(person.lastReached || '')}">
    </div>
    <div class="field">
      <span id="color-label">${t('my5.color')}</span>
      <div class="color-choices" id="color-choices" role="group" aria-labelledby="color-label">
        ${PERSON_COLORS.map(option => `<button type="button" class="color-dot" style="background:${option}"
          data-color="${option}" aria-pressed="${option === color}" aria-label="${t('my5.colorOption', { c: option })}"></button>`).join('')}
      </div>
    </div>
    <div class="row" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>${t('my5.cancel')}</button>
      <button type="submit" class="btn btn-primary">${icon('check', 16)} ${t('my5.save')}</button>
    </div>
  </form>`;
}

function openPersonForm(app, container, index) {
  const people = app.profile.my5;
  const isNew = index === null;
  const person = isNew ? { color: PERSON_COLORS[people.length % PERSON_COLORS.length], sharedActivity: 'kafe' } : { ...people[index] };
  const panel = openModal(isNew ? t('my5.addTitle') : t('my5.editTitle'), formMarkup(person));

  let chosenColor = person.color;
  panel.querySelector('#color-choices').addEventListener('click', event => {
    const dot = event.target.closest('[data-color]');
    if (!dot) return;
    chosenColor = dot.dataset.color;
    for (const item of panel.querySelectorAll('[data-color]')) {
      item.setAttribute('aria-pressed', String(item.dataset.color === chosenColor));
    }
  });

  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('#person-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = panel.querySelector('#person-name').value.trim();
    if (name === '') {
      toast(t('my5.nameEmpty'), 'err');
      return;
    }
    const entry = {
      name: name.slice(0, 40),
      relation: panel.querySelector('#person-relation').value.trim().slice(0, 40),
      color: chosenColor,
      lastReached: panel.querySelector('#person-date').value || null,
      sharedActivity: panel.querySelector('#person-activity').value
    };
    if (isNew) people.push(entry); else people[index] = entry;
    app.save();
    closeLayer();
    toast(isNew ? t('my5.added', { name: entry.name }) : t('my5.updated', { name: entry.name }), 'ok');
    renderMy5(container, app);
  });
}

function wire(container, app) {
  const addButton = container.querySelector('[data-add]');
  if (addButton) addButton.addEventListener('click', () => openPersonForm(app, container, null));

  for (const button of container.querySelectorAll('[data-edit]')) {
    button.addEventListener('click', () => openPersonForm(app, container, Number(button.dataset.edit)));
  }

  for (const button of container.querySelectorAll('[data-remove]')) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.remove);
      const person = app.profile.my5[index];
      const panel = openModal(t('my5.removeTitle'), `
        <p style="color:var(--text-2);font-size:var(--fs-sm)">${t('my5.removeText', { name: escapeHtml(person.name) })}</p>
        <div class="row" style="justify-content:flex-end;margin-top:var(--s5)">
          <button type="button" class="btn" data-cancel>${t('my5.cancel')}</button>
          <button type="button" class="btn btn-danger" data-confirm>${icon('trash', 15)} ${t('my5.removeButton')}</button>
        </div>`);
      panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
      panel.querySelector('[data-confirm]').addEventListener('click', () => {
        app.profile.my5.splice(index, 1);
        app.save();
        closeLayer();
        toast(t('my5.removed', { name: person.name }));
        renderMy5(container, app);
      });
    });
  }
}
