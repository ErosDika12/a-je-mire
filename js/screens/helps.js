import { icon, toast } from '../ui.js';
import { escapeHtml, fmtNum, fmtSigned, formatDateLong } from '../format.js';
import { METRIC_LABELS, MIN_DAYS, activityRanking, tagLabel } from '../patterns.js';
import { weeklyReflection } from '../compose.js';
import { noteKeywords } from '../nlp.js';
import { emptyState, sectionHead } from '../components.js';

let filter = 'all';

const FILTERS = {
  all: 'Të gjitha',
  frequent: 'Më të shpeshtat',
  largest: 'Dallimi më i madh'
};

export function renderHelps(container, app) {
  const profile = app.profile;
  const ranking = activityRanking(profile.checkins);

  container.innerHTML = `
    <header class="page-head">
      <span class="eyebrow">Aktivitetet dhe humori</span>
      <h1 class="page-title mt-2">What Helps Me?</h1>
      <p class="page-sub">Për çdo aktivitet: humori mesatar në ditët me të, minus humori mesatar në ditët pa të. Llogaritur vetëm nga ditët e tua.</p>
    </header>
    ${profile.experiment ? experimentCard(profile.experiment) : ''}
    <section class="card card-accent" aria-labelledby="rank-title">
      ${sectionHead('Renditja', 'Dallimi në humor sipas aktivitetit', `Shfaqen vetëm aktivitetet me të paktën ${MIN_DAYS.tag} ditë me to dhe ${MIN_DAYS.tag} pa to.`, '', 'rank-title')}
      ${rankingBody(profile, ranking)}
    </section>
    ${reflectionSection(profile)}`;

  wire(container, app, ranking);
}

