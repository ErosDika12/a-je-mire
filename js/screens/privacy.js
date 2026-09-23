// Privatësia, Kushtet dhe Ndihma në një vend, me gjuhë të thjeshtë.
// Kontakti është vendmbajtës i shënuar qartë: pilotit nuk i shpikim kompani apo adresë.
import { icon, toast, copyText } from '../ui.js';
import { escapeHtml } from '../format.js';
import { POLICY_VERSION } from '../storage.js';

export const APP_VERSION = '2.0.0';
const CONTACT_PLACEHOLDER = '[VENDMBAJTËS — kontakti i pilotit do të shtohet këtu]';

const CHANGELOG = [
  ['2.0.0', '2026-09', [
    'Llogari opsionale me email dhe verifikim.',
    'Kopje rezervë e enkriptuar në pajisje, me fjalëkalim sinkronizimi të veçantë.',
    'Qendra e sinkronizimit me zgjidhje të dukshme konfliktesh për të njëjtën datë.',
    'Import me "zëvendëso" ose "bashko", dhe kopje lokale automatike para zëvendësimit.',
    'Tri fshirje të ndara: lokale, cloud, llogari.',
    'Funksionon offline si aplikacion (PWA).'
  ]],
  ['1.1.0', '2026-08', ['Ridizajn: Sot, grafikët, Patterns, What Helps Me.']],
  ['1.0.0', '2026-07', ['Versioni i parë: check-in, My Normal, Something Changed, MY 5, KAFE?.']]
];

let tab = 'privacy';

