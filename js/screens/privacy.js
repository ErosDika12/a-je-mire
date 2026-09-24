// Privatësia, Kushtet dhe Ndihma në një vend, me gjuhë të thjeshtë.
// Kontakti është vendmbajtës i shënuar qartë: pilotit nuk i shpikim kompani apo adresë.
import { icon, toast, copyText } from '../ui.js';
import { escapeHtml } from '../format.js';
import { POLICY_VERSION, recordConsent } from '../storage.js';
import { t, tList, getLang, LANGUAGES } from '../i18n/index.js';
import { APP_VERSION, setAnalyticsConsent } from '../analytics.js';
import { isEnabled } from '../flags.js';

export { APP_VERSION };

const CHANGELOG = [['2.1.0', '2026-09', 'v210'], ['2.0.0', '2026-09', 'v200'], ['1.1.0', '2026-08', 'v110'], ['1.0.0', '2026-07', 'v100']];

let tab = 'privacy';

export function renderPrivacy(container, app) {
  const tabs = [['privacy', t('privacy.tabPrivacy')], ['terms', t('privacy.tabTerms')], ['help', t('privacy.tabHelp')]];
  const reference = t('privacy.referenceNote');
  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">${t('privacy.title')}</h1>
      <p class="page-sub">${t('privacy.subtitle', { v: POLICY_VERSION })}</p>
      ${reference ? `<p class="small muted mt-2">${icon('info', 13)} ${reference}</p>` : ''}
    </header>
    <div class="seg-control" role="group" aria-label="${t('privacy.section')}">
      ${tabs.map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${tab === key}">${label}</button>`).join('')}
    </div>
    <div class="mt-4">${tab === 'privacy' ? privacyBody(app) : tab === 'terms' ? termsBody() : helpBody()}</div>`;

  for (const button of container.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => { tab = button.dataset.tab; renderPrivacy(container, app); });
  }
  if (tab === 'privacy') wireSettings(container, app);
  if (tab === 'help') wireHelp(container);
}

// keys: çelësat e privacy.* që shfaqen si pika; secila ka ikonën e vet.
function list(items, kind = '') {
  return `<ul class="facts">${items.map(([name, key, params]) =>
    `<li class="fact ${kind}"><span class="fact-ic">${icon(name, 15)}</span><span>${t(`privacy.${key}`, params)}</span></li>`).join('')}</ul>`;
}

function settingsCard(app) {
  const analytics = isEnabled('analytics');
  return `<section class="card card-accent">
    <h2 class="card-title">${t('privacy.settingsTitle')}</h2>
    <div class="field mt-3">
      <label for="ui-language">${t('privacy.language')}</label>
      <select id="ui-language">
        ${Object.keys(LANGUAGES).map(lang => `<option value="${lang}" ${lang === getLang() ? 'selected' : ''} lang="${lang}">${escapeHtml(LANGUAGES[lang].core.languageName)}</option>`).join('')}
      </select>
    </div>
    ${analytics ? `<label class="check-row mt-4"><input type="checkbox" id="analytics-consent" ${app.profile.settings.analytics ? 'checked' : ''}>
        <span><strong>${t('privacy.analytics')}</strong><span class="small muted" style="display:block">${t('privacy.analyticsHint')}</span></span></label>` : ''}
  </section>`;
}

function privacyBody(app) {
  return `
    ${settingsCard(app)}
    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.noAccountTitle')}</h2>
      <div class="mt-3">${list([['shield', 'noAccount1'], ['calendar', 'noAccount2'], ['close', 'noAccount3']])}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.accountTitle')}</h2>
      <div class="mt-3">${list([['doc', 'account1'], ['lock', 'account2'], ['info', 'account3'], ['cloud', 'account4'], ['upload', 'account5']])}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.socialTitle')}</h2>
      <div class="mt-3">${list([['users', 'social1'], ['shield', 'social2'], ['lock', 'social3'], ['calendar', 'social4'], ['spark', 'social5']])}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.neverTitle')}</h2>
      <div class="mt-3">${list([['close', 'never1'], ['close', 'never2'], ['close', 'never3'], ['close', 'never4'], ['close', 'never5'], ['close', 'never6']], 'fact-no')}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.controlTitle')}</h2>
      <div class="mt-3">${list([['download', 'control1'], ['trash', 'control2'], ['doc', 'control3', { n: (app.profile.consentLog || []).length }]])}</div>
    </section>

    <section class="card card-soft mt-4">
      <p class="small"><strong>${t('privacy.contactLabel')}</strong> ${escapeHtml(t('privacy.contact'))}</p>
      <p class="card-note">${t('privacy.pilotNote')}</p>
    </section>`;
}

function termsBody() {
  return `<section class="card">
    <h2 class="card-title">${t('privacy.termsTitle')}</h2>
    <ol class="terms mt-3">
      ${tList('privacy.terms').map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      <li>${escapeHtml(t('privacy.termsContact', { c: t('privacy.contact') }))}</li>
    </ol>
    <p class="card-note">${t('privacy.version', { v: POLICY_VERSION })}</p>
  </section>`;
}

function helpBody() {
  return `
    <section class="card">
      <h2 class="card-title">${t('privacy.faqTitle')}</h2>
      ${tList('privacy.faq').map(([question, answer], index) => `<details class="collapse${index === 0 ? ' mt-3' : ''}"><summary>${escapeHtml(question)}</summary>
        <div class="collapse-body muted small">${escapeHtml(answer)}</div></details>`).join('')}
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.changesTitle')}</h2>
      ${CHANGELOG.map(([version, date, key]) => `<div class="mt-3">
        <p><strong>${version}</strong> <span class="muted small">· ${date}</span></p>
        <ul class="changelog">${tList(`privacy.changelog.${key}`).map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
      </div>`).join('')}
    </section>

    <section class="card mt-4">
      <h2 class="card-title">${t('privacy.reportTitle')}</h2>
      <p class="warn mt-2">${icon('info', 14)} ${t('privacy.reportWarn')}</p>
      <div class="field mt-3">
        <label for="report-text">${t('privacy.reportLabel')} <span class="field-hint">${t('privacy.reportHint')}</span></label>
        <textarea id="report-text" rows="4" maxlength="1000"></textarea>
      </div>
      <button type="button" class="btn btn-primary mt-3" data-copy-report>${icon('copy', 16)} ${t('privacy.copyReport')}</button>
      <p class="card-note">${escapeHtml(t('privacy.reportNote', { c: t('privacy.contact') }))}</p>
    </section>`;
}

function wireSettings(container, app) {
  container.querySelector('#ui-language').addEventListener('change', event => app.setLanguage(event.target.value));
  const analytics = container.querySelector('#analytics-consent');
  if (analytics) {
    analytics.addEventListener('change', () => {
      // Pëlqimi shënohet me datë; pa të asnjë ngjarje nuk dërgohet.
      app.profile.settings.analytics = analytics.checked;
      recordConsent(app.profile, 'analytics', analytics.checked);
      setAnalyticsConsent(analytics.checked);
      app.save();
      toast(analytics.checked ? t('privacy.analyticsOn') : t('privacy.analyticsOff'), 'ok');
    });
  }
}

function wireHelp(container) {
  const button = container.querySelector('[data-copy-report]');
  button.addEventListener('click', async () => {
    const text = container.querySelector('#report-text').value.trim();
    if (!text) { toast(t('privacy.writeFirst'), 'err'); return; }
    const report = `A JE MIRË? ${APP_VERSION}\n${t('privacy.browser')}: ${navigator.userAgent}\n${t('privacy.screen')}: ${innerWidth}x${innerHeight}\n\n${text}`;
    const done = await copyText(report);
    toast(done ? t('privacy.copied') : t('privacy.copyBlocked'), done ? 'ok' : 'err');
  });
}
