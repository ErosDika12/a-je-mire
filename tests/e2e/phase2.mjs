// Testi fund-e-krye i Fazës 2 me katër përdorues realë (Chromium headless).
// Përdorimi: BASE=http://localhost:4173 E2E_PASSWORD=... node tests/e2e/phase2.mjs
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const PASSWORD = process.env.E2E_PASSWORD;
const STAMP = Date.now().toString(36);
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await chromium.launch();
const errors = [];
const pages = [];
// Kur një hap dështon: shfaq çfarë sheh secila faqe, që dështimi të shpjegohet vetë.
process.on('uncaughtException', async error => {
  console.log('DËSHTIM:', error.message.split(String.fromCharCode(10))[0]);
  for (const { email, page } of pages) {
    const text = await page.innerText('#screens').catch(() => '(faqja nuk lexohet)');
    console.log(`--- ${email} @ ${page.url()}`, text.slice(0, 700));
  }
  await browser.close().catch(() => {});
  process.exit(1);
});

async function device(email, { mobile = false } = {}) {
  const context = await browser.newContext(mobile ? { viewport: { width: 375, height: 812 }, hasTouch: true } : { viewport: { width: 1280, height: 900 } });
  await context.grantPermissions(['notifications', 'clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(`${email}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().startsWith('render')) console.log('RENDER ERROR', email, message.text());
    else if (['error', 'warning'].includes(message.type())) console.log('CONSOLE', message.type(), email, message.text().slice(0, 300));
  });
  pages.push({ email, page });
  await page.goto(BASE + '/');
  await page.click('label[for="consent-store"]');
  await page.click('[data-mode="demo"]');
  await page.waitForSelector('#shell:not([hidden])');
  await page.goto(BASE + '/#/account');
  await page.fill('#f-email', email);
  await page.fill('#f-password', PASSWORD);
  await page.click('[data-form="login"] button[type="submit"]');
  await page.waitForSelector('#sync-centre, #accept-terms');
  // Flamujt dhe rolet ngarkohen pas hyrjes; navigimi rindërtohet vetë.
  await page.waitForFunction(() => document.querySelectorAll('.nav [data-screen]').length > 12, null, { timeout: 90000 }).catch(() => {});
  return { context, page };
}

// Navigimi përmes routerit të aplikacionit: rivizatim i garantuar edhe kur adresa nuk ndryshon.
const go = async (page, screen) => { await page.evaluate(name => window.AJM.app.goTo(name), screen); await wait(400); };
// Pret një gjendje reale (jo një kohë fikse); kthen true/false.
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const toastMatches = (page, source) => until(page, pattern => [...document.querySelectorAll('#toast-host *')].some(item => new RegExp(pattern).test(item.textContent)), source);
const navText = page => page.$$eval('.nav [data-screen]', items => items.map(item => item.dataset.screen));
const toastText = async page => (await page.$$eval('#toast-host *', items => items.map(item => item.textContent).join(' | '))) || '';

async function ensureProfile(page, nickname) {
  // Ekrani ngarkohet asinkronisht: pritet derisa të shfaqet ose forma e profilit ose përmbajtja.
  await page.waitForSelector('#profile-setup, #post-form, #network-body').catch(async error => {
    console.log('PROFILI NUK U SHFAQ:', (await page.innerText('#screens').catch(() => '')).slice(0, 600));
    throw error;
  });
  if (await page.$('#profile-setup [data-profile-form]')) {
    await page.fill('#p-nickname', nickname);
    await page.click('#profile-setup button[type="submit"]');
    await wait(1500);
  }
}

async function a11y(page, label) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = report.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  check(`a11y: ${label}`, serious.length === 0, serious.map(item => `${item.id}(${item.nodes.length})`).join(', '));
  for (const item of serious) for (const node of item.nodes.slice(0, 3)) console.log('   ', item.id, node.target.join(' '), node.html.slice(0, 160), (node.any[0] && node.any[0].message || '').slice(0, 200));
}

