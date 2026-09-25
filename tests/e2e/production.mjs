// Verifikimi i prodhimit: modulet e fikura nuk arrihen as nga ndërfaqja, as nga API-ja,
// edhe për një përdorues me qasje pilot. Rifreskim i fortë (pa cache) dhe konsola pa gabime.
// Përdorimi: BASE=https://a-je-mire.vercel.app E2E_PASSWORD=... node tests/e2e/production.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://a-je-mire.vercel.app';
const PASSWORD = process.env.E2E_PASSWORD;
const SUPABASE = 'https://iqvuhhwsbwqaqmdxsmga.supabase.co';
const KEY = 'sb_publishable_PPUrlFYy7jV5LJw9bGTJng_g_8EPNDS';
// v3: forumi me server lëvizi te #/forum; #/community është tani demoja sintetike në pajisje.
const DISABLED_SCREENS = ['forum', 'network', 'mentor', 'notifications', 'assistant', 'subscription'];
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };

const browser = await chromium.launch();
const problems = [];

async function open(email) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => problems.push(`${email}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') problems.push(`${email}: ${message.text().slice(0, 200)}`); });
  await page.goto(BASE + '/');
  await page.click('label[for="consent-store"]');
  await page.click('[data-mode="demo"]');
  await page.waitForSelector('#shell:not([hidden])');
  // Rifreskim i fortë: cache i çaktivizuar në shfletues.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.reload();
  await page.waitForSelector('#shell:not([hidden])');
  if (email) {
    await page.evaluate(() => window.AJM.app.goTo('account'));
    await page.fill('#f-email', email);
    await page.fill('#f-password', PASSWORD);
    await page.click('[data-form="login"] button[type="submit"]');
    await page.waitForSelector('#sync-centre, #accept-terms');
    await page.waitForTimeout(4000);
  }
  return { context, page };
}
const nav = page => page.$$eval('.nav [data-screen]', items => items.map(item => item.dataset.screen));
const tryOpen = async (page, screen) => { await page.evaluate(name => window.AJM.app.goTo(name), screen); await page.waitForTimeout(300); return page.evaluate(() => location.hash); };

// ---------- pa llogari ----------
const guest = await open(null);
let screens = await nav(guest.page);
check('pa llogari: modulet e fikura nuk shfaqen', DISABLED_SCREENS.every(id => !screens.includes(id)) && !screens.includes('admin'), screens.join(','));
check('pa llogari: sfidat private shfaqen', screens.includes('challenges'));
check('pa llogari: adresa #/forum kthehet te Sot', (await tryOpen(guest.page, 'forum')) === '#/dashboard');
await guest.page.evaluate(() => window.AJM.app.goTo('challenges'));
check('sfidat hapen', await guest.page.waitForSelector('#new-challenge').then(() => true, () => false));
const analyticsToggle = await (async () => { await guest.page.evaluate(() => window.AJM.app.goTo('privacy')); await guest.page.waitForTimeout(300); return guest.page.$('#analytics-consent'); })();
check('pa llogari: analitika nuk ofrohet (asnjë kërkesë rrjeti pa llogari)', !analyticsToggle);

// ---------- përdorues me qasje pilot ----------
const user = await open('p2-arta@ajm-test.invalid');
screens = await nav(user.page);
check('me qasje pilot: modulet e fikura prapë nuk shfaqen', DISABLED_SCREENS.every(id => !screens.includes(id)), screens.join(','));
check('përdoruesi pa rol nuk sheh administrimin', !screens.includes('admin'));
for (const id of [...DISABLED_SCREENS, 'admin']) check(`#/${id} nuk hapet`, (await tryOpen(user.page, id)) === '#/dashboard');
await user.page.evaluate(() => window.AJM.app.goTo('privacy'));
check('me llogari: analitika ofrohet si zgjedhje, e fikur si parazgjedhje',
  await user.page.waitForSelector('#analytics-consent').then(async element => !(await element.isChecked()), () => false));

// API drejtpërdrejt me tokenin e përdoruesit: baza refuzon, jo vetëm ndërfaqja.
const token = await user.page.evaluate(() => JSON.parse(localStorage.getItem('ajemire.auth')).access_token);
const headers = { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const me = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
const rest = (path, init = {}) => fetch(`${SUPABASE}/rest/v1/${path}`, { headers, ...init });
const rpc = (name, body = {}) => rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });

let response = await rest('posts', { method: 'POST', body: JSON.stringify({ author_id: me, body: 'prove' }) });
check('API: postimi refuzohet', response.status >= 400, String(response.status));
response = await rest('posts?select=id&limit=1');
check('API: postimet nuk lexohen', response.ok && (await response.json()).length === 0);
response = await rpc('community_feed');
check('API: rrjedha e komunitetit bosh ose e refuzuar', !response.ok || (await response.json()).length === 0, String(response.status));
response = await rpc('request_connection', { p_nickname: 'BesiE2E' });
check('API: kërkesa për lidhje refuzohet', response.status >= 400, String(response.status));
response = await rest('messages?select=id&limit=1');
check('API: mesazhet nuk lexohen', !response.ok || (await response.json()).length === 0);
response = await rpc('create_sharing_grant', { p_mentor_label: 'x', p_owner_label: '', p_categories: ['sleep'], p_range_start: '2026-09-01', p_range_end: '2026-09-02', p_include_future: false, p_expires_at: '2026-10-01T00:00:00Z' });
check('API: ndarja me mentor refuzohet', response.status >= 400, String(response.status));
response = await rest('notification_prefs', { method: 'POST', body: JSON.stringify({ user_id: me, enabled: true, categories: {} }) });
check('API: njoftimet refuzohen', response.status >= 400, String(response.status));
response = await fetch(`${SUPABASE}/functions/v1/ai-reflect`, { method: 'POST', headers, body: JSON.stringify({ purpose: 'summarize', lang: 'sq', metrics: {} }) });
check('API: asistenti AI refuzohet', response.status >= 400, `${response.status} ${(await response.text()).slice(0, 60)}`);
response = await fetch(`${SUPABASE}/functions/v1/billing`, { method: 'POST', headers, body: JSON.stringify({ action: 'checkout' }) });
check('API: pagesa refuzohet', response.status >= 400, `${response.status} ${(await response.text()).slice(0, 60)}`);
response = await rpc('ai_consume');
check('API: kuota e AI refuzohet', response.status >= 400, String(response.status));

// ---------- administratori ----------
const admin = await open('p2-admin@ajm-test.invalid');
const adminNav = await admin.page.waitForFunction(() => document.querySelector('.nav [data-screen="admin"]'), null, { timeout: 60000 }).then(() => true, () => false);
check('administratori sheh administrimin', adminNav);
await admin.page.evaluate(() => window.AJM.app.goTo('admin'));
await admin.page.click('[data-tab="flags"]');
check('tabela e flamujve në prodhim', await admin.page.waitForSelector('[data-save-flag="community"]').then(() => true, () => false));

check('konsola pa gabime', problems.length === 0, problems.join(' | '));
await browser.close();
console.log(failed ? `${failed} FAIL` : 'ALL PASS');
process.exit(failed ? 1 : 0);
