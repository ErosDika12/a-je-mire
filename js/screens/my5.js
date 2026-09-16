import { icon, toast, openModal, closeLayer, formatDateLong } from '../ui.js';
import { initials, escapeHtml } from '../chart.js';
import { PERSON_COLORS } from '../storage.js';
import { CONNECT_ACTIVITIES, daysSince } from '../compose.js';
import { emptyBlock } from './dashboard.js';

const MAX_PEOPLE = 5;

export function renderMy5(container, app) {
  const people = app.profile.my5 || [];

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">MY 5</h1>
      <p class="page-sub">Deri në pesë persona që i zgjedh vetë. Shkruhen me dorë, ruhen vetëm këtu, dhe nuk renditen sipas rëndësisë.</p>
    </header>

    <div class="row-between" style="margin-bottom:var(--s4)">
      <span class="pill">${icon('users', 13)} ${people.length} nga ${MAX_PEOPLE}</span>
      <button type="button" class="btn btn-primary" data-add ${people.length >= MAX_PEOPLE ? 'disabled' : ''}>
        ${icon('plus', 16)} Shto person
      </button>
    </div>

    ${people.length === 0
      ? `<section class="card">${emptyBlock('users', 'Ende asnjë person',
          'Shto dikë që e ke zgjedhur vetë. Nuk kërkohet qasje te kontaktet e telefonit dhe asgjë nuk dërgohet.')}</section>`
      : `<div class="person-grid">${people.map((person, index) => personCard(person, index, app.today)).join('')}</div>`}

    ${app.profile.mode === 'demo' ? `<p class="card-note" style="margin-top:var(--s4)">
      ${icon('info', 14)} Këta tre janë profile demonstruese sintetike, të gjeneruara nga kodi. Nuk janë persona të vërtetë.
    </p>` : ''}

    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="row" style="gap:var(--s3)">
        <span class="fact-ic">${icon('shield', 18)}</span>
        <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
          Asnjë nga këta persona nuk merr njoftim. Sistemi vetëm përgatit një draft që e kopjon ti dhe e dërgon vetë, nga aplikacioni yt.
        </p>
      </div>
    </section>`;

  wire(container, app);
}

function personCard(person, index, today) {
  const gap = daysSince(person.lastReached, today);
  const gapText = gap === null ? 'pa datë kontakti' : gap === 0 ? 'sot' : `${gap} ditë më parë`;
  return `<article class="person">
    <div class="avatar" style="background:${escapeHtml(person.color || PERSON_COLORS[0])}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
    <div class="person-info">
      <div class="person-name">${escapeHtml(person.name)}</div>
      <div class="person-rel">${escapeHtml(person.relation || '—')}</div>
      <div class="person-meta">${icon('calendar', 12)} ${escapeHtml(gapText)}</div>
      <div class="person-meta">${icon('coffee', 12)} ${escapeHtml(CONNECT_ACTIVITIES[person.sharedActivity] || 'një kafe')}</div>
    </div>
    <div class="person-actions">
      <button type="button" class="icon-btn" data-edit="${index}" aria-label="Ndrysho ${escapeHtml(person.name)}">${icon('edit', 16)}</button>
      <button type="button" class="icon-btn" data-remove="${index}" aria-label="Hiq ${escapeHtml(person.name)}">${icon('trash', 16)}</button>
    </div>
  </article>`;
}

function formMarkup(person) {
  const color = person.color || PERSON_COLORS[0];
  return `<form class="stack" id="person-form">
    <div class="field">
      <label for="person-name">Emri</label>
      <input type="text" id="person-name" maxlength="40" required value="${escapeHtml(person.name || '')}" autocomplete="off">
    </div>
    <div class="field">
      <label for="person-relation">Lidhja <span class="field-hint">p.sh. kushërirë, shok klase</span></label>
      <input type="text" id="person-relation" maxlength="40" value="${escapeHtml(person.relation || '')}" autocomplete="off">
    </div>
    <div class="field">
      <label for="person-activity">Aktiviteti i zakonshëm bashkë</label>
      <select id="person-activity">
        ${Object.entries(CONNECT_ACTIVITIES).map(([key, label]) =>
          `<option value="${key}" ${person.sharedActivity === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="person-date">Kontakti i fundit <span class="field-hint">opsionale</span></label>
      <input type="date" id="person-date" value="${escapeHtml(person.lastReached || '')}">
    </div>
    <div class="field">
      <span id="color-label">Ngjyra</span>
      <div class="color-choices" id="color-choices" role="group" aria-labelledby="color-label">
        ${PERSON_COLORS.map(option => `<button type="button" class="color-dot" style="background:${option}"
          data-color="${option}" aria-pressed="${option === color}" aria-label="Ngjyra ${option}"></button>`).join('')}
      </div>
    </div>
    <div class="row" style="justify-content:flex-end">
      <button type="button" class="btn" data-cancel>Anulo</button>
      <button type="submit" class="btn btn-primary">${icon('check', 16)} Ruaj</button>
    </div>
  </form>`;
}

function openPersonForm(app, container, index) {
  const people = app.profile.my5;
  const isNew = index === null;
  const person = isNew ? { color: PERSON_COLORS[people.length % PERSON_COLORS.length], sharedActivity: 'kafe' } : { ...people[index] };
  const panel = openModal(isNew ? 'Shto person' : 'Ndrysho personin', formMarkup(person));

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
      toast('Emri nuk mund të jetë bosh', 'err');
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
    toast(isNew ? `${entry.name} u shtua` : `${entry.name} u përditësua`, 'ok');
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
      const panel = openModal('Hiq personin', `
        <p style="color:var(--text-2);font-size:var(--fs-sm)">Do të hiqet <strong>${escapeHtml(person.name)}</strong> nga MY 5. Historiku i lidhjeve mbetet.</p>
        <div class="row" style="justify-content:flex-end;margin-top:var(--s5)">
          <button type="button" class="btn" data-cancel>Anulo</button>
          <button type="button" class="btn btn-danger" data-confirm>${icon('trash', 15)} Hiqe</button>
        </div>`);
      panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
      panel.querySelector('[data-confirm]').addEventListener('click', () => {
        app.profile.my5.splice(index, 1);
        app.save();
        closeLayer();
        toast(`${person.name} u hoq`);
        renderMy5(container, app);
      });
    });
  }
}
