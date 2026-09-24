// Webhook-u i Stripe: nënshkrimi verifikohet me librarinë zyrtare të Stripe, dhe çdo ngjarje
// përpunohet vetëm një herë (tabela webhook_events). Pa JWT: autentikimi është nënshkrimi.
import Stripe from 'npm:stripe@17.7.0';
import { serviceClient, secret, stripeClient, saveSubscription } from '../_shared/billing.ts';

const GRACE_DAYS = 7;

Deno.serve(async (req: Request) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  const admin = serviceClient();
  const webhookSecret = await secret(admin, 'stripe_webhook_secret');
  if (!webhookSecret) return reply({ error: 'not_configured' }, 503);
  const apiKey = await secret(admin, 'stripe_secret_key');
  // Verifikimi i nënshkrimit nuk ka nevojë për çelësin API; klienti krijohet vetëm për ta thirrur.
  const stripe = stripeClient(apiKey || 'sk_verification_only');

  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature || '', webhookSecret, 300, Stripe.createSubtleCryptoProvider());
  } catch (_error) {
    return reply({ error: 'invalid_signature' }, 400);
  }

  // Idempotenca: nëse ngjarja është përpunuar tashmë, nuk bëhet asgjë.
  const { data: existing } = await admin.from('webhook_events').select('processed_at').eq('id', event.id).maybeSingle();
  if (existing?.processed_at) return reply({ duplicate: true });
  if (!existing) await admin.from('webhook_events').insert({ id: event.id, type: event.type });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && customerId) {
          await admin.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
        }
        if (apiKey && session.subscription) {
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          await saveSubscription(admin, await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await saveSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const { data: row } = await admin.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
        // Pagesa e dështuar: Plus vazhdon edhe 7 ditë, të dhënat nuk preken kurrë.
        if (row) await admin.from('subscriptions').update({
          status: 'past_due', grace_until: new Date(Date.now() + GRACE_DAYS * 86400000).toISOString(), updated_at: new Date().toISOString()
        }).eq('user_id', row.user_id);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const { data: row } = await admin.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
        if (row) await admin.from('subscriptions').update({ grace_until: null, updated_at: new Date().toISOString() }).eq('user_id', row.user_id);
        break;
      }
      default:
        break;
    }
    await admin.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', event.id);
    return reply({ received: true });
  } catch (error) {
    // Stripe e riprovon vetë; gabimi ruhet pa të dhëna personale.
    await admin.from('webhook_events').update({ error: String((error as Error).message).slice(0, 120) }).eq('id', event.id);
    return reply({ error: 'processing_failed' }, 500);
  }
});
