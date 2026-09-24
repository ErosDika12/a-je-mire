// Fshirja e llogarisë përmes ndërfaqes (Edge Function delete-account), për llogaritë e testit.
// Kontrollon që të dhënat lokale mbeten pas fshirjes së llogarisë.
// Përdorimi: BASE=... ACCOUNTS="email1:fjalëkalim1,email2:fjalëkalim2" node tests/e2e/delete-accounts.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://a-je-mire.vercel.app';
const accounts = String(process.env.ACCOUNTS || '').split(',').filter(Boolean).map(item => item.split(':'));
if (!accounts.every(([email]) => email.endsWith('@ajm-test.invalid'))) throw new Error('Vetëm llogari testi (@ajm-test.invalid).');
const browser = await chromium.launch();
let failed = 0;

for (const [email, password] of accounts) {
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(90000);
  await page.goto(BASE + '/');
  await page.click('label[for="consent-store"]');
  await page.click('[data-mode="demo"]');
  await page.waitForSelector('#shell:not([hidden])');
  await page.evaluate(() => window.AJM.app.goTo('account'));
  await page.fill('#f-email', email);
  await page.fill('#f-password', password);
  await page.click('[data-form="login"] button[type="submit"]');
  await page.waitForSelector('#sync-centre, #accept-terms');
  await page.click('[data-del-account]');
  await page.fill('#confirm-word', await page.evaluate(() => document.querySelector('label[for="confirm-word"] strong').textContent));
  await page.click('[data-confirm]');
  const deleted = await page.waitForSelector('[data-form="login"]').then(() => true, () => false);
  const localKept = await page.evaluate(() => JSON.parse(localStorage.getItem('ajemire.v1')).checkins.length > 0);
  const ok = deleted && localKept;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${email} u fshi; të dhënat lokale mbetën: ${localKept}`);
  await page.context().close();
}
await browser.close();
process.exit(failed ? 1 : 0);
