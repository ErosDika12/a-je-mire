import { icon } from '../ui.js';

const COLLECTED = [
  ['calendar', 'Gjashtë numra në ditë: humori, gjumi, energjia, lidhja sociale, gëzimi dhe ngarkesa.'],
  ['spark', 'Tags të aktiviteteve, p.sh. basketboll ose mësim. I zgjedh ti.'],
  ['edit', 'Një shënim i shkurtër, vetëm nëse do ta shkruash.']
];

const WHY = [
  ['pulse', 'Që të ndërtohet "My Normal" — mesatarja jote personale, jo një normë e përgjithshme.'],
  ['shift', 'Që të vërehet kur patterni yt ndryshon krahasuar me ty vetë.'],
  ['users', 'Që të kesh ndihmë konkrete kur do të afrohesh me dikë që e ke zgjedhur vetë.']
];

const NEVER = [
  'Nuk përdor kamerë dhe nuk lexon fytyra apo emocione.',
  'Nuk të vendos diagnozë dhe nuk emërton asnjë gjendje mjekësore. Raporton vetëm sa lëvizën numrat e tu.',
  'Nuk dërgon asnjë mesazh, email apo njoftim në vend tëndin.',
  'Nuk të krahason me persona të tjerë apo me ndonjë standard.',
  'Nuk ka llogari, server, analytics apo reklama.',
  'Nuk i çon të dhënat askund — gjithçka rri në këtë pajisje.'
];

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
}

function factList(items) {
  return items.map(([name, text]) =>
    `<li class="fact"><span class="fact-ic">${icon(name, 17)}</span><span>${text}</span></li>`
  ).join('');
}

function markup() {
  return `<div class="consent-page">
    <div class="consent-card">
      <div class="consent-hero texture">
        <div>
          <div class="consent-logo">
            ${logoMark()}
            <div>
              <div class="brand-name">A JE MIRË? 2036</div>
              <div class="brand-sub">KosICT 15 · Kosova 2036</div>
            </div>
          </div>
          <h1 class="consent-title">Patterni yt.<br>Vetëm i yti.</h1>
          <p class="consent-lede">Ky sistem mëson se si duket një javë e zakonshme për ty, dhe të tregon kur diçka ndryshon krahasuar me ty vetë — jo me askënd tjetër.</p>
        </div>
      </div>

      <div class="card stack">
        <div>
          <h2 class="card-title">Çfarë mblidhet</h2>
          <ul class="facts" style="margin-top:var(--s3)">${factList(COLLECTED)}</ul>
        </div>

        <div>
          <h2 class="card-title">Pse mblidhet</h2>
          <ul class="facts" style="margin-top:var(--s3)">${factList(WHY)}</ul>
        </div>

        <details class="collapse">
          <summary>${icon('shield', 16)} Ku ruhet dhe çfarë nuk bën kurrë ky sistem</summary>
          <div class="collapse-body stack">
            <p style="color:var(--text-2);font-size:var(--fs-sm)">
              Të dhënat ruhen vetëm në <strong>localStorage</strong> të këtij shfletuesi, nën një çelës të vetëm:
              <code>ajemire.v1</code>. Nuk ka llogari dhe nuk kërkohet email. Mund t'i eksportosh ose t'i fshish të gjitha në çdo moment.
            </p>
            <ul class="facts">
              ${NEVER.map(text => `<li class="fact fact-no"><span class="fact-ic">${icon('close', 15)}</span><span>${text}</span></li>`).join('')}
            </ul>
          </div>
        </details>

        <label class="switch-row" for="consent-store">
          <input type="checkbox" id="consent-store">
          <span class="switch" aria-hidden="true"></span>
          <span class="switch-text">
            <strong>Ruaj check-ins në këtë pajisje</strong>
            <span>E domosdoshme. Pa këtë, aplikacioni nuk mban asgjë dhe nuk ka çfarë të krahasojë.</span>
          </span>
        </label>

        <label class="switch-row" for="consent-ai">
          <input type="checkbox" id="consent-ai">
          <span class="switch" aria-hidden="true"></span>
          <span class="switch-text">
            <strong>Ndihmë opsionale për tekstin</strong>
            <span>Reflektim javor dhe drafte mesazhesh, të ndërtuara nga template lokale në pajisje. Pa internet, pa API.</span>
          </span>
        </label>

        <div>
          <p class="sheet-title">Si do të fillosh</p>
          <div class="consent-cols">
            <button type="button" class="consent-choice" data-mode="demo" disabled>
              <span class="fact-ic">${icon('spark', 20)}</span>
              <span>
                <strong>Shiko demon 30-ditore</strong>
                <span>Profil sintetik i gjeneruar nga kodi. Jo i një personi të vërtetë.</span>
              </span>
            </button>
            <button type="button" class="consent-choice" data-mode="private" disabled>
              <span class="fact-ic">${icon('shield', 20)}</span>
              <span>
                <strong>Nis profil privat bosh</strong>
                <span>Zero të dhëna. Baseline-i ndërtohet nga check-ins e tua.</span>
              </span>
            </button>
          </div>
        </div>

        <p class="card-note">Asgjë nuk shkruhet në këtë pajisje derisa të shtypësh njërin nga dy butonat e mësipërm.</p>
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
