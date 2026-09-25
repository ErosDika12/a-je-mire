import { icon } from '../ui.js';
import { t, tList, getLang, setLang, LANGUAGES } from '../i18n/index.js';

const COLLECTED_ICONS = ['calendar', 'spark', 'edit'];
const WHY_ICONS = ['pulse', 'shift', 'users'];

export function renderConsent(container, app) {
  container.innerHTML = markup();

  const storeToggle = container.querySelector('#consent-store');
  const aiToggle = container.querySelector('#consent-ai');
  const choices = [...container.querySelectorAll('[data-mode]')];

  const sync = () => {
    for (const row of container.querySelectorAll('.switch-row')) {
      row.classList.toggle('is-on', row.querySelector('input').checked);
    }
    // Butonat e nisjes mbeten të mbyllur derisa ruajtja lokale të pranohet shprehimisht.
    for (const button of choices) button.disabled = !storeToggle.checked;
  };

  storeToggle.addEventListener('change', sync);
  aiToggle.addEventListener('change', sync);
  sync();

  for (const button of choices) {
    button.addEventListener('click', () => {
      app.acceptConsent(button.dataset.mode, aiToggle.checked);
    });
  }

  // Gjuha ndërrohet vetëm në memorie: para pëlqimit nuk shkruhet asgjë në pajisje.
  for (const button of container.querySelectorAll('[data-consent-lang]')) {
    button.addEventListener('click', () => setLang(button.dataset.consentLang));
  }
}

function factList(icons, key) {
  return tList(key).map((text, index) =>
    `<li class="fact"><span class="fact-ic">${icon(icons[index], 17)}</span><span>${text}</span></li>`
  ).join('');
}

function markup() {
  return `<div class="consent-page">
    <div class="consent-card">
      <div class="consent-hero texture">
        <div>
          <div class="row-between" style="align-items:flex-start">
            <div class="consent-logo">
              ${logoMark()}
              <div>
                <div class="brand-name">A JE MIRË? 2036</div>
                <div class="brand-sub">KosICT 15 · Kosova 2036</div>
              </div>
            </div>
            <div class="lang-row" role="group" aria-label="Gjuha · Language · Sprache">
              ${Object.keys(LANGUAGES).map(code => `<button type="button" class="btn btn-sm" data-consent-lang="${code}" lang="${code}" aria-pressed="${code === getLang()}">${LANGUAGES[code].core.languageName}</button>`).join('')}
            </div>
          </div>
          <h1 class="consent-title">${t('consent.title')}</h1>
          <p class="consent-lede">${t('consent.lede')}</p>
        </div>
      </div>

      <div class="card stack">
        <div>
          <h2 class="card-title">${t('consent.collectedTitle')}</h2>
          <ul class="facts" style="margin-top:var(--s3)">${factList(COLLECTED_ICONS, 'consent.collected')}</ul>
        </div>

        <div>
          <h2 class="card-title">${t('consent.whyTitle')}</h2>
          <ul class="facts" style="margin-top:var(--s3)">${factList(WHY_ICONS, 'consent.why')}</ul>
        </div>

        <details class="collapse">
          <summary>${icon('shield', 16)} ${t('consent.whereTitle')}</summary>
          <div class="collapse-body stack">
            <p style="color:var(--text-2);font-size:var(--fs-sm)">${t('consent.where')}</p>
            <ul class="facts">
              ${tList('consent.never').map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('close', 15)}</span><span>${text}</span></li>`).join('')}
            </ul>
          </div>
        </details>

        <label class="switch-row" for="consent-store">
          <input type="checkbox" id="consent-store">
          <span class="switch" aria-hidden="true"></span>
          <span class="switch-text">
            <strong>${t('consent.store')}</strong>
            <span>${t('consent.storeHint')}</span>
          </span>
        </label>

        <label class="switch-row" for="consent-ai">
          <input type="checkbox" id="consent-ai">
          <span class="switch" aria-hidden="true"></span>
          <span class="switch-text">
            <strong>${t('consent.textHelp')}</strong>
            <span>${t('consent.textHelpHint')}</span>
          </span>
        </label>

        <div>
          <p class="sheet-title">${t('consent.start')}</p>
          <div class="consent-cols">
            <button type="button" class="consent-choice" data-mode="demo" disabled>
              <span class="fact-ic">${icon('spark', 20)}</span>
              <span>
                <strong>${t('consent.demo')}</strong>
                <span>${t('consent.demoHint')}</span>
              </span>
            </button>
            <button type="button" class="consent-choice" data-mode="private" disabled>
              <span class="fact-ic">${icon('shield', 20)}</span>
              <span>
                <strong>${t('consent.private')}</strong>
                <span>${t('consent.privateHint')}</span>
              </span>
            </button>
          </div>
        </div>

        <p class="card-note">${t('consent.nothingWritten')}</p>
      </div>
    </div>
  </div>`;
}

export function logoMark(size = 38) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="12" fill="var(--accent-soft)"/>
    <path d="M9 26.5 16 15l5.5 8.5L25 18l6 8.5" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="16" cy="15" r="2.6" fill="var(--accent)"/>
    <circle cx="31" cy="26.5" r="2.2" fill="var(--lavender)"/>
  </svg>`;
}
