-- Faza 2 · Modulet 8, 10 dhe 13: kuota e AI-së, analitika anonime dhe listat e administrimit.
-- AI: asnjë kërkesë dhe asnjë përgjigje nuk ruhet këtu — vetëm numri i përdorimeve në ditë.
-- Analitika: pa ID përdoruesi, vetëm emra të lejuar ngjarjesh dhe fusha të lejuara.
-- Rikthimi mbrapsht: supabase/rollback/20260924051933_down.sql

-- ---------- AI ----------
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "own ai usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Konsumon një kërkesë nga kuota ditore (5 falas, 30 me Plus) dhe kthen sa mbeten.
create or replace function public.ai_consume()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  day_limit integer;
  used integer;
begin
  if me is null or not public.feature_enabled('ai') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  day_limit := case when public.has_plus_for(me) then 30 else 5 end;
  insert into public.ai_usage (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  if used > day_limit then raise exception 'rate_limited:ai_day' using errcode = 'P0429'; end if;
  return day_limit - used;
end $$;
revoke execute on function public.ai_consume() from public, anon;
grant execute on function public.ai_consume() to authenticated;

-- ---------- analitika ----------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null check (name in ('screen_opened', 'feature_enabled', 'operation_result', 'performance', 'flag_exposure')),
  props jsonb not null default '{}'::jsonb,
  app_version text not null check (app_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at desc);
alter table public.analytics_events enable row level security;
create policy "admins read analytics" on public.analytics_events for select to authenticated
  using (public.has_any_role(array['admin', 'owner']::public.app_role[]));

-- Validimi i dytë, në server: vetëm fushat e listës së bardhë, vetëm vlera të shkurtra dhe të parashikueshme.
-- Çdo gjë tjetër (vlera matjesh, shënime, emra, email, mesazhe, tekst AI) refuzohet.
create or replace function public.valid_analytics_props(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('screen', 'feature', 'outcome', 'duration_ms', 'flag', 'variant'))
    and (not p ? 'screen' or (p ->> 'screen') ~ '^[a-z0-9_]{1,32}$')
    and (not p ? 'feature' or (p ->> 'feature') ~ '^[a-z0-9_]{1,32}$')
    and (not p ? 'flag' or (p ->> 'flag') ~ '^[a-z0-9_]{1,32}$')
    and (not p ? 'variant' or (p ->> 'variant') ~ '^[a-z0-9_]{1,16}$')
    and (not p ? 'outcome' or (p ->> 'outcome') in ('success', 'failure'))
    and (not p ? 'duration_ms' or (jsonb_typeof(p -> 'duration_ms') = 'number' and (p ->> 'duration_ms')::numeric between 0 and 600000));
$$;

create or replace function public.track_event(p_name text, p_props jsonb, p_app_version text, p_device text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select server_enabled from public.feature_flags where key = 'analytics'), false) then return false; end if;
  if not public.valid_analytics_props(coalesce(p_props, '{}'::jsonb)) then raise exception 'invalid_event' using errcode = '22023'; end if;
  -- Kufi global kundër abuzimit, pa identifikuar askënd.
  perform public.enforce_rate((select count(*) from public.analytics_events where created_at > now() - interval '1 minute'), 600, 'analytics_minute');
  insert into public.analytics_events (name, props, app_version, device) values (p_name, coalesce(p_props, '{}'::jsonb), p_app_version, p_device);
  return true;
end $$;
revoke execute on function public.track_event(text, jsonb, text, text) from public;
grant execute on function public.track_event(text, jsonb, text, text) to anon, authenticated;

create or replace function public.analytics_summary(p_days integer default 30)
returns table (name text, label text, events bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select e.name, coalesce(e.props ->> 'screen', e.props ->> 'feature', e.props ->> 'flag', e.props ->> 'outcome', ''), count(*)
    from public.analytics_events e where e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 180))
    group by 1, 2 order by 3 desc limit 200;
end $$;
revoke execute on function public.analytics_summary(integer) from public, anon;
grant execute on function public.analytics_summary(integer) to authenticated;

select cron.schedule('ajm-analytics-retention', '37 3 * * *', $$delete from public.analytics_events where created_at < now() - interval '180 days'$$);

-- Pëlqimet e reja të granuluara.
alter table public.consent_records drop constraint if exists consent_records_kind_check;
alter table public.consent_records add constraint consent_records_kind_check
  check (kind in ('local_storage', 'cloud_backup', 'terms', 'privacy', 'analytics', 'notifications', 'mentor_sharing', 'ai_assistant', 'community'));

-- ---------- listat e administrimit ----------
-- Emaili tregohet i maskuar: mjafton për ta njohur, jo për ta nxjerrë.
create or replace function public.mask_email(p_email text)
returns text language sql immutable set search_path = '' as $$
  select case when p_email is null then null
    else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2) end;
$$;

create or replace function public.admin_list_staff()
returns table (user_id uuid, email_masked text, nickname text, roles public.app_role[], pilot boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select u.id, public.mask_email(u.email::text), pp.nickname,
      coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
      exists (select 1 from public.pilot_access pa where pa.user_id = u.id)
    from auth.users u
    left join public.public_profiles pp on pp.user_id = u.id
    where exists (select 1 from public.user_roles r where r.user_id = u.id)
       or exists (select 1 from public.pilot_access pa where pa.user_id = u.id)
    order by 3 nulls last limit 500;
end $$;

create or replace function public.admin_audit(p_before bigint default null, p_limit integer default 50)
returns table (id bigint, actor_nickname text, action text, target_type text, target_id text, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select a.id, coalesce(pp.nickname, public.mask_email(u.email::text)), a.action, a.target_type, a.target_id, a.details, a.created_at
    from public.audit_events a
    left join auth.users u on u.id = a.actor_id
    left join public.public_profiles pp on pp.user_id = a.actor_id
    where p_before is null or a.id < p_before
    order by a.id desc limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

revoke execute on function public.admin_list_staff(), public.admin_audit(bigint, integer) from public, anon;
grant execute on function public.admin_list_staff(), public.admin_audit(bigint, integer) to authenticated;
