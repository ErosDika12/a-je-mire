import { icon, toast } from '../ui.js';
import { escapeHtml, fmtNum, fmtSigned, formatDateLong } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, activityRanking, tagLabel } from '../patterns.js';
import { weeklyReflection } from '../compose.js';
import { noteKeywords } from '../nlp.js';
import { emptyState, sectionHead } from '../components.js';
import { t } from '../i18n/index.js';

let filter = 'all';

const FILTERS = { all: 'helps.fAll', frequent: 'helps.fFrequent', largest: 'helps.fLargest' };

export function renderHelps(container, app) {
  const profile = app.profile;
  const ranking = activityRanking(profile.checkins);

  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">${t('helps.eyebrow')}</span>
      <h1 class="page-title mt-2">${t('helps.title')}</h1>
      <p class="page-sub">${t('helps.subtitle')}</p>
    </header>
    ${profile.experiment ? experimentCard(profile.experiment) : ''}
    <section class="card card-accent" aria-labelledby="rank-title">
      ${sectionHead(t('helps.rankEyebrow'), t('helps.rankTitle'), t('helps.rankMeta', { n: MIN_DAYS.tag }), '', 'rank-title')}
      ${rankingBody(profile, ranking)}
    </section>
    ${reflectionSection(profile)}`;

  wire(container, app, ranking);
}

function rankingBody(profile, ranking) {
  if (profile.checkins.length < MIN_DAYS.helps) {
    return emptyState('partial', t('helps.notEnough'),
      t('helps.need', { n: MIN_DAYS.helps, have: profile.checkins.length }),
      { label: t('helps.checkin'), go: 'checkin' });
  }
  if (ranking.length === 0) {
    return emptyState('tags', t('helps.noActivity'),
      t('helps.noActivityText', { n: MIN_DAYS.tag }),
      { label: t('helps.checkin'), go: 'checkin' });
  }
  return `<div class="seg-control" role="group" aria-label="${t('helps.sortLabel')}">
      ${Object.entries(FILTERS).map(([key, label]) => `<button type="button" data-filter="${key}" aria-pressed="${key === filter}">${t(label)}</button>`).join('')}
    </div>
    <div class="rank-list mt-4" id="rank-list" aria-live="polite">${rankRows(sorted(ranking), profile)}</div>
    <p class="card-note">${t('helps.rankNote')}</p>`;
}

function sorted(ranking) {
  const list = [...ranking];
  if (filter === 'frequent') return list.sort((left, right) => right.daysWith - left.daysWith || right.lift - left.lift);
  if (filter === 'largest') return list.sort((left, right) => Math.abs(right.lift) - Math.abs(left.lift));
  return list.sort((left, right) => right.lift - left.lift);
}

function rankRows(list, profile) {
  const largest = Math.max(...list.map(item => Math.abs(item.lift)), 0.01);
  return list.map((item, index) => {
    const half = (Math.abs(item.lift) / largest) * 50;
    const up = item.lift >= 0;
    const barStyle = up ? `width:${half.toFixed(1)}%` : `left:${(50 - half).toFixed(1)}%;width:${half.toFixed(1)}%`;
    const name = tagLabel(item.tag);
    const chosen = profile.experiment && profile.experiment.tag === item.tag;
    return `<div class="rank-row">
      <div class="rank-head">
        <span class="rank-pos">${index + 1}.</span>
        <span class="rank-name">${escapeHtml(name)}</span>
        <span class="rank-lift ${up ? 'is-up' : 'is-down'}">${fmtSigned(item.lift)}</span>
      </div>
      <div class="diverge" role="img" aria-label="${escapeHtml(t('helps.barLabel', { name, lift: fmtSigned(item.lift) }))}"><i class="${up ? 'is-up' : 'is-down'}" style="${barStyle}"></i></div>
      <div class="rank-meta"><span>${t('helps.daysWith', { n: item.daysWith })}</span><span>${t('helps.daysWithout', { n: item.daysWithout })}</span></div>
      <p class="small muted mt-2">${t('helps.rowText', { name: escapeHtml(name), with: fmtNum(item.withMean), without: fmtNum(item.withoutMean) })}</p>
      <button type="button" class="btn btn-sm mt-3${chosen ? ' is-done' : ''}" data-experiment="${escapeHtml(item.tag)}">
        ${icon(chosen ? 'check' : 'spark', 14)} ${chosen ? t('helps.yourExperiment') : t('helps.chooseExperiment')}
      </button>
    </div>`;
  }).join('');
}

function experimentCard(experiment) {
  return `<section class="card card-lav" style="margin-bottom:var(--s4)">
    <div class="card-head">
      <div>
        <span class="eyebrow">${t('helps.yourExperiment')}</span>
        <h2 class="card-title">${escapeHtml(tagLabel(experiment.tag))}</h2>
        <p class="card-sub">${t('helps.started', { date: escapeHtml(formatDateLong(experiment.startedAt)), metric: METRIC_LABELS.mood })}</p>
      </div>
      <button type="button" class="btn btn-sm" data-clear-experiment>${t('helps.remove')}</button>
    </div>
    <p class="muted small">${t('helps.experimentHint')}</p>
  </section>`;
}

function reflectionSection(profile) {
  const reflection = weeklyReflection(profile);
  return `<section class="panel mt-4" aria-labelledby="reflect-title">
    <span class="eyebrow">${t('helps.reflectEyebrow')}</span>
    <h2 class="card-title" id="reflect-title">${t('helps.reflectTitle')}</h2>
    <div class="g-12 mt-4">
      <div class="card span-7">${reflectionBody(reflection)}</div>
      <div class="card span-5">${keywordBody(profile)}</div>
    </div>
  </section>`;
}

function reflectionBody(reflection) {
  if (!reflection.enough) {
    return emptyState('partial', t('helps.notEnough'),
      t('helps.reflectNeed', { n: reflection.need, have: reflection.days }));
  }
  const stable = reflection.stable.length ? reflection.stable.join(', ') : t('helps.noneStable');
  const moved = reflection.moved.length
    ? reflection.moved.map(item => `${item.label} ${item.down ? '↓' : '↑'} ${item.pct}%`).join(' · ')
    : t('helps.noneMoved');
  const help = reflection.topHelp
    ? t('helps.helpDays', { name: tagLabel(reflection.topHelp.tag), n: reflection.topHelp.daysWith })
    : t('helps.noHelp');
  return `<span class="eyebrow">${t('helps.weekly')}</span>
    <ul class="facts mt-3">
      <li class="fact"><span class="fact-ic">${icon('check', 16)}</span><span><strong>${t('helps.stayed')}</strong> ${escapeHtml(stable)}.</span></li>
      <li class="fact"><span class="fact-ic">${icon('shift', 16)}</span><span><strong>${t('helps.crossed')}</strong> ${escapeHtml(moved)}.</span></li>
      <li class="fact"><span class="fact-ic">${icon('spark', 16)}</span><span><strong>${t('helps.higherDays')}</strong> ${escapeHtml(help)}.</span></li>
    </ul>
    <div class="divider"></div>
    <span class="eyebrow">${t('helps.question')}</span>
    <p class="summary-sentence" style="font-size:var(--fs-md)">${escapeHtml(reflection.question)}</p>
    <span class="eyebrow mt-4">${t('helps.step')}</span>
    <p class="small muted mt-2">${escapeHtml(reflection.step)}</p>
    <p class="card-note">${t('helps.builtNote')}</p>`;
}

function keywordBody(profile) {
  const keywords = noteKeywords(profile.checkins, profile.settings, 'mood');
  if (!keywords) {
    return `<span class="eyebrow">${t('helps.words')}</span>` + emptyState('words', t('helps.wordsEmpty'),
      t('helps.wordsNeed', { n: MIN_DAYS.tag }));
  }
  const list = items => (items.length
    ? items.map(item => `<span class="pill">${escapeHtml(item.word)} · ${item.count}</span>`).join(' ')
    : `<span class="tiny">${t('helps.noWord')}</span>`);
  return `<span class="eyebrow">${t('helps.words')}</span>
    <p class="small muted mt-2">${t('helps.wordsHint')}</p>
    <p class="small mt-4"><strong>${t('helps.above')}</strong> · ${keywords.aboveDays}</p>
    <div class="tag-wrap mt-2">${list(keywords.onlyAbove)}</div>
    <p class="small mt-4"><strong>${t('helps.below')}</strong> · ${keywords.belowDays}</p>
    <div class="tag-wrap mt-2">${list(keywords.onlyBelow)}</div>
    <p class="card-note">${t('helps.wordsNote')}</p>`;
}

function wire(container, app, ranking) {
  for (const button of container.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () => {
      if (button.dataset.filter === filter) return;
      filter = button.dataset.filter;
      for (const item of container.querySelectorAll('[data-filter]')) {
        item.setAttribute('aria-pressed', String(item.dataset.filter === filter));
      }
      const list = container.querySelector('#rank-list');
      list.classList.add('is-changing');
      setTimeout(() => {
        list.innerHTML = rankRows(sorted(ranking), app.profile);
        list.classList.remove('is-changing');
        wireExperiments(container, app);
      }, 120);
    });
  }
  wireExperiments(container, app);
  const clear = container.querySelector('[data-clear-experiment]');
  if (clear) clear.addEventListener('click', () => setExperiment(app, null));
}

function wireExperiments(container, app) {
  for (const button of container.querySelectorAll('[data-experiment]')) {
    button.addEventListener('click', () => {
      const tag = button.dataset.experiment;
      const current = app.profile.experiment;
      setExperiment(app, current && current.tag === tag ? null : tag);
    });
  }
}

function setExperiment(app, tag) {
  app.profile.experiment = tag ? { tag, metric: 'mood', startedAt: app.today } : null;
  app.save();
  toast(tag ? t('helps.chosen', { name: tagLabel(tag) }) : t('helps.cleared'), tag ? 'ok' : 'info');
  app.rerender();
}
