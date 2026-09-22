import { icon, toast, copyText } from '../ui.js';
import { formatDateLong } from '../format.js';
import { escapeHtml, initials } from '../format.js';
import { CONNECT_ACTIVITIES, TONES, draftMessage, suggestConnection, daysSince } from '../compose.js';
import { emptyState as emptyBlock } from '../components.js';

// Gjendja e ekranit ruhet ndërmjet rivizatimeve, që teksti i redaktuar të mos humbasë.
let state = null;

export function renderKafe(container, app) {
  const people = app.profile.my5 || [];

  if (people.length === 0) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('coffee', 'Së pari zgjidh njerëzit e tu',
        'KAFE? propozon një hap të vogël drejt dikujt nga MY 5. Shto të paktën një person.')}
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn-primary" data-go="my5">${icon('users', 16)} Hap MY 5</button>
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
          Ky ekran nuk dërgon asgjë. Maksimumi që bën është të përgatisë një draft dhe ta kopjojë në clipboard. Dërgimin e bën ti, nga aplikacioni yt.
        </p>
      </div>
    </section>`;

  container.querySelector('#draft-text').value = state.draft;
  wire(container, app);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">KAFE?</h1>
    <p class="page-sub">Një hap i vogël social, opsional. Ti vendos nëse, kur dhe si.</p>
  </header>`;
}

function suggestionCard(suggestion, app) {
  const gapText = suggestion.gapDays === null
    ? 'pa datë kontakti të shënuar'
    : `${suggestion.gapDays} ditë nga kontakti i fundit i shënuar`;
  return `<section class="kafe-card">
    <span class="pill pill-amber">${icon('coffee', 13)} Sugjerim i sotëm</span>
    <p class="kafe-line" style="margin-top:var(--s3)">${escapeHtml(suggestion.reason)}</p>
    <p class="kafe-line" style="margin-top:var(--s2)">
      Një hap i vogël: <strong>${escapeHtml(suggestion.person.name)}</strong> · ${escapeHtml(suggestion.activityText)}.
    </p>
    <p class="link-meta" style="margin-top:var(--s2)">${escapeHtml(gapText)}</p>
    <div class="kafe-actions">
      <button type="button" class="btn btn-primary" data-accept>${icon('edit', 16)} Përgatit mesazhin</button>
      <button type="button" class="btn" data-dismiss="${escapeHtml(suggestion.key)}">Jo tani</button>
    </div>
  </section>`;
}

function allDismissedCard() {
  return `<section class="card">
    <div class="row" style="gap:var(--s3)">
      <span class="fact-ic">${icon('check', 18)}</span>
      <p style="flex:1;min-width:220px;color:var(--text-2);font-size:var(--fs-sm)">
        Sugjerimet e sotme u mbyllën. Mund të përgatisësh vetë një mesazh më poshtë sa herë të duash.
      </p>
    </div>
  </section>`;
}

function composerCard(people, person) {
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Message Composer</h2>
      <p class="card-sub">Drafti ndërtohet lokalisht nga template. Ti e redakton dhe e dërgon vetë.</p>
    </div></div>

    <div class="grid grid-2">
      <div class="field">
        <label for="pick-person">Kujt</label>
        <select id="pick-person">
          ${people.map((item, index) =>
            `<option value="${index}" ${index === state.personIndex ? 'selected' : ''}>${escapeHtml(item.name)}${item.relation ? ' · ' + escapeHtml(item.relation) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="pick-activity">Për çfarë</label>
        <select id="pick-activity">
          ${Object.entries(CONNECT_ACTIVITIES).map(([key, label]) =>
            `<option value="${key}" ${key === state.activityKey ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:var(--s4)">
      <span id="tone-label">Toni</span>
      <div class="tone-wrap" role="group" aria-labelledby="tone-label">
        ${Object.entries(TONES).map(([key, label]) =>
          `<button type="button" class="tag" data-tone="${key}" aria-pressed="${key === state.tone}">${label}</button>`).join('')}
      </div>
    </div>

    <div class="field" style="margin-top:var(--s4)">
      <label for="draft-text">Drafti <span class="field-hint">redaktoje si të duash</span></label>
      <textarea id="draft-text" rows="3" maxlength="400"></textarea>
    </div>

    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-copy>${icon('copy', 16)} Kopjo tekstin</button>
      <button type="button" class="btn" data-regenerate>${icon('refresh', 16)} Variant tjetër</button>
      <button type="button" class="btn" data-complete>${icon('check', 16)} Shëno si të kryer</button>
    </div>

    <p class="card-note">"Shëno si të kryer" e ruan vetëm te ti: përditëson datën e kontaktit dhe e shton te Connection Wall. Personi nuk merr asgjë.</p>
  </section>`;
}

function historyCard(profile, today) {
  const history = [...(profile.connections || [])].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  if (history.length === 0) return '';
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Lidhjet e shënuara</h2>
      <p class="card-sub">Vetëm ato që i ke shënuar vetë si të kryera</p>
    </div></div>
    ${history.map(item => `<div class="moment">
      <span class="moment-date">${escapeHtml(item.date)}</span>
      <span class="moment-body">${escapeHtml(item.personName)} · ${escapeHtml(CONNECT_ACTIVITIES[item.activityKey] || item.activityKey)}
        <span class="link-meta"> (${daysSince(item.date, today)} ditë më parë)</span></span>
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
      toast('Nuk do të rishfaqet sot');
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
      toast('Variant i ri i gjeneruar');
    });
  }

  const copyButton = container.querySelector('[data-copy]');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const done = await copyText(textarea.value);
      toast(done ? 'Teksti u kopjua. Dërgoje ti kur të duash.' : 'Kopjimi nuk u lejua nga shfletuesi', done ? 'ok' : 'err');
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
      toast(`Lidhja me ${person.name} u shënua`, 'ok');
      renderKafe(container, app);
    });
  }
}
