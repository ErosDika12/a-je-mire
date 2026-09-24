-- Faza 2 · Moduli 2: themeli i sigurisë për çdo modul të ri.
-- Rolet, flamujt e veçorive, auditimi, qasja në pilot, sanksionet dhe faqet e përmbajtjes.
-- Rikthimi mbrapsht: supabase/rollback/20260924045820_down.sql

-- ---------- konfigurim privat (pa asnjë politikë: klientët nuk e lexojnë kurrë) ----------
create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- ---------- rolet ----------
-- "user" nuk ruhet: çdo llogari është përdorues. Rolet shtesë jetojnë vetëm këtu, kurrë në metadata të klientit.
create type public.app_role as enum ('mentor', 'moderator', 'admin', 'owner', 'billing');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function public.has_any_role(p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = any (p_roles));
$$;

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_role(array['admin', 'owner']::public.app_role[]));
-- Asnjë politikë insert/update/delete: rolet ndryshohen vetëm nga funksionet më poshtë.

-- Hyrja e fundit me fjalëkalim duhet të jetë brenda dritares, për veprimet shumë të ndjeshme.
-- Supabase e vendos këtë në JWT te "amr": [{ method, timestamp }].
create or replace function public.recently_authenticated(p_max_age interval default interval '10 minutes')
returns boolean language sql stable set search_path = '' as $$
  select coalesce((
    select max((element ->> 'timestamp')::bigint)
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as element
  ), 0) >= extract(epoch from now() - p_max_age);
$$;

-- ---------- auditimi ----------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) <= 64),
  target_type text check (char_length(target_type) <= 32),
  target_id text check (char_length(target_id) <= 64),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);
alter table public.audit_events enable row level security;
create policy "admins read audit" on public.audit_events for select to authenticated
  using (public.has_any_role(array['admin', 'owner']::public.app_role[]));

-- Thirret vetëm nga funksionet e tjera "security definer"; askush nga klienti nuk e thërret drejtpërdrejt.
create or replace function public.audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------- qasja në pilot ----------
create table public.pilot_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.pilot_access enable row level security;
create policy "own pilot or admin" on public.pilot_access for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_role(array['admin', 'owner']::public.app_role[]));

create or replace function public.has_pilot_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.pilot_access where user_id = auth.uid())
    or exists (select 1 from public.user_roles where user_id = auth.uid())
  );
$$;

-- ---------- flamujt e veçorive ----------
-- enabled_<mjedisi> vendos nëse ndërfaqja e shfaq modulin; server_enabled është çelësi i serverit.
-- Politikat RLS të çdo moduli kontrollojnë server_enabled — anashkalimi i ndërfaqes nuk hap asgjë.
create table public.feature_flags (
  key text primary key check (key in ('community', 'connections', 'messages', 'challenges', 'mentor',
                                      'notifications', 'ai', 'subscriptions', 'analytics', 'admin')),
  enabled_development boolean not null default false,
  enabled_preview boolean not null default false,
  enabled_production boolean not null default false,
  server_enabled boolean not null default false,
  pilot_only boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.feature_flags enable row level security;
-- Flamujt janë konfigurim publik, jo të dhëna personale; leximi lejohet që ndërfaqja të dijë çfarë të shfaqë.
create policy "flags readable" on public.feature_flags for select to anon, authenticated using (true);

insert into public.feature_flags (key, pilot_only) values
  ('community', true), ('connections', true), ('messages', true), ('challenges', true), ('mentor', true),
  ('notifications', true), ('ai', true), ('subscriptions', true), ('analytics', false), ('admin', false);

create or replace function public.feature_enabled(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select server_enabled and (not pilot_only or public.has_pilot_access())
    from public.feature_flags where key = p_key
  ), false);
$$;

-- ---------- sanksionet ----------
create table public.sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('community_suspend', 'messaging_suspend')),
  reason text not null check (char_length(reason) between 3 and 300),
  until timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index sanctions_user_idx on public.sanctions (user_id, kind, until);
alter table public.sanctions enable row level security;
create policy "own sanctions or moderators" on public.sanctions for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]));

create or replace function public.is_sanctioned(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sanctions
    where user_id = p_user and kind = p_kind and revoked_at is null and until > now()
  );
$$;

-- ---------- përmbajtja e menaxhuar (rregullat, ndihma, njoftimet) ----------
create table public.content_pages (
  key text not null check (key in ('community_rules', 'help', 'announcement')),
  lang text not null check (lang in ('sq', 'en')),
  body text not null check (char_length(body) <= 8000),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (key, lang)
);
alter table public.content_pages enable row level security;
create policy "published content readable" on public.content_pages for select to anon, authenticated
  using (published or public.has_any_role(array['admin', 'owner']::public.app_role[]));

