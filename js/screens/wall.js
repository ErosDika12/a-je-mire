import { icon, mountChartTips } from '../ui.js';
import { formatDateLong } from '../format.js';
import { wallChart } from '../chart.js';
import { initials, escapeHtml } from '../format.js';
import { round } from '../stats.js';
import { myNormal, tagLabel } from '../patterns.js';
import { CONNECT_ACTIVITIES, daysSince, suggestConnection } from '../compose.js';
import { PERSON_COLORS } from '../storage.js';
import { emptyState as emptyBlock } from '../components.js';
import { t } from '../i18n/index.js';

const SOCIAL_TAGS = ['shoket', 'familja', 'basketboll', 'shetitje', 'kafe'];

export function renderWall(container, app) {
  const profile = app.profile;
  const people = profile.my5 || [];

  if (people.length === 0) {
    container.innerHTML = `${head()}
      <section class="card">${emptyBlock('network', t('wall.empty'), t('wall.emptyText'))}
        <div class="row" style="justify-content:center">
          <button type="button" class="btn btn-primary" data-go="my5">${icon('users', 16)} ${t('wall.openMy5')}</button>
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
        <h2 class="card-title">${t('wall.mapTitle')}</h2>
        <p class="card-sub">${t('wall.mapHint', { n: people.length, people: people.length === 1 ? t('wall.person') : t('wall.persons') })}</p>
      </div></div>
      <div class="desktop-only">
        ${wallChart(people.map(person => ({ ...person, color: person.color || PERSON_COLORS[0], lastLabel: gapLabel(gaps[person.name]) })))}
      </div>
      <div class="person-grid" style="margin-top:var(--s5)">
        ${people.map(person => wallCard(person, gaps[person.name])).join('')}
      </div>
      <p class="card-note">${t('wall.noScore')}</p>
    </section>

    ${planned ? plannedCard(planned) : ''}
    ${historyCard(profile, app.today)}
    ${momentsCard(moments)}`;

  wire(container, app);
  mountChartTips(container);
}

function head() {
  return `<header class="page-head">
    <h1 class="page-title">${t('wall.title')}</h1>
    <p class="page-sub">${t('wall.subtitle')}</p>
  </header>`;
}

function gapLabel(gap) {
  if (gap === null || gap === undefined) return t('wall.noDate');
  return gap === 0 ? t('wall.today') : t('wall.daysAgo', { n: gap });
}

function wallCard(person, gap) {
  const gapText = gapLabel(gap);
  const fresh = gap !== null && gap <= 7;
  return `<article class="person">
    <div class="avatar" style="background:${escapeHtml(person.color || PERSON_COLORS[0])}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
    <div class="person-info">
      <div class="person-name">${escapeHtml(person.name)}</div>
      <div class="person-rel">${escapeHtml(person.relation || '—')}</div>
      <div class="person-meta">
        <span class="pill ${fresh ? 'pill-accent' : ''}" style="font-size:11px">${escapeHtml(gapText)}</span>
      </div>
      <div class="person-meta">${icon('coffee', 12)} ${escapeHtml(CONNECT_ACTIVITIES[person.sharedActivity] || t('wall.defaultActivity'))}</div>
    </div>
  </article>`;
}

function plannedCard(planned) {
  return `<section class="card" style="margin-top:var(--s4);border-color:var(--accent)">
    <div class="card-head">
      <span class="fact-ic">${icon('coffee', 20)}</span>
      <div>
        <h2 class="card-title">${t('wall.planned')}</h2>
        <p class="card-sub">${escapeHtml(planned.reason)}</p>
      </div>
    </div>
    <p style="font-size:var(--fs-lg);line-height:1.45">
      ${escapeHtml(planned.person.name)} · ${escapeHtml(planned.activityText)}
    </p>
    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-go="kafe">${icon('edit', 16)} ${t('wall.prepare')}</button>
    </div>
    <p class="card-note">${t('wall.plannedNote')}</p>
  </section>`;
}

function historyCard(profile, today) {
  const history = [...(profile.connections || [])].sort((left, right) => right.date.localeCompare(left.date));
  if (history.length === 0) {
    return `<section class="card" style="margin-top:var(--s4)">${emptyBlock('calendar', t('wall.noHistory'), t('wall.noHistoryText'))}</section>`;
  }
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">${t('wall.history')}</h2>
      <p class="card-sub">${history.length} ${history.length === 1 ? t('wall.oneRecorded') : t('wall.manyRecorded')}</p>
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
    return `<section class="card" style="margin-top:var(--s4)">${emptyBlock('spark', t('wall.noMoments'), t('wall.noMomentsText'))}</section>`;
  }
  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">${t('wall.moments')}</h2>
      <p class="card-sub">${t('wall.momentsHint')}</p>
    </div></div>
    ${moments.map(entry => `<div class="moment">
      <span class="moment-date">${escapeHtml(entry.date)}</span>
      <span class="moment-body">
        ${(entry.activities || []).map(tag => `<span class="pill" style="font-size:11px">${escapeHtml(tagLabel(tag))}</span>`).join(' ')}
        <div style="margin-top:6px;color:var(--text-2)">${escapeHtml(entry.note || '—')}</div>
        <div class="link-meta" style="margin-top:4px">${t('wall.momentValues', { social: round(entry.social, 1), joy: round(entry.joy, 1) })}</div>
      </span>
    </div>`).join('')}
    <p class="card-note">${t('wall.momentsNote')}</p>
  </section>`;
}

function wire(container, app) {
}
