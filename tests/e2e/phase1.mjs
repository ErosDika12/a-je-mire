// Testi fund-e-krye i Fazës 1 në një Chromium të vërtetë (headless).
// Përdorimi: BASE=https://a-je-mire.vercel.app E2E_EMAIL=... E2E_PASSWORD=... node tests/e2e/phase1.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const PASSPHRASE = 'e2e-sync-passphrase-long';
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const browser = await chromium.launch();
const errors = [];

async function freshDevice() {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Rrjeti në disa makina është i ngadaltë për Chromium; kohë më e gjatë, jo sleep-e të verbra.
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(BASE + '/');
  return { context, page };
}

async function acceptConsent(page, mode) {
  await page.click('label[for="consent-store"]');
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForSelector('#shell:not([hidden])');
}

async function login(page) {
  await page.goto(BASE + '/#/account');
  await page.waitForSelector('[data-form="login"]');
  await page.fill('#f-email', EMAIL);
  await page.fill('#f-password', PASSWORD);
  await page.click('[data-form="login"] button[type="submit"]');
  try {
    await page.waitForSelector('#sync-centre, #accept-terms', { timeout: 60000 });
  } catch (error) {
    // Nëse dështon, trego çfarë pa përdoruesi, jo vetëm "timeout".
    console.log('EKRANI:', (await page.innerText('#screen-account').catch(() => '')).slice(0, 400));
    console.log('GABIME:', errors.slice(-3).join(' | '));
    throw error;
  }
}

async function setPassphrase(page, confirm) {
  await page.fill('#f-passphrase', PASSPHRASE);
  if (confirm) await page.fill('#f-passphrase2', PASSPHRASE);
  await page.click('[data-form="passphrase"] button[type="submit"]');
}

// ---------- Pajisja 1 ----------
const one = await freshDevice();
check('pa consent nuk shkruhet asgjë', await one.page.evaluate(() => localStorage.length) === 0);
await acceptConsent(one.page, 'demo');
check('modaliteti lokal punon pa regjistrim', await one.page.isVisible('#screen-dashboard'));

if (EMAIL) {
  await login(one.page);
  if (await one.page.isVisible('#accept-terms')) {
    await one.page.check('#accept-terms');
    await one.page.click('[data-accept-terms]');
    await one.page.waitForSelector('#sync-centre', { timeout: 60000 });
  }
  check('hyrja funksionon', await one.page.isVisible('#sync-centre'));
  // Nëse ka mbetur një kopje nga një ekzekutim i mëparshëm, e fshijmë nga UI që testi të nisë pastër.
  await one.page.waitForFunction(() => !document.getElementById('sync-centre').innerText.includes('Po kontrollohet'));
  if (await one.page.isEnabled('[data-del-cloud]')) {
    await one.page.click('[data-del-cloud]');
    await one.page.click('.modal [data-confirm], [role="dialog"] [data-confirm]');
    await one.page.waitForFunction(() => document.getElementById('sync-centre').innerText.includes('Asnjë kopje në cloud'));
  }
  await setPassphrase(one.page, true);
  await one.page.click('[data-first-upload]');
  await one.page.click('.modal [data-confirm], [role="dialog"] [data-confirm]');
  await one.page.waitForFunction(() => document.getElementById('sync-centre')?.innerText.includes('Revizioni 1'), null, { timeout: 60000 });
  check('ngarkimi i enkriptuar', true);

  const stored = await one.page.evaluate(() => JSON.stringify(localStorage));
  check('fjalëkalimi i sinkronizimit nuk ruhet', !stored.includes(PASSPHRASE));

  await one.page.reload();
  await one.page.goto(BASE + '/#/account');
  await one.page.waitForSelector('#sync-centre', { timeout: 60000 });
  check('sesioni mbetet pas rifreskimit', true);
  check('pas rifreskimit kërkohet sërish fjalëkalimi i sinkronizimit', await one.page.isVisible('#f-passphrase'));

  // ---------- Pajisja 2: rikthim ----------
  const two = await freshDevice();
  await acceptConsent(two.page, 'private');
  const before = await two.page.evaluate(() => window.AJM.app.profile.checkins.length);
  await login(two.page);
  if (await two.page.isVisible('#accept-terms')) {
    await two.page.check('#accept-terms');
    await two.page.click('[data-accept-terms]');
    await two.page.waitForSelector('#sync-centre');
  }
  await setPassphrase(two.page, false);
  await two.page.click('[data-restore]');
  await two.page.click('.modal [data-confirm], [role="dialog"] [data-confirm]');
  await two.page.waitForFunction(() => window.AJM.app.profile.checkins.length === 30, null, { timeout: 60000 });
  check('rikthimi në pajisje tjetër', before === 0, `${before} → 30 ditë`);

  // Konflikt: pajisja 2 ndryshon një ditë, pajisja 1 sinkronizon.
  await two.page.evaluate(() => { const entry = window.AJM.app.profile.checkins[3]; entry.mood = entry.mood === 1 ? 2 : 1; window.AJM.app.save(); });
  await two.page.goto(BASE + '/#/account');
  await two.page.waitForSelector('[data-sync]');
  await two.page.click('[data-sync]');
  await two.page.waitForSelector('#conflicts', { timeout: 60000 });
  check('konflikti shfaqet', true);
  await two.page.click('[data-apply-merge]');
  await two.page.waitForFunction(() => document.getElementById('sync-centre')?.innerText.includes('Revizioni 2'), null, { timeout: 60000 });
  check('konflikti zgjidhet dhe sinkronizohet', true);
  await two.context.close();

  // Dalja
  await one.page.click('[data-signout]');
  await one.page.waitForSelector('[data-form="login"]', { timeout: 60000 });
  check('dalja funksionon', true);
}

// ---------- Offline ----------
await one.page.goto(BASE + '/');
// waitForFunction nuk pret Promise-a, prandaj kontrollojmë vetë çdo sekondë (deri në 60 s).
let controlled = false;
for (let attempt = 0; attempt < 60 && !controlled; attempt += 1) {
  await wait(1000);
  controlled = await one.page.evaluate(() => Boolean(navigator.serviceWorker.controller));
}
check('service worker kontrollon faqen', controlled);
await one.context.setOffline(true);
await one.page.reload();
const offlineShell = await one.page.isVisible('#shell').catch(() => false);
check('guaska hapet offline', offlineShell);
if (offlineShell) {
  await one.page.goto(BASE + '/#/checkin');
  const before = await one.page.evaluate(() => window.AJM.app.profile.checkins.length);
  await one.page.evaluate(() => {
    const app = window.AJM.app;
    app.profile.checkins = app.profile.checkins.filter(entry => entry.date !== app.today);
    app.save();
  });
  await one.page.reload();
  await one.page.goto(BASE + '/#/checkin');
  await one.page.click('#checkin-save');
  await wait(500);
  await one.page.reload();
  const after = await one.page.evaluate(() => JSON.parse(localStorage.getItem('ajemire.v1')).checkins.some(entry => entry.date === window.AJM.app.today));
  check('check-in offline ruhet dhe mbijeton rifreskimin', after, `${before} ditë para`);
}
await one.context.setOffline(false);

check('pa gabime në console', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter(item => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} kaluan`);
process.exit(failed ? 1 : 0);
