import { icon, greeting, formatDateLong, mountChartTips } from '../ui.js';
import { constellation, trendChart, ringProgress, escapeHtml } from '../chart.js';
import { mean, round } from '../stats.js';
import {
  METRIC_LABELS, MIN_DAYS, baselineProgress, somethingChanged,
  metricValues, myNormal, whatHelpsMe
} from '../patterns.js';

export function renderDashboard(container, app) {
  const profile = app.profile;
  const checkins = profile.checkins;
  const todayEntry = checkins.find(entry => entry.date === app.today) || null;
  const progress = baselineProgress(checkins, profile.settings);
  const changed = somethingChanged(checkins, profile.settings);

  container.innerHTML = `
    ${heroCard(profile, todayEntry, app)}
    <div class="grid grid-2" style="margin-top:var(--s4)">
      ${baselineCard(progress, profile)}
      ${trendCard(profile)}
    </div>
    <div class="grid grid-2" style="margin-top:var(--s4)">
      ${changeCard(changed, progress)}
      ${nextStepCard(profile, changed)}
    </div>
    <div class="card card-soft row" style="margin-top:var(--s4);gap:var(--s3)">
      <span class="fact-ic">${icon('shield', 18)}</span>
      <p style="flex:1;min-width:200px;color:var(--text-2);font-size:var(--fs-sm)">
        Të dhënat rrinë vetëm në këtë shfletues. Pa llogari, pa server, pa dërgim automatik.
      </p>
      <button type="button" class="btn btn-sm" data-go="data">${icon('database', 15)} Të dhënat e mia</button>
    </div>`;

  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
  const tourButton = container.querySelector('[data-tour]');
  if (tourButton) tourButton.addEventListener('click', () => app.startTour());
  mountChartTips(container);
}

function heroCard(profile, todayEntry, app) {
  const done = Boolean(todayEntry);
  const modeLine = profile.mode === 'demo'
    ? `<span class="pill pill-lav">${icon('spark', 13)} Profil sintetik demo</span>`
    : `<span class="pill pill-accent">${icon('shield', 13)} Profil privat</span>`;

  const title = done
    ? 'Check-in-i i sotëm është ruajtur.'
    : profile.checkins.length === 0
      ? 'Le të fillojmë me check-in-in e parë.'
      : 'Nuk ke bërë ende check-in sot.';

  const text = done
    ? `E ke shënuar ditën e sotme më ${formatDateLong(app.today)}. Mund ta ndryshosh sa herë të duash.`
    : 'Gjashtë rrëshqitës, nën njëzet sekonda. Sa më shumë ditë, aq më i saktë bëhet patterni yt.';

  return `<section class="hero">
    ${constellation()}
    <div class="hero-body">
      <p class="hero-greet">${greeting()}</p>
      <h2 class="hero-title">${title}</h2>
      <p class="hero-text">${text}</p>
      <div class="hero-actions">
        <button type="button" class="btn btn-primary" data-go="checkin">
          ${icon(done ? 'edit' : 'check', 16)} ${done ? 'Ndrysho check-in-in' : 'Bëj check-in'}
        </button>
        <button type="button" class="btn" data-tour>${icon('play', 15)} Prezantim i udhëhequr</button>
      </div>
      <div class="row" style="margin-top:var(--s4)">
        ${modeLine}
        <span class="pill">${icon('calendar', 13)} ${profile.checkins.length} ditë të shënuara</span>
      </div>
    </div>
  </section>`;
}

function baselineCard(progress, profile) {
  const ratioText = `${progress.have}/${progress.need}`;
  const state = progress.full
    ? 'Baseline-i është i plotë. Krahasimet janë në fuqi.'
    : progress.ready
      ? 'Ka mjaftueshëm ditë për krahasim. Sa më shumë ditë, aq më i qëndrueshëm baseline-i.'
      : `Duhen edhe ${Math.max(0, MIN_DAYS.change - progress.have)} ditë para se të fillojnë krahasimet.`;

  return `<section class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">Ndërtimi i baseline-it</h3>
        <p class="card-sub">${profile.settings.baselineDays} ditë bazë + ${profile.settings.recentDays} ditë të fundit</p>
      </div>
    </div>
    <div class="row" style="gap:var(--s5);align-items:center">
      ${ringProgress(progress.ratio, ratioText, 'ditë')}
      <p style="flex:1;min-width:150px;color:var(--text-2);font-size:var(--fs-sm)">${state}</p>
    </div>
  </section>`;
}

