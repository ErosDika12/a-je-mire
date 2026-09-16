import { icon, toast, openModal, closeLayer, formatDateLong } from '../ui.js';
import { escapeHtml } from '../chart.js';
import { exportToFile, importFromText } from '../storage.js';
import { allTags } from '../patterns.js';

export function renderData(container, app) {
  const profile = app.profile;
  const checkins = profile.checkins;
  const withNotes = checkins.filter(entry => String(entry.note || '').trim() !== '').length;

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Të dhënat e mia</h1>
      <p class="page-sub">Gjithçka që ruan ky aplikacion, në një vend. Nën kontrollin tënd.</p>
    </header>

    <section class="card">
      <div class="card-head"><div>
        <h2 class="card-title">Përmbledhje</h2>
        <p class="card-sub">E lexueshme nga njeriu, jo kod</p>
      </div>
      <span class="pill ${profile.mode === 'demo' ? 'pill-lav' : 'pill-accent'}">
        ${icon(profile.mode === 'demo' ? 'spark' : 'shield', 13)}
        ${profile.mode === 'demo' ? 'Profil sintetik demo' : 'Profil privat'}
      </span></div>
      <dl>
        ${row('Check-ins të ruajtura', `${checkins.length}`)}
        ${row('Periudha', checkins.length ? `${formatDateLong(checkins[0].date)} — ${formatDateLong(checkins[checkins.length - 1].date)}` : '—')}
        ${row('Ditë me shënim', `${withNotes}`)}
        ${row('Tags të ndryshme', `${allTags(checkins).length}`)}
        ${row('Persona në MY 5', `${(profile.my5 || []).length}`)}
        ${row('Lidhje të shënuara', `${(profile.connections || []).length}`)}
        ${row('Ruajtja lokale', profile.consent.store ? 'e pranuar' : 'e ndaluar')}
        ${row('Ndihma për tekstin', profile.consent.ai ? 'e pranuar' : 'e ndaluar')}
        ${row('Pranuar më', profile.consent.acceptedAt ? formatDateLong(profile.consent.acceptedAt.slice(0, 10)) : '—')}
        ${row('Çelësi në localStorage', 'ajemire.v1')}
      </dl>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Eksport dhe import</h2>
        <p class="card-sub">Fajll JSON, drejt e në pajisjen tënde</p>
      </div></div>
      <div class="row">
        <button type="button" class="btn" data-export>${icon('download', 16)} Eksporto si fajll</button>
        <button type="button" class="btn" data-import>${icon('upload', 16)} Importo nga fajll</button>
        <input type="file" id="import-file" accept="application/json,.json" class="sr-only"
               aria-label="Zgjidh një fajll JSON për import" tabindex="-1">
      </div>
      <div id="import-report" style="margin-top:var(--s4)"></div>
      <p class="card-note">Importi kontrollohet para se të pranohet: datat, kufijtë e vlerave dhe rreshtat e dyfishtë. Rreshtat e gabuar nuk bëhen zero — thjesht nuk merren, dhe raportohen.</p>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">Profili</h2>
        <p class="card-sub">Ndërro mes demos sintetike dhe një profili privat bosh</p>
      </div></div>
      <div class="row">
        <button type="button" class="btn" data-reset-demo>${icon('refresh', 16)} Rinis demon sintetike</button>
        <button type="button" class="btn" data-fresh>${icon('shield', 16)} Nis profil privat bosh</button>
      </div>
      <p class="card-note">Të dyja i zëvendësojnë të dhënat aktuale në këtë pajisje. Eksporto më parë nëse do t'i mbash.</p>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <details class="collapse">
        <summary>${icon('database', 16)} Të dhënat e papërpunuara (JSON)</summary>
        <div class="collapse-body">
          <pre class="json" id="data-json"></pre>
        </div>
      </details>
    </section>

    <section class="card" style="margin-top:var(--s4);border-color:color-mix(in srgb, var(--signal) 35%, var(--border))">
      <div class="card-head"><div>
        <h2 class="card-title">Fshij gjithçka</h2>
        <p class="card-sub">Pastron localStorage dhe të kthen te ekrani i consent-it</p>
      </div></div>
      <button type="button" class="btn btn-danger" data-delete>${icon('trash', 16)} Fshij gjithçka</button>
    </section>`;

  // textContent, jo innerHTML: JSON-i përmban tekst të shkruar nga përdoruesi.
  container.querySelector('#data-json').textContent = JSON.stringify(profile, null, 2);
  wire(container, app);
}

function row(label, value) {
  return `<div class="data-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function confirmDialog(title, body, confirmLabel, onConfirm) {
  const panel = openModal(title, `
    <p style="color:var(--text-2);font-size:var(--fs-sm)">${body}</p>
    <div class="row" style="justify-content:flex-end;margin-top:var(--s5)">
      <button type="button" class="btn" data-cancel>Anulo</button>
      <button type="button" class="btn btn-danger" data-confirm>${confirmLabel}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', () => { closeLayer(); onConfirm(); });
}

function wire(container, app) {
  container.querySelector('[data-export]').addEventListener('click', () => {
    exportToFile(app.profile);
    toast('Fajlli u shkarkua', 'ok');
  });

  const fileInput = container.querySelector('#import-file');
  container.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const report = container.querySelector('#import-report');
    report.innerHTML = `<p class="status">${icon('refresh', 14)} Po lexohet ${escapeHtml(file.name)}…</p>`;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importFromText(String(reader.result));
      showImportResult(report, result, app, container);
      fileInput.value = '';
    };
    reader.onerror = () => {
      report.innerHTML = `<p class="warn">${icon('info', 14)} Fajlli nuk u lexua dot.</p>`;
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  container.querySelector('[data-reset-demo]').addEventListener('click', () => {
    confirmDialog('Rinis demon sintetike',
      'Të dhënat aktuale në këtë pajisje do të zëvendësohen me profilin sintetik 30-ditor.',
      `${icon('refresh', 15)} Rinis demon`,
      () => { app.resetToDemo(); toast('Demoja sintetike u rindërtua', 'ok'); });
  });

  container.querySelector('[data-fresh]').addEventListener('click', () => {
    confirmDialog('Nis profil privat bosh',
      'Të dhënat aktuale do të zëvendësohen me një profil bosh. Baseline-i do të nisë nga zero.',
      `${icon('shield', 15)} Nis bosh`,
      () => { app.resetToPrivate(); toast('Profili privat u nis', 'ok'); });
  });

  container.querySelector('[data-delete]').addEventListener('click', () => {
    confirmDialog('Fshij gjithçka',
      'Kjo heq të gjitha check-ins, MY 5 dhe lidhjet nga kjo pajisje. Nuk kthehen. Do të kthehesh te ekrani i consent-it.',
      `${icon('trash', 15)} Fshij përfundimisht`,
      () => { app.deleteEverything(); });
  });
}

function showImportResult(report, result, app, container) {
  if (!result.ok) {
    report.innerHTML = `<div class="card card-soft">
      <p class="warn">${icon('info', 14)} Importi nuk u pranua.</p>
      <ul class="facts" style="margin-top:var(--s3)">
        ${result.errors.map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('close', 14)}</span><span>${escapeHtml(text)}</span></li>`).join('')}
      </ul>
    </div>`;
    toast('Fajlli nuk kaloi kontrollin', 'err');
    return;
  }

  const count = result.profile.checkins.length;
  report.innerHTML = `<div class="card card-soft">
    <p style="font-size:var(--fs-sm)"><strong>${count}</strong> check-ins të vlefshme u gjetën
      ${result.warnings.length ? `, me ${result.warnings.length} vërejtje` : ''}.</p>
    ${result.warnings.length ? `<details class="collapse" style="margin-top:var(--s3)">
      <summary>Shiko vërejtjet</summary>
      <div class="collapse-body"><ul class="facts">
        ${result.warnings.slice(0, 20).map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('info', 14)}</span><span>${escapeHtml(text)}</span></li>`).join('')}
      </ul></div></details>` : ''}
    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-confirm-import>${icon('check', 15)} Zëvendëso të dhënat e mia</button>
      <button type="button" class="btn" data-cancel-import>Anulo</button>
    </div>
  </div>`;

  report.querySelector('[data-cancel-import]').addEventListener('click', () => { report.innerHTML = ''; });
  report.querySelector('[data-confirm-import]').addEventListener('click', () => {
    app.replaceProfile(result.profile);
    toast(`${count} check-ins u importuan`, 'ok');
    renderData(container, app);
  });
}