const A = await device('p2-arta@ajm-test.invalid');
const B = await device('p2-besi@ajm-test.invalid');
// Pseudonime të qëndrueshme; skripti i përgatitjes (supabase/tests/e2e_reset.sql) i fshin para çdo ekzekutimi.
const nickA = 'ArtaE2E';
const nickB = 'BesiE2E';

// ---------- flamujt dhe navigimi ----------
const navA = await navText(A.page);
check('modulet e reja shfaqen kur flamujt lejojnë', ['community', 'network', 'challenges', 'mentor', 'notifications', 'assistant', 'subscription'].every(id => navA.includes(id)), navA.join(','));
check('administrimi i fshehur për përdoruesin pa rol', !navA.includes('admin'));
await go(A.page, 'admin');
check('adresa e drejtpërdrejtë e administrimit nuk hapet pa rol', !(await A.page.url()).includes('#/admin') || await A.page.isHidden('#screen-admin'));

// ---------- komuniteti ----------
await go(A.page, 'community');
await ensureProfile(A.page, nickA);
await go(A.page, 'community');
await A.page.waitForSelector('#post-form');
const postText = `Mendim testi ${STAMP}`;
await A.page.fill('#post-body', postText);
await A.page.click('#attach-measure');
await A.page.waitForSelector('#share-preview');
const preview = await A.page.textContent('#share-preview');
check('ndarja e matjes tregon parapamjen', /mesatarisht|krahasuar/.test(preview), preview.trim().slice(0, 80));
await A.page.click('[role="dialog"] [data-confirm], .modal [data-confirm]');
await A.page.click('#post-form button[type="submit"]');
await A.page.waitForFunction(text => document.querySelector('#feed')?.innerText.includes(text), postText);
check('postimi me matje të ndarë u publikua', (await A.page.textContent('#feed')).includes('mesatarisht') || (await A.page.textContent('#feed')).includes('krahasuar'));
const xss = `<img src=x onerror="window.__xss=1"> ${STAMP}`;
await A.page.fill('#post-body', xss);
await A.page.click('#post-form button[type="submit"]');
await A.page.waitForFunction(stamp => document.querySelector('#feed')?.innerText.includes(stamp), STAMP);
check('teksti i rrezikshëm shfaqet si tekst, jo si HTML', await A.page.evaluate(() => !window.__xss && !document.querySelector('#feed img[src="x"]')));
await a11y(A.page, 'komuniteti');

await go(B.page, 'community');
await ensureProfile(B.page, nickB);
await go(B.page, 'community');
if (!(await until(B.page, text => document.querySelector('#feed')?.innerText.includes(text), postText, 90000))) {
  console.log('B SHEH:', (await B.page.innerText('#screens')).slice(0, 600));
  throw new Error('B nuk e pa postimin');
}
const postCard = B.page.locator('[data-post]', { hasText: postText }).first();
await postCard.locator('[data-react="support"]').click();
check('reagimi funksionon', await until(B.page, text => [...document.querySelectorAll('[data-post]')].find(item => item.innerText.includes(text))
  ?.querySelector('[data-react="support"]')?.getAttribute('aria-pressed') === 'true', postText));
await B.page.locator('[data-post]', { hasText: postText }).first().locator('[data-replies]').click();
await B.page.fill(`[data-post] input[id^="reply-"]`, 'Përgjigje testi');
await B.page.click('[data-reply-form] button[type="submit"]');
check('përgjigja funksionon', await until(B.page, () => document.querySelector('#feed')?.innerText.includes('Përgjigje testi')));
const xssCard = B.page.locator('[data-post]', { hasText: STAMP }).filter({ hasNotText: postText }).first();
await xssCard.locator('[data-menu]').click();
await B.page.click('[data-act="report"]');
check('raporti paralajmëron për të dhënat personale', (await B.page.textContent('[data-report-form]')).includes('Mos përfshi shënime private ose të dhëna personale në raport.'));
await B.page.click('[data-report-form] button[type="submit"]');
check('raportimi i postimit', await toastMatches(B.page, 'Raporti u dërgua'));

