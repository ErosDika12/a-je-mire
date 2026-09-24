-- Faza 2 · Moduli 9: themeli i abonimeve (Stripe, pagesë e pritur nga Stripe).
-- Ruhen vetëm ID-të e klientit dhe të abonimit te Stripe. Kurrë numra kartash.
-- Anulimi nuk fshin asnjë të dhënë; eksporti, fshirja dhe modaliteti lokal mbeten falas.
-- Rikthimi mbrapsht: supabase/rollback/20260924051830_down.sql

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
create policy "own customer" on public.billing_customers for select to authenticated using (user_id = (select auth.uid()));

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  price_key text check (char_length(price_key) <= 40),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Pas një pagese të dështuar, Plus vazhdon 7 ditë pa ndërprerje.
  grace_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
-- Shkrimet bëhen vetëm nga webhook-u i verifikuar (service_role).

-- Idempotenca: çdo ngjarje e Stripe përpunohet një herë, edhe nëse Stripe e dërgon sërish.
create table public.webhook_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9]+$'),
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
alter table public.webhook_events enable row level security;

create or replace function public.has_plus_for(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user
      and (status in ('active', 'trialing') or (status in ('past_due', 'unpaid') and grace_until > now()))
  );
$$;
revoke all on function public.has_plus_for(uuid) from public, anon, authenticated;

create or replace function public.has_plus()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_plus_for(auth.uid());
$$;
revoke execute on function public.has_plus() from public, anon;
grant execute on function public.has_plus() to authenticated;

-- ---------- historiku i kopjeve (Plus) ----------
create table public.backup_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ciphertext text not null,
  salt text not null,
  iv text not null,
  format_version integer not null,
  revision bigint not null,
  device_id text not null,
  saved_at timestamptz not null
);
create index backup_versions_user_idx on public.backup_versions (user_id, revision desc);
alter table public.backup_versions enable row level security;
create policy "own versions read" on public.backup_versions for select to authenticated using (user_id = (select auth.uid()));
create policy "own versions delete" on public.backup_versions for delete to authenticated using (user_id = (select auth.uid()));

-- Para çdo mbishkrimi, versioni i vjetër (tashmë i enkriptuar) ruhet për përdoruesit Plus; mbahen 10.
create or replace function public.backup_versions_keep()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.has_plus_for(old.user_id) then
    insert into public.backup_versions (user_id, ciphertext, salt, iv, format_version, revision, device_id, saved_at)
    values (old.user_id, old.ciphertext, old.salt, old.iv, old.format_version, old.revision, old.device_id, old.updated_at);
    delete from public.backup_versions where user_id = old.user_id and id not in (
      select id from public.backup_versions where user_id = old.user_id order by revision desc limit 10);
  end if;
  return new;
end $$;
create trigger backup_versions_keep before update on public.encrypted_backups
  for each row when (old.ciphertext is distinct from new.ciphertext) execute function public.backup_versions_keep();
revoke execute on function public.backup_versions_keep() from public, anon, authenticated;

create or replace function public.my_subscription()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plus', public.has_plus_for(auth.uid()),
    'status', s.status, 'price_key', s.price_key, 'current_period_end', s.current_period_end,
    'cancel_at_period_end', s.cancel_at_period_end, 'grace_until', s.grace_until,
    'has_customer', exists (select 1 from public.billing_customers c where c.user_id = auth.uid()))
  from (select 1) one left join public.subscriptions s on s.user_id = auth.uid();
$$;
revoke execute on function public.my_subscription() from public, anon;
grant execute on function public.my_subscription() to authenticated;

-- Stafi i faturimit sheh metadata të abonimit — asnjë përmbajtje, asnjë raport, asnjë mesazh.
create or replace function public.billing_list_subscriptions(p_limit integer default 100)
returns table (user_id uuid, status text, price_key text, current_period_end timestamptz, cancel_at_period_end boolean, updated_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['billing', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.audit('billing.list', 'subscriptions', null, '{}'::jsonb);
  return query select s.user_id, s.status, s.price_key, s.current_period_end, s.cancel_at_period_end, s.updated_at
    from public.subscriptions s order by s.updated_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;
revoke execute on function public.billing_list_subscriptions(integer) from public, anon;
grant execute on function public.billing_list_subscriptions(integer) to authenticated;
