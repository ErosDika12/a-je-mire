import { icon, toast, openModal, closeLayer } from '../ui.js';
import { escapeHtml, formatDateLong } from '../format.js';
import { exportToFile, importFromText, saveLocalBackup, loadLocalBackup } from '../storage.js';
import { findConflicts, mergeProfiles } from '../merge.js';
import { recordActivity } from '../challenges.js';
import { allTags } from '../patterns.js';
import { t } from '../i18n/index.js';

export function renderData(container, app) {
  const profile = app.profile;
  const checkins = profile.checkins;
  const withNotes = checkins.filter(entry => String(entry.note || '').trim() !== '').length;

  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">${t('data.title')}</h1>
      <p class="page-sub">${t('data.subtitle')}</p>
    </header>

    <section class="card">
      <div class="card-head"><div>
        <h2 class="card-title">${t('data.summary')}</h2>
        <p class="card-sub">${t('data.summaryHint')}</p>
      </div>
      <span class="pill ${profile.mode === 'demo' ? 'pill-lav' : 'pill-accent'}">
        ${icon(profile.mode === 'demo' ? 'spark' : 'shield', 13)}
        ${profile.mode === 'demo' ? t('data.demo') : t('data.private')}
      </span></div>
      <dl>
        ${row(t('data.rCheckins'), `${checkins.length}`)}
        ${row(t('data.rPeriod'), checkins.length ? `${formatDateLong(checkins[0].date)} — ${formatDateLong(checkins[checkins.length - 1].date)}` : '—')}
        ${row(t('data.rNotes'), `${withNotes}`)}
        ${row(t('data.rTags'), `${allTags(checkins).length}`)}
        ${row(t('data.rMy5'), `${(profile.my5 || []).length}`)}
        ${row(t('data.rConnections'), `${(profile.connections || []).length}`)}
        ${row(t('data.rStore'), profile.consent.store ? t('data.granted') : t('data.denied'))}
        ${row(t('data.rTextHelp'), profile.consent.ai ? t('data.granted') : t('data.denied'))}
        ${row(t('data.rAccepted'), profile.consent.acceptedAt ? formatDateLong(profile.consent.acceptedAt.slice(0, 10)) : '—')}
        ${row(t('data.rKey'), 'ajemire.v1')}
      </dl>
      ${consentLogBlock(profile)}
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">${t('data.exportTitle')}</h2>
        <p class="card-sub">${t('data.exportHint')}</p>
      </div></div>
      <div class="row">
        <button type="button" class="btn" data-export>${icon('download', 16)} ${t('data.export')}</button>
        <button type="button" class="btn" data-import>${icon('upload', 16)} ${t('data.import')}</button>
        <input type="file" id="import-file" accept="application/json,.json" class="sr-only"
               aria-label="${t('data.pickFile')}" tabindex="-1">
      </div>
      <div id="import-report" style="margin-top:var(--s4)"></div>
      <p class="card-note">${t('data.importNote')}</p>
    </section>

    ${backupCard()}

    <section class="card" style="margin-top:var(--s4)">
      <div class="card-head"><div>
        <h2 class="card-title">${t('data.profile')}</h2>
        <p class="card-sub">${t('data.profileHint')}</p>
      </div></div>
      <div class="row">
        <button type="button" class="btn" data-reset-demo>${icon('refresh', 16)} ${t('data.resetDemo')}</button>
        <button type="button" class="btn" data-fresh>${icon('shield', 16)} ${t('data.fresh')}</button>
      </div>
      <p class="card-note">${t('data.profileNote')}</p>
    </section>

    <section class="card" style="margin-top:var(--s4)">
      <details class="collapse">
        <summary>${icon('database', 16)} ${t('data.raw')}</summary>
        <div class="collapse-body">
          <pre class="json" id="data-json" tabindex="0" aria-label="JSON"></pre>
        </div>
      </details>
    </section>

    <section class="card" style="margin-top:var(--s4);border-color:color-mix(in srgb, var(--signal) 35%, var(--border))">
      <div class="card-head"><div>
        <h2 class="card-title">${t('data.deleteTitle')}</h2>
        <p class="card-sub">${t('data.deleteHint')}</p>
      </div></div>
      <button type="button" class="btn btn-danger" data-delete>${icon('trash', 16)} ${t('data.deleteTitle')}</button>
    </section>`;

  // textContent, jo innerHTML: JSON-i përmban tekst të shkruar nga përdoruesi.
  container.querySelector('#data-json').textContent = JSON.stringify(profile, null, 2);
  wire(container, app);
}

const CONSENT_KINDS = ['local_storage', 'text_help', 'terms', 'privacy', 'cloud_backup', 'analytics', 'ai_assistant'];

function consentLogBlock(profile) {
  const log = profile.consentLog || [];
  if (log.length === 0) return '';
  return `<details class="collapse mt-4">
    <summary>${icon('doc', 16)} ${t('data.consentLog', { n: log.length })}</summary>
    <div class="collapse-body"><dl>
      ${log.slice().reverse().map(item => row(`${CONSENT_KINDS.includes(item.kind) ? t(`data.consent.${item.kind}`) : item.kind} · v${item.policyVersion}`,
        `${item.granted ? t('data.logGranted') : t('data.logRevoked')} · ${formatDateLong(item.at.slice(0, 10))}`)).join('')}
    </dl></div>
  </details>`;
}

function backupCard() {
  const backup = loadLocalBackup();
  if (!backup || !backup.profile) return '';
  return `<section class="card mt-4">
    <div class="card-head"><div>
      <h2 class="card-title">${t('data.backupTitle')}</h2>
      <p class="card-sub">${t('data.backupMeta', { n: backup.profile.checkins.length, date: escapeHtml(formatDateLong(backup.savedAt.slice(0, 10))) })}</p>
    </div></div>
    <button type="button" class="btn" data-restore-local>${icon('refresh', 16)} ${t('data.backupRestore')}</button>
    <p class="card-note">${t('data.backupNote')}</p>
  </section>`;
}

function row(label, value) {
  return `<div class="data-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function confirmDialog(title, body, confirmLabel, onConfirm) {
  const panel = openModal(title, `
    <p style="color:var(--text-2);font-size:var(--fs-sm)">${body}</p>
    <div class="row" style="justify-content:flex-end;margin-top:var(--s5)">
      <button type="button" class="btn" data-cancel>${t('data.cancel')}</button>
      <button type="button" class="btn btn-danger" data-confirm>${confirmLabel}</button>
    </div>`);
  panel.querySelector('[data-cancel]').addEventListener('click', closeLayer);
  panel.querySelector('[data-confirm]').addEventListener('click', () => { closeLayer(); onConfirm(); });
}