// ---------- lidhjet dhe mesazhet ----------
await go(A.page, 'network');
await A.page.fill('#request-nick', nickB);
await A.page.click('#request-form button[type="submit"]');
await toastMatches(A.page, 'Kërkesa u dërgua');
await go(B.page, 'network');
await B.page.waitForSelector('[data-accept]');
await B.page.click('[data-accept]');
check('kërkesa e lidhjes u pranua', await until(B.page, nick => !document.querySelector('[data-accept]') && document.querySelector('#network-body')?.innerText.includes(nick), nickA));
await go(A.page, 'network');
await A.page.click('[data-message]');
await A.page.waitForSelector('#send-body');
await A.page.fill('#send-body', `Tung ${STAMP}`);
await A.page.keyboard.press('Enter');
await A.page.waitForFunction(stamp => document.querySelector('#message-list')?.innerText.includes(`Tung ${stamp}`), STAMP);
check('mesazhi u dërgua (Enter)', (await A.page.textContent('#message-list')).includes('Dërguar'));
await go(B.page, 'network');
await B.page.click('[data-tab="messages"]');
await B.page.waitForSelector('[data-open]');
check('njoftimi i qartë që mesazhet nuk janë skaj-më-skaj', (await B.page.textContent('#network-body')).includes('NUK janë të enkriptuara skaj-më-skaj'));
check('B sheh mesazhin si të palexuar', Boolean(await B.page.$('[data-open] .pill')));
await B.page.click('[data-open]');
await B.page.waitForFunction(stamp => document.querySelector('#message-list')?.innerText.includes(`Tung ${stamp}`), STAMP);
check('A sheh "Lexuar" pasi B e hapi', await until(A.page, () => document.querySelector('#message-list')?.innerText.includes('Lexuar'), undefined, 45000));
await B.page.locator('[data-report-message]').first().click();
await B.page.click('[data-report-form] button[type="submit"]');
check('raportimi i mesazhit', await toastMatches(B.page, 'Raporti u dërgua'));
await a11y(B.page, 'mesazhet');

// ---------- moderimi ----------
const M = await device('p2-mod@ajm-test.invalid');
check('moderatori sheh administrimin', await until(M.page, () => Boolean(document.querySelector('.nav [data-screen="admin"]'))));
await go(M.page, 'admin');
await M.page.waitForSelector('[data-tab="reports"]');
const modTabs = await M.page.$$eval('[data-tab]', items => items.map(item => item.dataset.tab));
check('moderatori sheh vetëm raportet dhe sanksionet', modTabs.join(',') === 'reports,sanctions', modTabs.join(','));
await M.page.waitForSelector('[data-open-report]');
const queue = await M.page.textContent('#admin-body');
check('lista e raporteve nuk tregon përmbajtjen', !queue.includes(`Tung ${STAMP}`));
await M.page.locator('li', { hasText: 'Mesazh' }).first().locator('[data-open-report]').click();
await M.page.waitForSelector('#report-snapshot');
check('moderatori hap raportin e mesazhit (i auditohet)', (await M.page.textContent('#report-snapshot')).includes(`Tung ${STAMP}`));
await M.page.click('[data-act="dismiss"]');
await wait(1000);
await a11y(M.page, 'administrimi (moderator)');

