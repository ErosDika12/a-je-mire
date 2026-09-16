import { icon, mountChartTips, formatDateLong } from '../ui.js';
import { wallChart, initials, escapeHtml } from '../chart.js';
import { round } from '../stats.js';
import { myNormal, tagLabel } from '../patterns.js';
import { CONNECT_ACTIVITIES, daysSince, suggestConnection } from '../compose.js';
import { PERSON_COLORS } from '../storage.js';
import { emptyBlock } from './dashboard.js';

const SOCIAL_TAGS = ['shoket', 'familja', 'basketboll', 'shetitje', 'kafe'];

export function renderWall(container, app) {
  const profile = app.profile;
  const people = profile.my5 || [];

  if (people.length === 0) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('network', 'Muri është bosh',
        'Connection Wall vizatohet rreth njerëzve që shton te MY 5. Asgjë nuk importohet nga kontaktet.')}
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn-primary" data-go="my5">${icon('users', 16)} Hap MY 5</button>
        </div>
      </section>`;
    wire(container, app);
    return;
  }

  const gaps = {};
  for (const person of people) gaps[person.name] = daysSince(person.lastReached, app.today);

  const dismissedToday = (profile.dismissed || []).filter(item => item.date === app.today).map(item => item.key);
  const planned = suggestConnection(profile, app.today, dismissedToday);
  const moments = findMoments(profile);

  container.innerHTML = `
    ${head()}
    <section class="card">
      <div class="card-head"><div>
        <h2 class="card-title">Harta jote</h2>
        <p class="card-sub">Ti në qendër, ${people.length} ${people.length === 1 ? 'person' : 'persona'} rreth teje. Rendi është ai i shtimit — pa renditje sipas rëndësisë.</p>
      </div></div>
      <div class="desktop-only">
        ${wallChart(people, gaps)}
        <div class="chart-legend" style="justify-content:center">
          <span style="color:var(--teal)"><i class="legend-swatch"></i>kontakt brenda 7 ditëve</span>
          <span style="color:var(--text-3)"><i class="legend-swatch dashed"></i>më herët ose pa datë</span>
        </div>
      </div>
      <div class="person-grid" style="margin-top:var(--s5)">
        ${people.map(person => wallCard(person, gaps[person.name])).join('')}
      </div>
      <p class="card-note">Asnjë person nuk merr pikë, notë apo renditje cilësie. Muri tregon vetëm çfarë ke shënuar vetë.</p>
    </section>

    ${planned ? plannedCard(planned) : ''}
    ${historyCard(profile, app.today)}
    ${momentsCard(moments)}`;

  wire(container, app);
  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">Connection Wall</h1>
    <p class="page-sub">Njerëzit që ke zgjedhur, çfarë bëni bashkë, dhe kur është hera e fundit që e ke shënuar një kontakt.</p>
  </header>`;
}

function wallCard(person, gap) {
  const gapText = gap === null ? 'pa datë kontakti' : gap === 0 ? 'kontakt sot' : `${gap} ditë më parë`;
  const fresh = gap !== null && gap <= 7;
  return `<article class="person">
    <div class="avatar" style="background:${escapeHtml(person.color || PERSON_COLORS[0])}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
    <div class="person-info">
      <div class="person-name">${escapeHtml(person.name)}</div>
      <div class="person-rel">${escapeHtml(person.relation || '—')}</div>
      <div class="person-meta">
        <span class="pill ${fresh ? 'pill-accent' : ''}" style="font-size:11px">${escapeHtml(gapText)}</span>
      </div>
      <div class="person-meta">${icon('coffee', 12)} ${escapeHtml(CONNECT_ACTIVITIES[person.sharedActivity] || 'një kafe')}</div>
    </div>
  </article>`;
}

function plannedCard(planned) {
  return `<section class="card" style="margin-top:var(--s4);border-color:var(--accent)">
    <div class="card-head">
      <span class="fact-ic">${icon('coffee', 20)}</span>
      <div>
        <h2 class="card-title">Lidhja e propozuar</h2>
        <p class="card-sub">${escapeHtml(planned.reason)}</p>
      </div>
    </div>
    <p style="font-size:var(--fs-lg);line-height:1.45">
      ${escapeHtml(planned.person.name)} · ${escapeHtml(planned.activityText)}
    </p>
    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-go="kafe">${icon('edit', 16)} Përgatit mesazhin</button>
    </div>
    <p class="card-note">Propozim, jo detyrim. Asgjë nuk dërgohet automatikisht.</p>
  </section>`;
}

function historyCard(profile, today) {
  const history = [...(profile.connections || [])].sort((left, right) => right.date.localeCompare(left.date));
  if (history.length === 0) {
    return `<section class="card" style="margin-top:var(--s4)">${emptyBlock('calendar', 'Ende asnjë lidhje e shënuar',
      'Kur të shënosh një takim ose bisedë te KAFE?, do të shfaqet këtu.')}</section>`;
  }
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Historiku i lidhjeve</h2>
      <p class="card-sub">${history.length} ${history.length === 1 ? 'lidhje e shënuar' : 'lidhje të shënuara'}</p>
    </div></div>
    ${history.slice(0, 8).map(item => `<div class="moment">
      <span class="moment-date">${escapeHtml(item.date)}</span>
      <span class="moment-body"><strong>${escapeHtml(item.personName)}</strong> · ${escapeHtml(CONNECT_ACTIVITIES[item.activityKey] || item.activityKey)}</span>
    </div>`).join('')}
  </section>`;
}

// Ditë ku lidhja sociale ose gëzimi ishin mbi normalen dhe kishte një aktivitet me njerëz.
function findMoments(profile) {
  const normal = myNormal(profile.checkins, profile.settings);
  return profile.checkins.filter(entry => {
    const tags = entry.activities || [];
    const social = tags.some(tag => SOCIAL_TAGS.includes(tag));
    const aboveSocial = normal.social !== null && Number.isFinite(entry.social) && entry.social > normal.social;
    const aboveJoy = normal.joy !== null && Number.isFinite(entry.joy) && entry.joy > normal.joy;
    return social && (aboveSocial || aboveJoy);
  }).slice(-6).reverse();
}

function momentsCard(moments) {
  if (moments.length === 0) {
    return `<section class="card" style="margin-top:var(--s4)">${emptyBlock('spark', 'Ende asnjë moment i shënuar',
      'Kur një ditë me shokët ose familjen del mbi normalen tënde, shfaqet këtu.')}</section>`;
  }
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Momente nga check-ins</h2>
      <p class="card-sub">Ditë me njerëz ku lidhja sociale ose gëzimi ishin mbi normalen tënde</p>
    </div></div>
    ${moments.map(entry => `<div class="moment">
      <span class="moment-date">${escapeHtml(entry.date)}</span>
      <span class="moment-body">
        ${(entry.activities || []).map(tag => `<span class="pill" style="font-size:11px">${escapeHtml(tagLabel(tag))}</span>`).join(' ')}
        <div style="margin-top:6px;color:var(--text-2)">${escapeHtml(entry.note || '—')}</div>
        <div class="link-meta" style="margin-top:4px">lidhja sociale ${round(entry.social, 1)} · gëzimi ${round(entry.joy, 1)}</div>
      </span>
    </div>`).join('')}
    <p class="card-note">Këto janë ditët e tua, ashtu siç i ke shënuar. Pa vlerësim dhe pa renditje.</p>
  </section>`;
}

function wire(container, app) {
  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
}
