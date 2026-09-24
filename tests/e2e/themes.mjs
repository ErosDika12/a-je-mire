// Temat (pastel dhe të personalizuara) pas bashkimit me guaskën shumëgjuhëshe.
// Përdorimi: BASE=http://localhost:4173 node tests/e2e/themes.mjs
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problems = [];
page.on('pageerror', error => problems.push(error.message));
page.on('console', message => { if (message.type() === 'error') problems.push(message.text().slice(0, 200)); });
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };

await page.goto(BASE + '/');
await page.click('label[for="consent-store"]');
await page.click('[data-mode="demo"]');
await page.waitForSelector('#shell:not([hidden])');

// Në desktop zgjedhjet shfaqen drejtpërdrejt; butoni i hapjes është vetëm për ekranet e ngushta.
check('zgjedhjet e temave shfaqen në desktop', await page.isVisible('#theme-choices [data-theme-id="pink"]'));
await page.click('#theme-choices [data-theme-id="pink"]');
check('tema pastel aplikohet', await page.evaluate(() => document.documentElement.dataset.theme === 'pink'));

// Ndërrimi i gjuhës rindërton guaskën: butoni i temës duhet të hapë panelin një herë, jo dy (dëgjues të dyfishtë).
await page.evaluate(() => window.AJM.app.setLanguage('en'));
await page.waitForTimeout(300);
await page.setViewportSize({ width: 375, height: 812 });
await page.click('#theme-button');
check('pas ndërrimit të gjuhës paneli hapet (pa dëgjues të dyfishuar)', await page.evaluate(() => document.getElementById('theme-switcher').classList.contains('is-open')));
check('etiketat e temave në anglisht', (await page.getAttribute('#theme-choices [data-theme-id="pink"]', 'aria-label')) === 'Pastel pink');

await page.click('#theme-choices [data-theme-create]');
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForSelector('#custom-theme-name');
check('redaktori i temës në anglisht', (await page.innerText('[role="dialog"], .modal')).includes('Theme name'));
await page.fill('#custom-theme-name', 'Test theme');
await page.click('[data-save]');
await page.waitForTimeout(300);
check('tema e personalizuar ruhet dhe aplikohet', await page.evaluate(() => document.documentElement.dataset.theme === 'custom'
  && JSON.parse(localStorage.getItem('ajemire.v1')).settings.customThemes.some(item => item.name === 'Test theme')));
const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
const serious = report.violations.filter(item => ['serious', 'critical'].includes(item.impact));
check('a11y me temën e personalizuar', serious.length === 0, serious.map(item => item.id).join(','));
await page.evaluate(() => window.AJM.app.setLanguage('sq'));

check('pa gabime në konsolë', problems.length === 0, problems.join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);
