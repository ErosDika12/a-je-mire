import { icon, toast, copyText } from '../ui.js';
import { formatDateLong } from '../format.js';
import { escapeHtml, initials } from '../format.js';
import { CONNECT_ACTIVITIES, TONES, draftMessage, suggestConnection, daysSince } from '../compose.js';
import { emptyState as emptyBlock } from '../components.js';
import { t } from '../i18n/index.js';

// Gjendja e ekranit ruhet ndërmjet rivizatimeve, që teksti i redaktuar të mos humbasë.
let state = null;

export function renderKafe(container, app) {
  const people = app.profile.my5 || [];

  if (people.length === 0) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('coffee', t('kafe.firstPick'), t('kafe.firstPickText'))}
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn-primary" data-go="my5">${icon('users', 16)} ${t('kafe.openMy5')}</button>
        </div>
      </section>`;
    wire(container, app);
    return;
  }

  const dismissedToday = (app.profile.dismissed || [])
    .filter(item => item.date === app.today).map(item => item.key);
  const suggestion = suggestConnection(app.profile, app.today, dismissedToday);

  if (!state || !people[state.personIndex]) {
    const index = suggestion ? people.findIndex(person => person.name === suggestion.person.name) : 0;
    state = {
      personIndex: Math.max(0, index),
      activityKey: suggestion ? suggestion.activityKey : (people[0].sharedActivity || 'kafe'),
      tone: 'casual',
      variant: 0,
      draft: null
    };
  }

  const person = people[state.personIndex];
  if (state.draft === null) state.draft = draftMessage(person, state.tone, state.activityKey, state.variant);

  container.innerHTML = `
    ${head()}
    ${suggestion ? suggestionCard(suggestion, app) : allDismissedCard()}
    ${composerCard(people, person)}
    ${historyCard(app.profile, app.today)}
    <section class="card card-soft" style="margin-top:var(--s4)">
      <div class="row" style="gap:var(--s3)">
        <span class="fact-ic">${icon('shield', 18)}</span>
        <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
          ${t('kafe.neverSends')}
        </p>
      </div>
    </section>`;

  container.querySelector('#draft-text').value = state.draft;
  wire(container, app);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${t('kafe.title')}</h1>
    <p class="page-sub">${t('kafe.subtitle')}</p>
  </header>`;
}

function suggestionCard(suggestion, app) {
  const gapText = suggestion.gapDays === null
    ? t('kafe.noDate')
    : t('kafe.gap', { n: suggestion.gapDays });
  return `<section class="kafe-card">
    <span class="pill pill-amber">${icon('coffee', 13)} ${t('kafe.todaySuggestion')}</span>
    <p class="kafe-line" style="margin-top:var(--s3)">${escapeHtml(suggestion.reason)}</p>
    <p class="kafe-line" style="margin-top:var(--s2)">
      ${t('kafe.smallStep', { name: escapeHtml(suggestion.person.name), what: escapeHtml(suggestion.activityText) })}
    </p>
    <p class="link-meta" style="margin-top:var(--s2)">${escapeHtml(gapText)}</p>
    <div class="kafe-actions">
      <button type="button" class="btn btn-primary" data-accept>${icon('edit', 16)} ${t('kafe.prepare')}</button>
      <button type="button" class="btn" data-dismiss="${escapeHtml(suggestion.key)}">${t('kafe.notNow')}</button>
    </div>
  </section>`;
}

function allDismissedCard() {
  return `<section class="card">
    <div class="row" style="gap:var(--s3)">
      <span class="fact-ic">${icon('check', 18)}</span>
      <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
        ${t('kafe.allDismissed')}
      </p>
    </div>
  </section>`;
}