function rankingBody(profile, ranking) {
  if (profile.checkins.length < MIN_DAYS.helps) {
    return emptyState('partial', 'Ende nuk ka të dhëna të mjaftueshme',
      `Renditja shfaqet pasi të regjistrohen të paktën ${MIN_DAYS.helps} ditë me aktivitete. Deri tani: ${profile.checkins.length}.`,
      { label: 'Bëj check-in', go: 'checkin' });
  }
  if (ranking.length === 0) {
    return emptyState('tags', 'Asnjë aktivitet me mjaft ditë',
      `Çdo aktivitet duhet të shfaqet të paktën ${MIN_DAYS.tag} ditë me të dhe ${MIN_DAYS.tag} ditë pa të. Vazhdo t'i shënosh te check-in-i.`,
      { label: 'Bëj check-in', go: 'checkin' });
  }
  return `<div class="seg-control" role="group" aria-label="Rendit aktivitetet">
      ${Object.entries(FILTERS).map(([key, label]) => `<button type="button" data-filter="${key}" aria-pressed="${key === filter}">${label}</button>`).join('')}
    </div>
    <div class="rank-list mt-4" id="rank-list" aria-live="polite">${rankRows(sorted(ranking), profile)}</div>
    <p class="card-note">Ky është pattern në të dhënat e tua, jo shkak. Një aktivitet këtu nuk është trajtim as zgjidhje — tregon vetëm se si ishin numrat në ato ditë.</p>`;
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
      <div class="diverge" role="img" aria-label="${escapeHtml(`${name}: dallim ${fmtSigned(item.lift)} në humor`)}"><i class="${up ? 'is-up' : 'is-down'}" style="${barStyle}"></i></div>
      <div class="rank-meta"><span>${item.daysWith} ditë me të</span><span>${item.daysWithout} ditë pa të</span></div>
      <p class="small muted mt-2">Në ditët me "${escapeHtml(name)}", humori mesatar ishte ${fmtNum(item.withMean)}; në ditët pa të, ${fmtNum(item.withoutMean)}.</p>
      <button type="button" class="btn btn-sm mt-3${chosen ? ' is-done' : ''}" data-experiment="${escapeHtml(item.tag)}">
        ${icon(chosen ? 'check' : 'spark', 14)} ${chosen ? 'Eksperimenti yt' : 'Zgjidhe si eksperiment për javën'}
      </button>
    </div>`;
  }).join('');
}

function experimentCard(experiment) {
  return `<section class="card card-lav" style="margin-bottom:var(--s4)">
    <div class="card-head">
      <div>
        <span class="eyebrow">Eksperimenti yt</span>
        <h2 class="card-title">${escapeHtml(tagLabel(experiment.tag))}</h2>
        <p class="card-sub">Nisur më ${escapeHtml(formatDateLong(experiment.startedAt))} · matja që ndiqet: ${METRIC_LABELS.mood}</p>
      </div>
      <button type="button" class="btn btn-sm" data-clear-experiment>Hiqe</button>
    </div>
    <p class="muted small">Shëno këtë aktivitet te check-in-i kur e bën. Pas një jave numrat e tregojnë vetë nëse ndryshoi diçka.</p>
  </section>`;
}

function reflectionSection(profile) {
  const reflection = weeklyReflection(profile);
  return `<section class="panel mt-4" aria-labelledby="reflect-title">
    <span class="eyebrow">Seksion i veçantë · ndërtuar lokalisht</span>
    <h2 class="card-title" id="reflect-title">Reflektimi javor dhe fjalët e shënimeve</h2>
    <div class="g-12 mt-4">
      <div class="card span-7">${reflectionBody(reflection)}</div>
      <div class="card span-5">${keywordBody(profile)}</div>
    </div>
  </section>`;
}

function reflectionBody(reflection) {
  if (!reflection.enough) {
    return emptyState('partial', 'Ende nuk ka të dhëna të mjaftueshme',
      `Reflektimi javor shfaqet pasi të regjistrohen të paktën ${reflection.need} ditë. Deri tani: ${reflection.days}.`);
  }
  const stable = reflection.stable.length ? reflection.stable.join(', ') : 'asnjë matje nuk qëndroi krejt e njëjtë';
  const moved = reflection.moved.length
    ? reflection.moved.map(item => `${item.label} ${item.down ? '↓' : '↑'} ${item.pct}%`).join(' · ')
    : 'asnjë matje nuk kaloi pragun';
  const help = reflection.topHelp
    ? `${tagLabel(reflection.topHelp.tag)} (${reflection.topHelp.daysWith} ditë)`
    : 'ende asnjë aktivitet me mjaft ditë';
  return `<span class="eyebrow">Reflektimi javor</span>
    <ul class="facts mt-3">
      <li class="fact"><span class="fact-ic">${icon('check', 16)}</span><span><strong>Qëndroi afër normales:</strong> ${escapeHtml(stable)}.</span></li>
      <li class="fact"><span class="fact-ic">${icon('shift', 16)}</span><span><strong>Kaloi pragun:</strong> ${escapeHtml(moved)}.</span></li>
      <li class="fact"><span class="fact-ic">${icon('spark', 16)}</span><span><strong>U shfaq në ditë me numra më të lartë:</strong> ${escapeHtml(help)}.</span></li>
    </ul>
    <div class="divider"></div>
    <span class="eyebrow">Pyetje për të menduar</span>
    <p class="summary-sentence" style="font-size:var(--fs-md)">${escapeHtml(reflection.question)}</p>
    <span class="eyebrow mt-4">Hap i vogël, opsional</span>
    <p class="small muted mt-2">${escapeHtml(reflection.step)}</p>
    <p class="card-note">Ndërtuar nga numrat e llogaritur dhe fraza të fiksuara në kod. Pa internet, pa API. E njëjta e dhënë jep gjithmonë të njëjtin tekst.</p>`;
}

function keywordBody(profile) {
  const keywords = noteKeywords(profile.checkins, profile.settings, 'mood');
  if (!keywords) {
    return `<span class="eyebrow">Fjalët e shënimeve</span>` + emptyState('words', 'Ende nuk ka mjaft shënime',
      `Krahasimi i fjalëve kërkon të paktën ${MIN_DAYS.tag} shënime në ditë mbi normalen dhe ${MIN_DAYS.tag} nën të.`);
  }
  const list = items => (items.length
    ? items.map(item => `<span class="pill">${escapeHtml(item.word)} · ${item.count}</span>`).join(' ')
    : '<span class="tiny">asnjë fjalë e veçantë</span>');
  return `<span class="eyebrow">Fjalët e shënimeve</span>
    <p class="small muted mt-2">Fjalët që shfaqen vetëm në njërin grup ditësh, sipas humorit krahasuar me normalen.</p>
    <p class="small mt-4"><strong>Ditë mbi normalen</strong> · ${keywords.aboveDays}</p>
    <div class="tag-wrap mt-2">${list(keywords.onlyAbove)}</div>
    <p class="small mt-4"><strong>Ditë nën normalen</strong> · ${keywords.belowDays}</p>
    <div class="tag-wrap mt-2">${list(keywords.onlyBelow)}</div>
    <p class="card-note">Ky është pattern në të dhënat e tua, jo shkak. Fjalët numërohen lokalisht dhe nuk dërgohen askund.</p>`;
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
  toast(tag ? `"${tagLabel(tag)}" u zgjodh si eksperiment` : 'Eksperimenti u hoq', tag ? 'ok' : 'info');
  app.rerender();
}
