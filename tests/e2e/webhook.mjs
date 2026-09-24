// Testi i webhook-ut të Stripe: nënshkrimi, idempotenca, pagesa e dështuar, anulimi.
// Përdorimi: WEBHOOK_SECRET=whsec_test_... TEST_USER=<uuid> node tests/e2e/webhook.mjs
import { createHmac } from 'node:crypto';

const URL = 'https://iqvuhhwsbwqaqmdxsmga.supabase.co/functions/v1/stripe-webhook';
const SECRET = process.env.WEBHOOK_SECRET;
const USER = process.env.TEST_USER;
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };

// Nënshkrimi sipas skemës së dokumentuar të Stripe: v1 = HMAC-SHA256(secret, "t.payload").
function sign(payload, secret = SECRET, time = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${time}.${payload}`).digest('hex');
  return `t=${time},v1=${v1}`;
}
async function post(event, signature) {
  const payload = JSON.stringify(event);
  const response = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signature === null ? {} : { 'stripe-signature': signature ?? sign(payload) }) }, body: payload });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
const subscription = (id, status) => ({
  id: `evt_${id}`, object: 'event', type: status === 'canceled' ? 'customer.subscription.deleted' : 'customer.subscription.created',
  data: { object: { id: 'sub_E2ETEST', object: 'subscription', customer: 'cus_E2ETEST', status, cancel_at_period_end: false,
    metadata: { user_id: USER }, items: { data: [{ price: { id: 'price_test', lookup_key: 'plus_monthly' }, current_period_end: Math.floor(Date.now() / 1000) + 2592000 }] } } }
});

const created = subscription('E2E1', 'active');
check('pa nënshkrim refuzohet', (await post(created, null)).status === 400);
check('nënshkrim i gabuar refuzohet', (await post(created, sign(JSON.stringify(created), 'whsec_wrong'))).status === 400);
check('nënshkrim i vjetër (>5 min) refuzohet', (await post(created, sign(JSON.stringify(created), SECRET, Math.floor(Date.now() / 1000) - 600))).status === 400);
const first = await post(created);
check('ngjarja e vlefshme pranohet', first.status === 200 && first.body.received === true, JSON.stringify(first.body));
const again = await post(created);
check('e njëjta ngjarje dy herë: përpunohet një herë', again.status === 200 && again.body.duplicate === true, JSON.stringify(again.body));
const failed = await post({ id: 'evt_E2E2', object: 'event', type: 'invoice.payment_failed', data: { object: { id: 'in_E2E', object: 'invoice', customer: 'cus_E2ETEST' } } });
check('pagesa e dështuar pranohet', failed.status === 200);
const cancelled = await post(subscription('E2E3', 'canceled'));
check('anulimi pranohet', cancelled.status === 200);

const failedCount = results.filter(ok => !ok).length;
console.log(`\n${results.length - failedCount}/${results.length} kaluan`);
process.exit(failedCount ? 1 : 0);