const D = await device('p2-admin@ajm-test.invalid');
await until(D.page, () => Boolean(document.querySelector('.nav [data-screen="admin"]')));
await go(D.page, 'admin');
await D.page.waitForSelector('[data-tab="audit"]');
const adminTabs = await D.page.$$eval('[data-tab]', items => items.map(item => item.dataset.tab));
check('admini sheh flamujt, rolet, auditimin, faturimin', ['flags', 'roles', 'audit', 'billing'].every(tab => adminTabs.includes(tab)), adminTabs.join(','));
await D.page.click('[data-tab="audit"]');
check('auditimi regjistroi hapjen e raportit', await until(D.page, () => document.querySelector('#admin-body')?.innerText.includes('report.open')));
await D.page.click('[data-tab="flags"]');
check('tabela e flamujve shfaqet', await until(D.page, () => Boolean(document.querySelector('[data-save-flag="community"]'))));
await a11y(D.page, 'administrimi (flamujt)');

// ---------- mentori ----------
await go(A.page, 'mentor');
await A.page.click('#new-grant');
await A.page.fill('#g-mentor', 'Mësuesja E2E');
await A.page.check('[name="cat"][value="sleep"]');
await A.page.check('[name="cat"][value="mood"]');
await A.page.click('[data-grant-form] button[type="submit"]');
await A.page.waitForSelector('.data-table');
const previewTable = await A.page.textContent('.data-table');
check('parapamja e mentorit tregon vetëm kategoritë e zgjedhura', previewTable.includes('Gjumi') && previewTable.includes('Humori') && !previewTable.includes('Energjia'));
check('parapamja nuk përmban shënime', !(await A.page.textContent('.data-table')).includes('Fjeta'));
await A.page.click('[data-confirm]');
await A.page.waitForSelector('.invite-code');
const code = (await A.page.textContent('.invite-code')).trim();
check('kodi i ftesës u krijua', code.length >= 6, code.length + ' shenja');
await A.page.keyboard.press('Escape');
await go(B.page, 'mentor');
await B.page.fill('#invite-code', code);
await B.page.click('#accept-form button[type="submit"]');
await B.page.waitForSelector('[data-view]');
await B.page.click('[data-view]');
await B.page.waitForSelector('.data-table');
check('mentori sheh tabelën e miratuar', (await B.page.textContent('.data-table')).includes('Gjumi'));
await B.page.keyboard.press('Escape');
await go(A.page, 'mentor');
await A.page.waitForSelector('[data-revoke]');
await A.page.click('[data-revoke]');
await toastMatches(A.page, 'revokua');
await go(B.page, 'mentor');
check('pas revokimit mentori nuk ka qasje', await until(B.page, () => document.querySelector('#accept-form') && !document.querySelector('[data-view]')));
await a11y(A.page, 'mentori');

// ---------- sfidat ----------
await go(A.page, 'challenges');
await A.page.click('#new-challenge');
await A.page.selectOption('#c-template', 'routine');
await A.page.fill('#c-target', '1');
await A.page.click('[data-create] button[type="submit"]');
await wait(800);
await A.page.emulateMedia({ reducedMotion: 'reduce' });
await A.page.locator('[data-tick]').first().click();
await A.page.waitForSelector('.celebrate');
check('festimi i aksesueshëm (role=status)', (await A.page.getAttribute('.celebrate', 'role')) === 'status');
check('reduced motion fik animacionin', (await A.page.$eval('.celebrate', element => getComputedStyle(element).animationName)) === 'none');
await a11y(A.page, 'sfidat');

// ---------- njoftimet ----------
await go(A.page, 'notifications');
await A.page.click('label[for="n-enabled"]');
await A.page.check('[name="cat"][value="connection_request"]');
await A.page.click('#notify-form button[type="submit"]');
check('preferencat e njoftimeve u ruajtën', await toastMatches(A.page, 'ruajtën'));
await a11y(A.page, 'njoftimet');