function composerCard(people, person) {
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">${t('kafe.composer')}</h2>
      <p class="card-sub">${t('kafe.composerHint')}</p>
    </div></div>

    <div class="grid grid-2">
      <div class="field">
        <label for="pick-person">${t('kafe.to')}</label>
        <select id="pick-person">
          ${people.map((item, index) =>
            `<option value="${index}" ${index === state.personIndex ? 'selected' : ''}>${escapeHtml(item.name)}${item.relation ? ' · ' + escapeHtml(item.relation) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="pick-activity">${t('kafe.what')}</label>
        <select id="pick-activity">
          ${Object.entries(CONNECT_ACTIVITIES).map(([key, label]) =>
            `<option value="${key}" ${key === state.activityKey ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:var(--s4)">
      <span id="tone-label">${t('kafe.tone')}</span>
      <div class="tone-wrap" role="group" aria-labelledby="tone-label">
        ${Object.entries(TONES).map(([key, label]) =>
          `<button type="button" class="tag" data-tone="${key}" aria-pressed="${key === state.tone}">${label}</button>`).join('')}
      </div>
    </div>

    <div class="field" style="margin-top:var(--s4)">
      <label for="draft-text">${t('kafe.draft')} <span class="field-hint">${t('kafe.draftHint')}</span></label>
      <textarea id="draft-text" rows="3" maxlength="400"></textarea>
    </div>

    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-copy>${icon('copy', 16)} ${t('kafe.copy')}</button>
      <button type="button" class="btn" data-regenerate>${icon('refresh', 16)} ${t('kafe.variant')}</button>
      <button type="button" class="btn" data-complete>${icon('check', 16)} ${t('kafe.complete')}</button>
    </div>

    <p class="card-note">${t('kafe.completeNote')}</p>
  </section>`;
}

function historyCard(profile, today) {
  const history = [...(profile.connections || [])].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  if (history.length === 0) return '';
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">${t('kafe.history')}</h2>
      <p class="card-sub">${t('kafe.historyHint')}</p>
    </div></div>
    ${history.map(item => `<div class="moment">
      <span class="moment-date">${escapeHtml(item.date)}</span>
      <span class="moment-body">${escapeHtml(item.personName)} · ${escapeHtml(CONNECT_ACTIVITIES[item.activityKey] || item.activityKey)}
        <span class="link-meta"> ${t('kafe.daysAgo', { n: daysSince(item.date, today) })}</span></span>
    </div>`).join('')}
  </section>`;
}

function refreshDraft(container, app) {
  const person = app.profile.my5[state.personIndex];
  state.draft = draftMessage(person, state.tone, state.activityKey, state.variant);
  container.querySelector('#draft-text').value = state.draft;
}

function wire(container, app) {

  const accept = container.querySelector('[data-accept]');
  if (accept) {
    accept.addEventListener('click', () => {
      container.querySelector('#draft-text').focus();
      container.querySelector('#draft-text').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  const dismiss = container.querySelector('[data-dismiss]');
  if (dismiss) {
    dismiss.addEventListener('click', () => {
      // "Jo tani" respektohet: i njëjti sugjerim nuk rikthehet sot.
      app.profile.dismissed = app.profile.dismissed || [];
      app.profile.dismissed.push({ date: app.today, key: dismiss.dataset.dismiss });
      app.save();
      toast(t('kafe.notToday'));
      renderKafe(container, app);
    });
  }

  const personPicker = container.querySelector('#pick-person');
  if (personPicker) {
    personPicker.addEventListener('change', () => {
      state.personIndex = Number(personPicker.value);
      state.variant = 0;
      refreshDraft(container, app);
    });
  }

  const activityPicker = container.querySelector('#pick-activity');
  if (activityPicker) {
    activityPicker.addEventListener('change', () => {
      state.activityKey = activityPicker.value;
      state.variant = 0;
      refreshDraft(container, app);
    });
  }

  for (const button of container.querySelectorAll('[data-tone]')) {
    button.addEventListener('click', () => {
      state.tone = button.dataset.tone;
      state.variant = 0;
      for (const item of container.querySelectorAll('[data-tone]')) {
        item.setAttribute('aria-pressed', String(item.dataset.tone === state.tone));
      }
      refreshDraft(container, app);
    });
  }

  const textarea = container.querySelector('#draft-text');
  if (textarea) textarea.addEventListener('input', () => { state.draft = textarea.value; });

  const regenerate = container.querySelector('[data-regenerate]');
  if (regenerate) {
    regenerate.addEventListener('click', () => {
      state.variant += 1;
      refreshDraft(container, app);
      toast(t('kafe.newVariant'));
    });
  }

  const copyButton = container.querySelector('[data-copy]');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const done = await copyText(textarea.value);
      toast(done ? t('kafe.copied') : t('kafe.copyBlocked'), done ? 'ok' : 'err');
      if (done) {
        // Konfirmim i dukshëm mbi vetë butonin, jo vetëm një toast që zhduket.
        copyButton.innerHTML = `${icon('check', 16)} ${t('kafe.copiedButton')}`;
        setTimeout(() => { if (copyButton.isConnected) copyButton.innerHTML = `${icon('copy', 16)} ${t('kafe.copy')}`; }, 2500);
      }
    });
  }

  const complete = container.querySelector('[data-complete]');
  if (complete) {
    complete.addEventListener('click', () => {
      const person = app.profile.my5[state.personIndex];
      person.lastReached = app.today;
      app.profile.connections = app.profile.connections || [];
      app.profile.connections.push({ date: app.today, personName: person.name, activityKey: state.activityKey });
      app.save();
      toast(t('kafe.marked', { name: person.name }), 'ok');
      renderKafe(container, app);
    });
  }
}