export function renderPrivacy(container, app) {
  const tabs = [['privacy', 'Privatësia'], ['terms', 'Kushtet'], ['help', 'Ndihma']];
  container.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Privatësia</h1>
      <p class="page-sub">Çfarë ruhet, ku, pse — dhe si e fshin. Versioni i politikës: ${POLICY_VERSION}.</p>
    </header>
    <div class="seg-control" role="group" aria-label="Seksioni">
      ${tabs.map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${tab === key}">${label}</button>`).join('')}
    </div>
    <div class="mt-4">${tab === 'privacy' ? privacyBody(app) : tab === 'terms' ? termsBody() : helpBody()}</div>`;

  for (const button of container.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => { tab = button.dataset.tab; renderPrivacy(container, app); });
  }
  if (tab === 'help') wireHelp(container);
}

function list(items, kind = '') {
  return `<ul class="facts">${items.map(([name, text]) =>
    `<li class="fact ${kind}"><span class="fact-ic">${icon(name, 15)}</span><span>${text}</span></li>`).join('')}</ul>`;
}

function privacyBody(app) {
  return `
    <section class="card">
      <h2 class="card-title">Pa llogari (parazgjedhja)</h2>
      <div class="mt-3">${list([
        ['shield', 'Të gjitha të dhënat rrinë në <code>localStorage</code> të këtij shfletuesi. Asnjë kërkesë nuk shkon në server.'],
        ['calendar', 'Ruhen: gjashtë matjet ditore, tags, shënimet, MY 5 dhe lidhjet që shënon vetë.'],
        ['close', 'Asgjë nuk ruhet para se ta pranosh ruajtjen lokale.']
      ])}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">Me llogari (opsionale)</h2>
      <div class="mt-3">${list([
        ['doc', 'Serveri ruan: emailin, datën e krijimit, pëlqimet me datë, dhe <strong>një bllok teksti të enkriptuar</strong> me metadatat e tij (revizioni, ID e rastësishme e pajisjes, koha e ruajtjes).'],
        ['lock', 'Enkriptimi bëhet në pajisjen tënde me AES-GCM 256-bit, me çelës të nxjerrë nga fjalëkalimi i sinkronizimit (PBKDF2-SHA256, 600 000 përsëritje, kripë e rastësishme). Fjalëkalimi dhe çelësi nuk ruhen dhe nuk dërgohen kurrë.'],
        ['info', 'Kjo është enkriptim në anën e klientit për kopjen rezervë. Nuk e quajmë "end-to-end", sepse nuk ka komunikim mes personave.'],
        ['cloud', 'Serveri është Supabase (BE, Frankfurt), me Row Level Security: çdo llogari mund të lexojë vetëm rreshtat e vet.'],
        ['upload', 'Asgjë nuk ngarkohet automatikisht. Çdo ngarkim e nis ti pas një përmbledhjeje.']
      ])}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">Çfarë nuk bëjmë kurrë</h2>
      <div class="mt-3">${list([
        ['close', 'Pa diagnozë dhe pa emra gjendjesh mjekësore. Raportojmë vetëm sa lëvizën numrat e tu krahasuar me ty.'],
        ['close', 'Pa kamerë dhe pa njohje emocionesh nga fytyra.'],
        ['close', 'Pa mesazhe automatike te MY 5 — vetëm draft që e kopjon ti.'],
        ['close', 'Pa pikë publike mirëqenieje, pa reklama, pa analytics, pa shitje të dhënash.'],
        ['close', 'Nuk kërkojmë foto, telefon, adresë, vendndodhje, gjini apo datëlindje.'],
        ['close', 'Pa hyrje me rrjete sociale.']
      ], 'fact-no')}</div>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">Kontrolli yt</h2>
      <div class="mt-3">${list([
        ['download', 'Eksporto gjithçka si JSON te <a href="#/data" data-go="data">Të dhënat e mia</a>.'],
        ['trash', 'Fshij të dhënat lokale, kopjen në cloud ose llogarinë — secila veç e veç, te <a href="#/account" data-go="account">Llogaria</a>.'],
        ['doc', `Pëlqimet e tua në këtë pajisje: ${(app.profile.consentLog || []).length} të shënuara.`]
      ])}</div>
    </section>

    <section class="card card-soft mt-4">
      <p class="small"><strong>Kontakti:</strong> ${escapeHtml(CONTACT_PLACEHOLDER)}</p>
      <p class="card-note">Ky është një pilot shkollor për KosICT 15. Nuk është shërbim mjekësor dhe nuk zëvendëson ndihmën nga një njeri i besuar ose profesionist.</p>
    </section>`;
}

function termsBody() {
  return `<section class="card">
    <h2 class="card-title">Kushtet e përdorimit — pilot</h2>
    <ol class="terms mt-3">
      <li>A JE MIRË? 2036 është një projekt pilot shkollor. Ofrohet "siç është", pa garanci funksionimi të pandërprerë.</li>
      <li>Aplikacioni nuk jep diagnozë, këshillë mjekësore apo trajtim. Mesazhi i tij i vetëm është: diçka ndryshoi krahasuar me patternin tënd.</li>
      <li>Llogaria është opsionale. Përgjigjesh për ruajtjen e fjalëkalimit të llogarisë dhe atij të sinkronizimit. Fjalëkalimi i sinkronizimit nuk mund të rikthehet nga askush.</li>
      <li>Mos e përdor për të ruajtur të dhëna të personave të tjerë përtej emrit që u vë vetë te MY 5.</li>
      <li>Mund ta fshish llogarinë në çdo moment; fshirja heq emailin, kopjen në cloud dhe pëlqimet.</li>
      <li>Pilotit mund t'i ndryshojnë kushtet; versioni i ri kërkon pranim të ri para kopjes në cloud.</li>
      <li>Kontakti: ${escapeHtml(CONTACT_PLACEHOLDER)}</li>
    </ol>
    <p class="card-note">Versioni ${POLICY_VERSION}</p>
  </section>`;
}

function helpBody() {
  return `
    <section class="card">
      <h2 class="card-title">Pyetje të shpeshta</h2>
      <details class="collapse mt-3"><summary>Pse më duhen 14 ditë para se të shoh ndryshime?</summary>
        <div class="collapse-body muted small">Normalja jote llogaritet nga ditët e mëparshme. Me pak ditë, çdo krahasim do të ishte zhurmë.</div></details>
      <details class="collapse"><summary>E harrova fjalëkalimin e sinkronizimit.</summary>
        <div class="collapse-body muted small">Kopja në cloud nuk mund të hapet më. Të dhënat në pajisje janë të paprekura: fshij kopjen e vjetër te Llogaria dhe ngarko një të re me fjalëkalim të ri.</div></details>
      <details class="collapse"><summary>Çfarë ndodh kur dy pajisje kanë vlera të ndryshme për të njëjtën datë?</summary>
        <div class="collapse-body muted small">Qendra e sinkronizimit t'i tregon të dyja krah për krah dhe ti zgjedh. Asgjë nuk mbishkruhet në heshtje.</div></details>
      <details class="collapse"><summary>A funksionon pa internet?</summary>
        <div class="collapse-body muted small">Po. Pas hapjes së parë, aplikacioni ngarkohet offline. Vetëm llogaria dhe sinkronizimi kërkojnë internet.</div></details>
    </section>

    <section class="card mt-4">
      <h2 class="card-title">Ndryshimet</h2>
      ${CHANGELOG.map(([version, date, items]) => `<div class="mt-3">
        <p><strong>${version}</strong> <span class="muted small">· ${date}</span></p>
        <ul class="changelog">${items.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
      </div>`).join('')}
    </section>

    <section class="card mt-4">
      <h2 class="card-title">Raporto një problem</h2>
      <p class="warn mt-2">${icon('info', 14)} Mos përfshi shënime private ose të dhëna personale në raport.</p>
      <div class="field mt-3">
        <label for="report-text">Çfarë ndodhi? <span class="field-hint">hapat, çfarë prisje, çfarë pe</span></label>
        <textarea id="report-text" rows="4" maxlength="1000"></textarea>
      </div>
      <button type="button" class="btn btn-primary mt-3" data-copy-report>${icon('copy', 16)} Kopjo raportin</button>
      <p class="card-note">Raporti nuk dërgohet automatikisht. Përfshin vetëm tekstin tënd, versionin e aplikacionit dhe llojin e shfletuesit — asnjë check-in. Dërgoje te: ${escapeHtml(CONTACT_PLACEHOLDER)}</p>
    </section>`;
}

function wireHelp(container) {
  const button = container.querySelector('[data-copy-report]');
  button.addEventListener('click', async () => {
    const text = container.querySelector('#report-text').value.trim();
    if (!text) { toast('Shkruaj së pari çfarë ndodhi', 'err'); return; }
    const report = `A JE MIRË? ${APP_VERSION}\nShfletuesi: ${navigator.userAgent}\nEkrani: ${innerWidth}x${innerHeight}\n\n${text}`;
    const done = await copyText(report);
    toast(done ? 'Raporti u kopjua' : 'Kopjimi nuk u lejua', done ? 'ok' : 'err');
  });
}
