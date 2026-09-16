import { icon, toast, formatDateLong } from '../ui.js';
import { escapeHtml } from '../chart.js';
import { round } from '../stats.js';
import { METRIC_LABELS, MIN_DAYS, whatHelpsMe, tagLabel } from '../patterns.js';
import { weeklyReflection } from '../compose.js';
import { emptyBlock } from './dashboard.js';

const NOT_CAUSE = 'Ky është pattern në të dhënat e tua, jo shkak.';

export function renderHelps(container, app) {
  const profile = app.profile;
  const results = whatHelpsMe(profile.checkins);
  const reflection = weeklyReflection(profile);

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">What Helps Me?</h1>
      <p class="page-sub">Aktivitetet që janë shfaqur në ditët e tua më të mira, të renditura sipas provës në të dhënat e tua.</p>
    </header>
    ${profile.experiment ? experimentCard(profile.experiment) : ''}
    ${profile.checkins.length < MIN_DAYS.helps
      ? `<section class="card">${emptyBlock('spark', 'Ende pak ditë',
          `Duhen të paktën ${MIN_DAYS.helps} ditë me tags para se të renditen aktivitetet. Ke ${profile.checkins.length}.`)}
         <div class="row" style="justify-content:center"><button type="button" class="btn btn-primary" data-go="checkin">${icon('check', 16)} Bëj check-in</button></div>
        </section>`
      : results.length === 0
        ? `<section class="card">${emptyBlock('spark', 'Asnjë aktivitet me prova të mjaftueshme',
            `Çdo aktivitet duhet të shfaqet të paktën ${MIN_DAYS.tag} ditë me të dhe ${MIN_DAYS.tag} ditë pa të. Vazhdo të shënosh tags.`)}</section>`
        : resultsCard(results, profile)}
    ${reflectionCard(reflection)}`;

  wire(container, app, results);
}

function resultsCard(results, profile) {
  const largest = Math.max(...results.map(item => Math.abs(item.lift)));
  return `<section class="card">
    <div class="card-head"><div>
      <h2 class="card-title">Renditja sipas provës</h2>
      <p class="card-sub">Mesatarja në ditët me aktivitetin, minus mesatarja në ditët pa të</p>
    </div></div>
    ${results.map(item => helpRow(item, largest, profile)).join('')}
    <p class="card-note">${NOT_CAUSE} Renditja vjen nga numrat e tu, jo nga sugjerime të përgjithshme. Çdo rresht tregon mbi sa ditë është llogaritur.</p>
  </section>`;
}

function helpRow(item, largest, profile) {
  const good = item.goodness > 0;
  const width = (Math.abs(item.lift) / largest * 100).toFixed(0);
  const chosen = profile.experiment && profile.experiment.tag === item.tag;
  return `<div class="helps-row">
    <div class="helps-name">${escapeHtml(tagLabel(item.tag))}</div>
    <div class="helps-lift ${good ? '' : 'is-down'}">${item.lift > 0 ? '+' : '−'}${round(Math.abs(item.lift), 1)}</div>
    <div class="helps-bar"><i style="width:${width}%"></i></div>
    <div class="helps-meta">
      <span>${METRIC_LABELS[item.metric]}</span>
      <span>${item.daysWith} ditë me · ${item.daysWithout} pa</span>
      <span>${round(item.withMean, 1)} kundrejt ${round(item.withoutMean, 1)}</span>
    </div>
    <div class="helps-meta" style="align-items:center">
      <span style="flex:1;min-width:180px">Në ditët me "${escapeHtml(tagLabel(item.tag))}", ${METRIC_LABELS[item.metric].toLowerCase()} ishte mesatarisht ${round(Math.abs(item.lift), 1)} pikë ${item.lift > 0 ? 'më lart' : 'më poshtë'}.</span>
      <button type="button" class="btn btn-sm ${chosen ? 'btn-primary' : ''}" data-experiment="${escapeHtml(item.tag)}" data-metric="${item.metric}">
        ${chosen ? icon('check', 14) + ' Eksperimenti yt' : icon('spark', 14) + ' Provoje javën e ardhshme'}
      </button>
    </div>
  </div>`;
}

function experimentCard(experiment) {
  return `<section class="card" style="margin-bottom:var(--s4);border-color:var(--accent)">
    <div class="card-head">
      <span class="fact-ic">${icon('spark', 20)}</span>
      <div>
        <h2 class="card-title">Eksperimenti yt: ${escapeHtml(tagLabel(experiment.tag))}</h2>
        <p class="card-sub">Nisur më ${formatDateLong(experiment.startedAt)} · matja që po ndjek: ${METRIC_LABELS[experiment.metric]}</p>
      </div>
      <button type="button" class="btn btn-sm" data-clear-experiment>Hiqe</button>
    </div>
    <p style="color:var(--text-2);font-size:var(--fs-sm)">
      Shëno këtë tag te check-in-i kur ta bësh. Pas një jave numrat do ta tregojnë vetë nëse ndryshoi diçka — pa premtime paraprakisht.
    </p>
  </section>`;
}

function reflectionCard(reflection) {
  if (!reflection.enough) {
    return `<section class="card" style="margin-top:var(--s4)">${emptyBlock('edit', 'Reflektimi javor',
      `Shfaqet pas ${reflection.need} ditësh të shënuara. Ke ${reflection.days}.`)}</section>`;
  }
  const stable = reflection.stable.length
    ? reflection.stable.join(', ')
    : 'asnjë matje nuk qëndroi plotësisht e njëjtë';
  const moved = reflection.moved.length
    ? reflection.moved.map(item => `${item.label} ${item.down ? '↓' : '↑'} ${item.pct}%`).join(' · ')
    : 'asnjë matje nuk lëvizi mbi pragun';

  return `<section class="card" style="margin-top:var(--s4)">
    <div class="card-head"><div>
      <h2 class="card-title">Reflektimi javor</h2>
      <p class="card-sub">Ndërtuar lokalisht nga numrat e tu, me template të fiksuara</p>
    </div><span class="pill pill-lav">${icon('shield', 13)} Pa internet</span></div>

    <div class="stack">
      <div class="fact"><span class="fact-ic">${icon('check', 17)}</span>
        <span><strong>Qëndroi e njëjtë:</strong> ${escapeHtml(stable)}.</span></div>
      <div class="fact"><span class="fact-ic">${icon('shift', 17)}</span>
        <span><strong>Lëvizi:</strong> ${escapeHtml(moved)}.</span></div>
      <div class="fact"><span class="fact-ic">${icon('spark', 17)}</span>
        <span><strong>U shfaq në ditë më të mira:</strong> ${reflection.topHelp
          ? `${escapeHtml(tagLabel(reflection.topHelp.tag))} (${reflection.topHelp.daysWith} ditë)`
          : 'ende asnjë aktivitet me prova të mjaftueshme'}.</span></div>
    </div>

    <div class="card card-soft" style="margin-top:var(--s5)">
      <p class="sheet-title">Pyetje për të menduar</p>
      <p style="font-size:var(--fs-lg);line-height:1.45">${escapeHtml(reflection.question)}</p>
    </div>

    <div class="card card-soft" style="margin-top:var(--s3)">
      <p class="sheet-title">Një hap i vogël, opsional</p>
      <p style="color:var(--text-2);font-size:var(--fs-sm)">${escapeHtml(reflection.step)}</p>
    </div>

    <p class="card-note">Ky tekst ndërtohet nga numrat e llogaritur dhe fraza të fiksuara në kod. Nuk ka API të jashtme, nuk ka çelës, nuk del asgjë nga pajisja. E njëjta e dhënë jep gjithmonë të njëjtin tekst.</p>
  </section>`;
}

function wire(container, app, results) {
  for (const button of container.querySelectorAll('[data-go]')) {
    button.addEventListener('click', () => app.goTo(button.dataset.go));
  }
  for (const button of container.querySelectorAll('[data-experiment]')) {
    button.addEventListener('click', () => {
      const tag = button.dataset.experiment;
      const current = app.profile.experiment;
      if (current && current.tag === tag) {
        app.profile.experiment = null;
        toast('Eksperimenti u hoq');
      } else {
        app.profile.experiment = { tag, metric: button.dataset.metric, startedAt: app.today };
        toast(`"${tagLabel(tag)}" u zgjodh si eksperiment`, 'ok');
      }
      app.save();
      renderHelps(container, app);
    });
  }
  const clear = container.querySelector('[data-clear-experiment]');
  if (clear) {
    clear.addEventListener('click', () => {
      app.profile.experiment = null;
      app.save();
      toast('Eksperimenti u hoq');
      renderHelps(container, app);
    });
  }
}