-- ---------- kufizuesi i shpejtësisë ----------
-- Një ndihmës i vetëm, që çdo trigger ta përdorë njësoj. Mesazhi është kod, ndërfaqja e përkthen.
create or replace function public.enforce_rate(p_count bigint, p_max integer, p_label text)
returns void language plpgsql volatile set search_path = '' as $$
begin
  if p_count >= p_max then
    raise exception 'rate_limited:%', p_label using errcode = 'P0429';
  end if;
end $$;

-- ---------- funksionet administrative ----------
create or replace function public.lookup_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.lookup_user_by_email(text) from public, anon, authenticated;

-- Pronari i parë: vetëm nëse nuk ka pronar, dhe vetëm për emailin e konfiguruar nga administrimi i bazës.
create or replace function public.claim_owner()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  configured text;
  caller_email text;
begin
  if exists (select 1 from public.user_roles where role = 'owner') then return false; end if;
  select value into configured from public.app_config where key = 'owner_email';
  select email into caller_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if configured is null or caller_email is null or lower(configured) <> lower(caller_email) then return false; end if;
  insert into public.user_roles (user_id, role, granted_by) values (auth.uid(), 'owner', auth.uid());
  perform public.audit('role.claim_owner', 'user', auth.uid()::text, '{}'::jsonb);
  return true;
end $$;

-- Dhënia e roleve: pronari jep admin/moderator/billing/mentor; admini jep vetëm moderator/billing/mentor.
-- Askush nuk ndryshon rolet e veta, dhe pronari nuk jepet kurrë nga këtu.
create or replace function public.set_role(p_email text, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not public.recently_authenticated() then raise exception 'reauth_required' using errcode = 'P0401'; end if;
  if p_role = 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'admin' and not public.has_role('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  target := public.lookup_user_by_email(p_email);
  if target is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if target = auth.uid() then raise exception 'forbidden_self' using errcode = '42501'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (target, p_role, auth.uid()) on conflict do nothing;
  else
    -- Një admin nuk heq dot rolin e një admini tjetër ose të pronarit.
    if p_role = 'admin' and not public.has_role('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
    delete from public.user_roles where user_id = target and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'role.grant' else 'role.revoke' end, 'user', target::text, jsonb_build_object('role', p_role));
end $$;

create or replace function public.set_feature_flag(p_key text, p_development boolean, p_preview boolean,
                                                   p_production boolean, p_server boolean, p_pilot_only boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.recently_authenticated() then raise exception 'reauth_required' using errcode = 'P0401'; end if;
  update public.feature_flags set enabled_development = p_development, enabled_preview = p_preview,
    enabled_production = p_production, server_enabled = p_server, pilot_only = p_pilot_only,
    updated_at = now(), updated_by = auth.uid()
  where key = p_key;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  perform public.audit('flag.update', 'flag', p_key, jsonb_build_object('development', p_development, 'preview', p_preview,
    'production', p_production, 'server', p_server, 'pilot_only', p_pilot_only));
end $$;

create or replace function public.set_pilot_access(p_email text, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  target := public.lookup_user_by_email(p_email);
  if target is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  if p_grant then
    insert into public.pilot_access (user_id, granted_by) values (target, auth.uid()) on conflict do nothing;
  else
    delete from public.pilot_access where user_id = target;
  end if;
  perform public.audit(case when p_grant then 'pilot.grant' else 'pilot.revoke' end, 'user', target::text, '{}'::jsonb);
end $$;

create or replace function public.update_content_page(p_key text, p_lang text, p_body text, p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.content_pages (key, lang, body, published, updated_at, updated_by)
  values (p_key, p_lang, p_body, p_published, now(), auth.uid())
  on conflict (key, lang) do update set body = excluded.body, published = excluded.published,
    updated_at = now(), updated_by = auth.uid();
  perform public.audit('content.update', 'content', p_key || ':' || p_lang, jsonb_build_object('published', p_published));
end $$;

-- Rolet e mia, për ndërfaqen. Nuk jep asgjë që RLS nuk e jep tashmë.
create or replace function public.my_roles()
returns public.app_role[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(role), '{}') from public.user_roles where user_id = auth.uid();
$$;

-- Asnjë funksion administrativ nuk është për vizitorët pa llogari.
revoke execute on function public.claim_owner() from public, anon;
revoke execute on function public.set_role(text, public.app_role, boolean) from public, anon;
revoke execute on function public.set_feature_flag(text, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.set_pilot_access(text, boolean) from public, anon;
revoke execute on function public.update_content_page(text, text, text, boolean) from public, anon;
revoke execute on function public.my_roles() from public, anon;
grant execute on function public.claim_owner(), public.my_roles() to authenticated;
grant execute on function public.set_role(text, public.app_role, boolean) to authenticated;
grant execute on function public.set_feature_flag(text, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_pilot_access(text, boolean) to authenticated;
grant execute on function public.update_content_page(text, text, text, boolean) to authenticated;