function wire(container, app) {
  container.querySelector('[data-export]').addEventListener('click', () => {
    const started = exportToFile(app.profile);
    // Eksporti regjistrohet si fakt (për sfidën "Eksporto një kopje"), pa asnjë përmbajtje.
    if (started) { recordActivity(app.profile, 'exports', app.today); app.save(); }
    toast(started ? t('data.exported') : t('data.exportBlocked'), started ? 'ok' : 'err');
  });

  const fileInput = container.querySelector('#import-file');
  container.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const report = container.querySelector('#import-report');
    report.innerHTML = `<p class="status">${icon('refresh', 14)} ${escapeHtml(t('data.reading', { name: file.name }))}</p>`;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importFromText(String(reader.result));
      showImportResult(report, result, app, container);
      fileInput.value = '';
    };
    reader.onerror = () => {
      report.innerHTML = `<p class="warn">${icon('info', 14)} ${t('data.readFailed')}</p>`;
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  container.querySelector('[data-reset-demo]').addEventListener('click', () => {
    confirmDialog(t('data.resetTitle'), t('data.resetText'),
      `${icon('refresh', 15)} ${t('data.resetButton')}`,
      () => { app.resetToDemo(); toast(t('data.resetDone'), 'ok'); });
  });

  container.querySelector('[data-fresh]').addEventListener('click', () => {
    confirmDialog(t('data.freshTitle'), t('data.freshText'),
      `${icon('shield', 15)} ${t('data.freshButton')}`,
      () => { app.resetToPrivate(); toast(t('data.freshDone'), 'ok'); });
  });

  const restore = container.querySelector('[data-restore-local]');
  if (restore) {
    restore.addEventListener('click', () => {
      confirmDialog(t('data.restoreTitle'), t('data.restoreText'),
        `${icon('refresh', 15)} ${t('data.restoreButton')}`,
        () => {
          const backup = loadLocalBackup();
          const current = app.profile;
          backup.profile.consent = { ...current.consent };
          backup.profile.sync = current.sync;
          saveLocalBackup(current);
          app.replaceProfile(backup.profile);
          toast(t('data.restored'), 'ok');
          renderData(container, app);
        });
    });
  }

  container.querySelector('[data-delete]').addEventListener('click', () => {
    confirmDialog(t('data.deleteTitle'), t('data.deleteText'),
      `${icon('trash', 15)} ${t('data.deleteButton')}`,
      () => { app.deleteEverything(); });
  });
}

