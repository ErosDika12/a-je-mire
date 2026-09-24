-- Faza 2 · Moduli 7: njoftimet opsionale.
-- Njoftimi nuk mbart kurrë përmbajtje: vetëm një kategori. Teksti ("Ke një mesazh të ri") ndërtohet
-- nga përkthimet në dërgim — pa vlera matjesh, pa shënime, pa emra, pa "zbuluam diçka".
-- Rikthimi mbrapsht: supabase/rollback/20260924051730_down.sql

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Sekretet e serverit jetojnë në Vault. Vetëm service_role (funksionet e serverit) i lexon.
create or replace function public.service_get_secret(p_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;
revoke all on function public.service_get_secret(text) from public, anon, authenticated;
grant execute on function public.service_get_secret(text) to service_role;

create or replace function public.valid_notification_categories(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in
      ('daily_reminder', 'weekly_snapshot', 'connection_request', 'connection_accepted', 'unread_message', 'challenge_ending', 'app_update'))
    and not exists (select 1 from jsonb_each(p) e where jsonb_typeof(e.value) <> 'boolean');
$$;

create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  categories jsonb not null default '{}'::jsonb check (public.valid_notification_categories(categories)),
  reminder_time time not null default '20:00',
  timezone text not null default 'Europe/Belgrade',
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  lang text not null default 'sq' check (lang in ('sq', 'en')),
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "own prefs read" on public.notification_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs insert" on public.notification_prefs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.feature_enabled('notifications'));
create policy "own prefs update" on public.notification_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own prefs delete" on public.notification_prefs for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.notification_prefs_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger notification_prefs_guard before insert or update on public.notification_prefs
  for each row execute function public.notification_prefs_guard();

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own subscriptions read" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "own subscriptions insert" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.feature_enabled('notifications'));
create policy "own subscriptions delete" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Vetëm shërbimet e njohura të push-it: serveri nuk dërgon kurrë kërkesa në adresa të çfarëdoshme.
create or replace function public.push_subscriptions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.endpoint !~
     '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/' then
    raise exception 'invalid_endpoint' using errcode = '22023';
  end if;
  perform public.enforce_rate((select count(*) from public.push_subscriptions where user_id = new.user_id), 5, 'push_devices');
  return new;
end $$;
create trigger push_subscriptions_guard before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_guard();

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('daily_reminder', 'weekly_snapshot', 'connection_request',
                                             'connection_accepted', 'unread_message', 'challenge_ending', 'app_update')),
  dedupe_key text not null check (char_length(dedupe_key) <= 120),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  unique (user_id, dedupe_key)
);
create index notifications_pending_idx on public.notifications (created_at) where sent_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- Futja në radhë vetëm kur marrësi e ka ndezur vetë këtë kategori.
create or replace function public.enqueue_notification(p_user uuid, p_category text, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select server_enabled from public.feature_flags where key = 'notifications'), false) then return; end if;
  if exists (select 1 from public.notification_prefs p
             where p.user_id = p_user and p.enabled and coalesce((p.categories ->> p_category)::boolean, false)) then
    insert into public.notifications (user_id, category, dedupe_key) values (p_user, p_category, p_dedupe)
    on conflict (user_id, dedupe_key) do nothing;
  end if;
end $$;
revoke all on function public.enqueue_notification(uuid, text, text) from public, anon, authenticated;

create or replace function public.connections_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.enqueue_notification(new.addressee_id, 'connection_request', 'conn:' || new.id);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    perform public.enqueue_notification(new.requester_id, 'connection_accepted', 'acc:' || new.id);
  end if;
  return new;
end $$;
create trigger connections_notify after insert or update on public.connections
  for each row execute function public.connections_notify();

-- Një njoftim për bisedë për orë, pa tekstin e mesazhit.
create or replace function public.messages_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  other uuid;
begin
  select case when c.user_low = new.sender_id then c.user_high else c.user_low end into other
    from public.conversations c where c.id = new.conversation_id;
  perform public.enqueue_notification(other, 'unread_message',
    'msg:' || new.conversation_id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'));
  return new;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.messages_notify();

-- Kujtesat me orar, sipas zonës kohore të secilit. Thirret nga pg_cron çdo 15 minuta.
create or replace function public.generate_scheduled_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  p record;
  local_now timestamp;
begin
  if not coalesce((select server_enabled from public.feature_flags where key = 'notifications'), false) then return; end if;
  for p in select * from public.notification_prefs where enabled loop
    local_now := now() at time zone p.timezone;
    if local_now::time >= p.reminder_time and local_now::time < p.reminder_time + interval '15 minutes' then
      perform public.enqueue_notification(p.user_id, 'daily_reminder', 'daily:' || local_now::date);
      if extract(isodow from local_now) = 7 then
        perform public.enqueue_notification(p.user_id, 'weekly_snapshot', 'week:' || to_char(local_now, 'IYYY-IW'));
      end if;
      perform public.enqueue_notification(cp.user_id, 'challenge_ending', 'chal:' || c.id)
        from public.challenge_participants cp join public.challenges c on c.id = cp.challenge_id
        where cp.user_id = p.user_id and cp.completed_at is null and c.end_date = local_now::date + 1;
    end if;
  end loop;
end $$;

-- Pas dërgimit, funksioni i serverit shënon rreshtat; përdoruesi i sheh te historiku.
revoke execute on function public.notification_prefs_guard(), public.push_subscriptions_guard(), public.connections_notify(),
  public.messages_notify(), public.generate_scheduled_notifications() from public, anon, authenticated;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------- orari ----------
select cron.schedule('ajm-scheduled-notifications', '*/15 * * * *', $$select public.generate_scheduled_notifications()$$);
select cron.schedule('ajm-dispatch-notifications', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://iqvuhhwsbwqaqmdxsmga.supabase.co/functions/v1/notify-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.service_get_secret('cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.notifications where sent_at is null)
    and public.service_get_secret('cron_secret') is not null
$$);
-- Mbajtja e të dhënave: raportet e mbyllura, ndarjet e skaduara, njoftimet e vjetra.
select cron.schedule('ajm-retention', '17 3 * * *', $$
  select public.purge_resolved_reports();
  select public.purge_inactive_shares();
  delete from public.notifications where created_at < now() - interval '90 days';
$$);
