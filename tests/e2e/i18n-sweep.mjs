// Kalim nëpër çdo ekran në anglisht: gjen tekst shqip të mbetur dhe gabime në konsolë.
// Përdorimi: BASE=http://localhost:4173 node tests/e2e/i18n-sweep.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problems = [];
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`); });

await page.goto(BASE + '/');
await page.click('[data-consent-lang]');
await page.waitForFunction(() => document.documentElement.lang === 'en');
const consentText = await page.innerText('#consent-view');
await page.click('label[for="consent-store"]');
await page.click('[data-mode="demo"]');
await page.waitForSelector('#shell:not([hidden])');

// Fjalë funksionale shqipe që nuk shfaqen në anglisht. Shënimet sintetike të demos përjashtohen.
const ALBANIAN = /\b(të|në|dhe|nuk|për|është|ditë|ditët|një|kjo|nga|sot)\b|ë/i;
const demoNotes = await page.evaluate(() => JSON.parse(localStorage.getItem('ajemire.v1')).checkins.map(entry => entry.note).filter(Boolean));
const check = (label, text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    .filter(line => !demoNotes.some(note => line.includes(note)))
    .filter(line => !/A JE MIRË\?|KAFE\?|Kosova|Shqip/.test(line));
  const hits = lines.filter(line => ALBANIAN.test(line));
  console.log(`${hits.length ? 'FAIL' : 'PASS'}  ${label}${hits.length ? '\n   ' + hits.slice(0, 6).join('\n   ') : ''}`);
  return hits.length;
};

let failures = check('consent', consentText);
const screens = await page.evaluate(() => [...document.querySelectorAll('.nav [data-screen]')].map(item => item.dataset.screen));
for (const screen of [...new Set([...screens, 'my5', 'kafe', 'wall'])]) {
  await page.evaluate(name => window.AJM.app.goTo(name), screen);
  await page.waitForTimeout(700);
  failures += check(screen, await page.innerText('#screens'));
}
// Pjesë që shfaqen vetëm pas një veprimi.
await page.evaluate(() => window.AJM.app.goTo('normal'));
await page.waitForTimeout(500);
await page.click('.day[data-date]:not(.is-missing)');
failures += check('normal: day detail', await page.innerText('#timeline-host'));
await page.evaluate(() => window.AJM.app.goTo('privacy'));
for (const tab of ['terms', 'help']) {
  await page.click(`[data-tab="${tab}"]`);
  await page.waitForTimeout(300);
  failures += check(`privacy: ${tab}`, await page.innerText('#screens'));
}
failures += check('nav', await page.innerText('.nav'));
await page.evaluate(() => window.AJM.app.startTour());
await page.waitForTimeout(500);
failures += check('tour', await page.innerText('#tour-host'));

console.log(problems.length ? 'CONSOLE PROBLEMS:\n' + problems.join('\n') : 'no console errors');
console.log(`${failures} screens with Albanian left`);
await browser.close();
process.exit(failures || problems.length ? 1 : 0);