function showImportResult(report, result, app, container) {
  if (!result.ok) {
    report.innerHTML = `<div class="card card-soft">
      <p class="warn">${icon('info', 14)} ${t('data.importRejected')}</p>
      <ul class="facts" style="margin-top:var(--s3)">
        ${result.errors.map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('close', 14)}</span><span>${escapeHtml(text)}</span></li>`).join('')}
      </ul>
    </div>`;
    toast(t('data.importFailed'), 'err');
    return;
  }

  const count = result.profile.checkins.length;
  const conflicts = findConflicts(app.profile, result.profile);
  report.innerHTML = `<div class="card card-soft">
    <p style="font-size:var(--fs-sm)">${t('data.found', { n: count, warnings: result.warnings.length ? t('data.withWarnings', { n: result.warnings.length }) : '' })}</p>
    ${result.warnings.length ? `<details class="collapse" style="margin-top:var(--s3)">
      <summary>${t('data.seeWarnings')}</summary>
      <div class="collapse-body"><ul class="facts">
        ${result.warnings.slice(0, 20).map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('info', 14)}</span><span>${escapeHtml(text)}</span></li>`).join('')}
      </ul></div></details>` : ''}
    ${conflicts.length ? `<p class="warn mt-3">${icon('info', 14)} ${conflicts.length === 1 ? t('data.conflictsOne') : t('data.conflictsMany', { n: conflicts.length })}</p>` : ''}
    <div class="row" style="margin-top:var(--s4)">
      <button type="button" class="btn btn-primary" data-merge-import>${icon('plus', 15)} ${t('data.merge')}</button>
      <button type="button" class="btn" data-confirm-import>${icon('refresh', 15)} ${t('data.replace')}</button>
      <button type="button" class="btn" data-cancel-import>${t('data.cancel')}</button>
    </div>
    <p class="card-note">${t('data.mergeNote')}</p>
  </div>`;

  report.querySelector('[data-cancel-import]').addEventListener('click', () => { report.innerHTML = ''; });
  report.querySelector('[data-merge-import]').addEventListener('click', () => {
    const { profile, summary } = mergeProfiles(app.profile, result.profile);
    profile.consent = { ...app.profile.consent };
    app.replaceProfile(profile);
    toast(t('data.merged', { n: summary.added, kept: summary.keptLocal ? t('data.keptLocal', { n: summary.keptLocal }) : '' }), 'ok');
    renderData(container, app);
  });
  report.querySelector('[data-confirm-import]').addEventListener('click', () => {
    saveLocalBackup(app.profile);
    // Pëlqimet dhe gjendja e sinkronizimit i përkasin kësaj pajisjeje, jo fajllit.
    result.profile.consentLog = app.profile.consentLog;
    result.profile.sync = app.profile.sync;
    app.replaceProfile(result.profile);
    toast(t('data.imported', { n: count }), 'ok');
    renderData(container, app);
  });
}