// ---------- asistenti ----------
await go(A.page, 'assistant');
const aiPreview = await A.page.textContent('#ai-preview');
check('parapamja e AI: pa shënime, pa MY 5, pa email', !/note|Dardan|@/.test(aiPreview) && /mood|sleep/.test(aiPreview));
await A.page.check('#ai-confirm');
await A.page.click('#ai-send');
check('pa ofrues të konfiguruar: gabim i qartë', await until(A.page, () => /konfiguruar/.test(document.querySelector('#ai-status')?.innerText || '')));
await A.page.click('#ai-local');
check('alternativa pa AI funksionon', (await A.page.textContent('#ai-answer')).length > 20);
await a11y(A.page, 'asistenti');

// ---------- abonimi ----------
await go(A.page, 'subscription');
check('çmimi është vendmbajtës, jo i shpikur', await until(A.page, () => document.querySelector('#screen-subscription')?.innerText.includes('ende pa çmim të miratuar') && Boolean(document.querySelector('[data-billing]'))));
await A.page.click('[data-billing="checkout"]');
check('pa Stripe të konfiguruar: gabim i qartë', await toastMatches(A.page, 'konfiguruar'));
await a11y(A.page, 'abonimi');

// ---------- bllokimi ----------
await go(B.page, 'network');
await B.page.click('[data-tab="connections"]');
if (!(await until(B.page, () => Boolean(document.querySelector('#network-body [data-more]'))))) {
  console.log('B SHEH (rrjeti):', (await B.page.innerText('#screens')).slice(0, 900), '| modal:', await B.page.evaluate(() => document.querySelector('[role=dialog]')?.innerText?.slice(0, 200)));
}
await B.page.click('#network-body [data-more]');
await B.page.click('[data-a="block"]');
await B.page.click('[data-confirm]');
await toastMatches(B.page, 'bllokua');
await go(A.page, 'network');
await A.page.click('[data-tab="messages"]');
await A.page.click('[data-open]');
check('pas bllokimit biseda mbyllet', await until(A.page, () => document.querySelector('#network-body')?.innerText.includes('bllokuar')));

// ---------- gjuha, tastiera, celulari ----------
await A.page.evaluate(() => window.AJM.app.setLanguage('en'));
check('anglishtja: navigimi përkthehet', await until(A.page, () => document.querySelector('.nav')?.innerText.includes('Community')));
await A.page.evaluate(() => window.AJM.app.setLanguage('sq'));
check('shqipja kthehet', await until(A.page, () => document.querySelector('.nav')?.innerText.includes('Komuniteti')));
await go(A.page, 'dashboard');
await A.page.keyboard.press('Tab');
let reachedNav = false;
for (let step = 0; step < 12 && !reachedNav; step += 1) {
  reachedNav = await A.page.evaluate(() => document.activeElement?.matches('.nav [data-screen]'));
  if (!reachedNav) await A.page.keyboard.press('Tab');
}
check('navigimi arrihet me tastierë', reachedNav);
if (reachedNav) {
  const target = await A.page.evaluate(() => document.activeElement.dataset.screen);
  await A.page.keyboard.press('Enter');
  await wait(500);
  check('Enter hap ekranin nga tastiera', A.page.url().includes(`#/${target}`));
}

// E njëjta seancë e A-së, me madhësinë e një celulari (pa hyrje të re, që të mos prekim kufirin e hyrjeve).
await A.page.setViewportSize({ width: 375, height: 812 });
const phone = A;
const overflow = [];
for (const screen of ['community', 'network', 'challenges', 'mentor', 'notifications', 'assistant', 'subscription']) {
  await go(phone.page, screen);
  await wait(800);
  const width = await phone.page.evaluate(() => document.documentElement.scrollWidth);
  if (width > 376) overflow.push(`${screen}:${width}`);
}
check('375px: pa rrëshqitje horizontale në modulet e reja', overflow.length === 0, overflow.join(','));
check('navigimi i poshtëm në celular', (await phone.page.$$('.bottomnav-item')).length === 6);

check('pa gabime JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter(item => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} kaluan`);
process.exit(failed ? 1 : 0);