function trendCard(profile) {
  const checkins = profile.checkins;
  if (checkins.length < 3) {
    return `<section class="card">${emptyBlock('pulse', 'Trendi 7-ditor',
      'Grafiku shfaqet pasi të kesh të paktën tre ditë të shënuara.')}</section>`;
  }
  const normal = myNormal(checkins, profile.settings);
  const window = checkins.slice(-14);
  return `<section class="card">
    <div class="card-head">
      <div>
        <h3 class="card-title">Humori — 14 ditët e fundit</h3>
        <p class="card-sub">Vija e ndërprerë është normalja jote</p>
      </div>
      <span class="pill pill-cyan">${round(mean(metricValues(window, 'mood')), 1)} mesatarja</span>
    </div>
    ${trendChart({
      values: metricValues(window, 'mood'),
      dates: window.map(entry => entry.date),
      recentCount: Math.min(profile.settings.recentDays, window.length - 1),
      baseline: normal.mood,
      height: 160,
      alt: 'Humori gjatë 14 ditëve të fundit, me vijë të ndërprerë në nivelin e normales sate'
    })}
    <p class="card-note">Teksti alternativ: humori mesatar ${round(mean(metricValues(window, 'mood')), 1)} gjatë ${window.length} ditëve; normalja jote ${round(normal.mood, 1)}.</p>
  </section>`;
}

function changeCard(changed, progress) {
  if (!progress.ready) {
    return `<section class="card">${emptyBlock('shift', 'Something Changed',
      'Ende nuk ka ditë të mjaftueshme për të krahasuar dy periudha. Vazhdo check-in-in.')}</section>`;
  }
  if (!changed.signal) {
    return `<section class="card">
      <div class="card-head"><div>
        <h3 class="card-title">Asnjë sinjal këtë javë</h3>
        <p class="card-sub">Gjashtë matjet qëndrojnë afër patternit tënd</p>
      </div><span class="pill pill-accent">${icon('check', 13)} E qetë</span></div>
      <p style="color:var(--text-2);font-size:var(--fs-sm)">Sinjali shfaqet vetëm kur dy ose më shumë matje lëvizin njëkohësisht. Një e vetme është zhurmë.</p>
      <button type="button" class="btn btn-sm" style="margin-top:var(--s4)" data-go="changed">Shiko të gjashtë matjet</button>
    </section>`;
  }
  const top = changed.flagged[0];
  const down = top.pct < 0;
  return `<section class="card">
    <div class="card-head"><div>
      <h3 class="card-title">Ndryshimi kryesor</h3>
      <p class="card-sub">${changed.flagged.length} nga 6 matjet lëvizën më shumë se zakonisht</p>
    </div><span class="pill pill-signal"><span class="pill-dot"></span>Sinjal</span></div>
    <div class="factor">
      <div class="factor-head">
        <span class="factor-name">${METRIC_LABELS[top.metric]}</span>
        <span class="factor-pct" style="color:var(--signal)">${down ? '↓' : '↑'} ${Math.abs(Math.round(top.pct))}%</span>
      </div>
      <div class="factor-track"><div class="factor-fill" style="--w:100%"></div></div>
      <div class="factor-detail">
        <span>normalja ${round(top.base, 1)}</span><span>7 ditët e fundit ${round(top.recent, 1)}</span>
      </div>
    </div>
    <button type="button" class="btn btn-sm" style="margin-top:var(--s3)" data-go="changed">Shiko të gjithë faktorët</button>
  </section>`;
}

function nextStepCard(profile, changed) {
  const helps = whatHelpsMe(profile.checkins);
  const top = helps[0];
  const socialMoved = changed.flagged.some(factor => factor.metric === 'social');

  let body;
  let target = 'helps';
  if (socialMoved && (profile.my5 || []).length > 0) {
    body = 'Lidhja sociale ka lëvizur nën patternin tënd. KAFE? mund të të ndihmojë të përgatitësh një hap të vogël — ti vendos nëse e dërgon.';
    target = 'kafe';
  } else if (top) {
    body = `Në të dhënat e tua, ditët me "${escapeHtml(top.tag)}" kanë pasur ${METRIC_LABELS[top.metric].toLowerCase()} mesatarisht ${round(Math.abs(top.lift), 1)} pikë ndryshe nga ditët pa të.`;
  } else if (profile.checkins.length < MIN_DAYS.helps) {
    body = `Pas ${MIN_DAYS.helps} ditësh fillojnë të duken aktivitetet që shoqërohen me ditë më të mira.`;
    target = 'checkin';
  } else {
    body = 'Ende nuk ka një aktivitet me mjaft ditë pas vetes për ta veçuar. Vazhdo të shënosh tags.';
    target = 'checkin';
  }

  return `<section class="card">
    <div class="card-head"><div>
      <h3 class="card-title">Hapi i radhës</h3>
      <p class="card-sub">Sugjerim opsional, i llogaritur nga të dhënat e tua</p>
    </div></div>
    <p style="color:var(--text-2);font-size:var(--fs-sm)">${body}</p>
    <button type="button" class="btn btn-sm" style="margin-top:var(--s4)" data-go="${target}">
      ${icon('next', 15)} Vazhdo
    </button>
  </section>`;
}

export function emptyBlock(iconName, title, text) {
  return `<div class="empty">
    <div class="empty-ic">${icon(iconName, 24)}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
  </div>`;
}
