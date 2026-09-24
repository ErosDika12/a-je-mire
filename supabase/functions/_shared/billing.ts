// Ndihmësit e përbashkët të faturimit. Asnjë numër karte nuk kalon kurrë nga këtu:
// pagesa bëhet te faqja e pritur e Stripe (Checkout), menaxhimi te Billing Portal.
import Stripe from 'npm:stripe@17.7.0';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export async function secret(admin: SupabaseClient, name: string) {
  return (await admin.rpc('service_get_secret', { p_name: name })).data as string | null;
}

export function stripeClient(key: string) {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), apiVersion: '2024-06-20' });
}

const STATUSES = ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'];

// Ruan vetëm ID-të dhe statusin. Asnjë email, asnjë adresë, asnjë kartë.
export async function saveSubscription(admin: SupabaseClient, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  let userId = subscription.metadata?.user_id || null;
  if (!userId) {
    const { data } = await admin.from('billing_customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = data?.user_id || null;
  }
  if (!userId) throw new Error('unknown_customer');
  const item = subscription.items?.data?.[0];
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (subscription as unknown as { current_period_end?: number }).current_period_end;
  await admin.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
  await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    status: STATUSES.includes(subscription.status) ? subscription.status : 'incomplete',
    price_key: item?.price?.lookup_key || item?.price?.id || null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    // Pagesa e rregulluar heq periudhën e faljes.
    grace_until: subscription.status === 'active' || subscription.status === 'trialing' ? null : undefined,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  return userId;
}
