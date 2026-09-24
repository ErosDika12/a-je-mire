-- Faza 2 · Modulet 5 dhe 6: sfidat me miqtë dhe ndarja me një mentor.
-- Sfidat private jetojnë vetëm në pajisje; këtu ruhen vetëm sfidat me miqtë, me progres pjesëmarrjeje
-- (sa herë), kurrë vlera check-in. Pa renditje, pa "më i miri", pa dënime.
-- Rikthimi mbrapsht: supabase/rollback/20260924051336_down.sql

-- ---------- sfidat me miqtë ----------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template text not null check (template in ('checkins_5_in_7', 'activities_3_days', 'weekly_snapshot', 'export_backup', 'routine', 'reach_out')),
  title text not null default '' check (char_length(title) <= 60),
  target integer not null check (target between 1 and 60),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 90)
);
create index challenges_owner_idx on public.challenges (owner_id, end_date desc);
alter table public.challenges enable row level security;

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  hide_achievement boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_participants_user_idx on public.challenge_participants (user_id);
alter table public.challenge_participants enable row level security;

create or replace function public.is_challenge_participant(p_challenge uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_participants where challenge_id = p_challenge and user_id = auth.uid());
$$;

-- Sfida shihet nga pronari, nga pjesëmarrësit dhe nga lidhjet e pranuara të pronarit — askush tjetër.
create policy "challenge visible" on public.challenges for select to authenticated
  using (
    public.feature_enabled('challenges') and (
      owner_id = (select auth.uid())
      or public.is_challenge_participant(id)
      or (public.are_connected((select auth.uid()), owner_id) and not public.blocked_between((select auth.uid()), owner_id))
    )
  );
create policy "challenge insert" on public.challenges for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.feature_enabled('challenges'));
create policy "challenge delete" on public.challenges for delete to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.challenges_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_rate((select count(*) from public.challenges where owner_id = new.owner_id and created_at > now() - interval '1 day'), 10, 'challenges_day');
  perform public.enforce_rate((select count(*) from public.challenges where owner_id = new.owner_id and end_date >= current_date), 20, 'challenges_active');
  return new;
end $$;
create trigger challenges_guard before insert on public.challenges for each row execute function public.challenges_guard();

-- Pronari bashkohet vetë, që sfida të mos ketë nevojë për hap shtesë.
create or replace function public.challenges_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.challenge_participants (challenge_id, user_id) values (new.id, new.owner_id);
  return new;
end $$;
create trigger challenges_after after insert on public.challenges for each row execute function public.challenges_after();

-- Pjesëmarrësit shohin njëri-tjetrin vetëm nëse arritja nuk është e fshehur, dhe kurrë një të bllokuar.
create policy "participants visible" on public.challenge_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or (exists (select 1 from public.challenges c where c.id = challenge_id)
        and not hide_achievement and not public.blocked_between((select auth.uid()), user_id))
  );
create policy "join challenge" on public.challenge_participants for insert to authenticated
  with check (
    user_id = (select auth.uid()) and progress = 0 and completed_at is null
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.end_date >= current_date)
  );
create policy "update own progress" on public.challenge_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "leave challenge" on public.challenge_participants for delete to authenticated
  using (user_id = (select auth.uid()));

-- Progresi nuk kalon objektivin dhe nuk ndryshohet pas mbarimit; përfundimi shënohet nga serveri.
create or replace function public.participants_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  goal integer; ends date;
begin
  select target, end_date into goal, ends from public.challenges where id = new.challenge_id;
  if tg_op = 'UPDATE' then
    if new.challenge_id <> old.challenge_id or new.user_id <> old.user_id or new.joined_at <> old.joined_at then
      raise exception 'immutable' using errcode = '42501';
    end if;
    if new.progress <> old.progress and current_date > ends then raise exception 'challenge_ended' using errcode = '42501'; end if;
  end if;
  new.progress := least(new.progress, goal);
  if new.progress >= goal and new.completed_at is null then new.completed_at := now(); end if;
  if new.progress < goal then new.completed_at := null; end if;
  return new;
end $$;
create trigger participants_guard before insert or update on public.challenge_participants
  for each row execute function public.participants_guard();
revoke execute on function public.challenges_guard(), public.challenges_after(), public.participants_guard() from public, anon, authenticated;

-- Lista pa renditje sipas progresit: sipas pseudonimit.
create or replace function public.challenge_board(p_challenge uuid)
returns table (nickname text, progress integer, target integer, completed boolean, mine boolean)
language sql stable security invoker set search_path = '' as $$
  select pp.nickname, p.progress, c.target, p.completed_at is not null, p.user_id = auth.uid()
  from public.challenge_participants p
  join public.challenges c on c.id = p.challenge_id
  left join public.public_profiles pp on pp.user_id = p.user_id
  where p.challenge_id = p_challenge
  order by pp.nickname nulls last;
$$;

-- ---------- ndarja me mentor ----------
create table public.sharing_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mentor_id uuid references auth.users(id) on delete cascade,
  mentor_label text not null check (char_length(btrim(mentor_label)) between 1 and 40),
  owner_label text not null default '' check (char_length(owner_label) <= 40),
  invite_code_hash text not null unique,
  categories text[] not null check (
    cardinality(categories) between 1 and 8
    and categories <@ array['mood', 'sleep', 'energy', 'social', 'joy', 'load', 'weekly_summary', 'activities']),
  range_start date not null,
  range_end date,
  include_future boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (range_end is null or range_end >= range_start),
  check (include_future or range_end is not null),
  check (expires_at > created_at and expires_at <= created_at + interval '366 days')
);
create index sharing_grants_owner_idx on public.sharing_grants (owner_id, created_at desc);
create index sharing_grants_mentor_idx on public.sharing_grants (mentor_id);
alter table public.sharing_grants enable row level security;
create policy "grant parties" on public.sharing_grants for select to authenticated
  using (owner_id = (select auth.uid()) or mentor_id = (select auth.uid()));

create table public.shared_entries (
  grant_id uuid not null references public.sharing_grants(id) on delete cascade,
  kind text not null check (kind in ('day', 'week')),
  entry_date date not null,
  payload jsonb not null,
  uploaded_at timestamptz not null default now(),
  primary key (grant_id, kind, entry_date)
);
alter table public.shared_entries enable row level security;
-- Vetëm pronari lexon/shkruan rreshtat e vet. Mentori NUK ka politikë: lexon vetëm nga mentor_view_grant(),
-- që kontrollon afatin dhe regjistron çdo qasje.
create policy "owner reads shared" on public.shared_entries for select to authenticated
  using (exists (select 1 from public.sharing_grants g where g.id = grant_id and g.owner_id = (select auth.uid())));
create policy "owner writes shared" on public.shared_entries for insert to authenticated
  with check (exists (select 1 from public.sharing_grants g where g.id = grant_id and g.owner_id = (select auth.uid())));
create policy "owner updates shared" on public.shared_entries for update to authenticated
  using (exists (select 1 from public.sharing_grants g where g.id = grant_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.sharing_grants g where g.id = grant_id and g.owner_id = (select auth.uid())));
create policy "owner deletes shared" on public.shared_entries for delete to authenticated
  using (exists (select 1 from public.sharing_grants g where g.id = grant_id and g.owner_id = (select auth.uid())));

-- Çdo kufi i ndarjes zbatohet këtu, pavarësisht çfarë dërgon ndërfaqja.
create or replace function public.shared_entries_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  g public.sharing_grants%rowtype;
  metric_keys text[] := array['mood', 'sleep', 'energy', 'social', 'joy', 'load'];
  key text;
begin
  select * into g from public.sharing_grants where id = new.grant_id;
  if g.revoked_at is not null or g.expires_at <= now() then raise exception 'grant_inactive' using errcode = '42501'; end if;
  if not (new.entry_date >= g.range_start
          and (new.entry_date <= coalesce(g.range_end, 'infinity'::date)
               or (g.include_future and new.entry_date >= g.created_at::date))) then
    raise exception 'outside_range' using errcode = '42501';
  end if;
  if jsonb_typeof(new.payload) <> 'object' then raise exception 'invalid_payload' using errcode = '22023'; end if;
  if new.kind = 'day' then
    for key in select jsonb_object_keys(new.payload) loop
      if not (key = any (g.categories)) or key = 'weekly_summary' then
        raise exception 'category_not_shared:%', key using errcode = '42501';
      end if;
      if key = any (metric_keys) and (jsonb_typeof(new.payload -> key) <> 'number' or (new.payload ->> key)::numeric not between 0 and 24) then
        raise exception 'invalid_value' using errcode = '22023';
      end if;
      if key = 'activities' and (jsonb_typeof(new.payload -> key) <> 'array' or jsonb_array_length(new.payload -> key) > 12
          or exists (select 1 from jsonb_array_elements(new.payload -> key) e where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 24)) then
        raise exception 'invalid_activities' using errcode = '22023';
      end if;
    end loop;
  else
    if not ('weekly_summary' = any (g.categories)) then raise exception 'category_not_shared:weekly_summary' using errcode = '42501'; end if;
    if exists (select 1 from jsonb_object_keys(new.payload) k where k not in ('changes', 'days'))
       or jsonb_typeof(new.payload -> 'changes') <> 'array' or jsonb_array_length(new.payload -> 'changes') > 6
       or exists (select 1 from jsonb_array_elements(new.payload -> 'changes') e
                  where exists (select 1 from jsonb_object_keys(e) k where k not in ('metric', 'direction', 'pct'))) then
      raise exception 'invalid_summary' using errcode = '22023';
    end if;
  end if;
  new.uploaded_at := now();
  return new;
end $$;
create trigger shared_entries_guard before insert or update on public.shared_entries
  for each row execute function public.shared_entries_guard();

create table public.sharing_access_log (
  id bigint generated always as identity primary key,
  grant_id uuid not null references public.sharing_grants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'accepted', 'viewed', 'downloaded', 'revoked', 'expired_view_denied')),
  created_at timestamptz not null default now()
);
create index sharing_access_log_grant_idx on public.sharing_access_log (grant_id, created_at desc);
alter table public.sharing_access_log enable row level security;
create policy "grant parties read log" on public.sharing_access_log for select to authenticated
  using (exists (select 1 from public.sharing_grants g where g.id = grant_id
                 and (g.owner_id = (select auth.uid()) or g.mentor_id = (select auth.uid()))));

create or replace function public.create_sharing_grant(p_mentor_label text, p_owner_label text, p_categories text[],
  p_range_start date, p_range_end date, p_include_future boolean, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  code text;
  new_id uuid;
begin
  if me is null or not public.feature_enabled('mentor') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  perform public.enforce_rate((select count(*) from public.sharing_grants where owner_id = me and created_at > now() - interval '1 day'), 10, 'grants_day');
  -- Kodi i ftesës tregohet vetëm një herë; ruhet vetëm gjurma e tij (hash).
  code := upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 10));
  insert into public.sharing_grants (owner_id, mentor_label, owner_label, invite_code_hash, categories, range_start, range_end, include_future, expires_at)
  values (me, btrim(p_mentor_label), btrim(coalesce(p_owner_label, '')), encode(extensions.digest(code, 'sha256'), 'hex'),
          p_categories, p_range_start, p_range_end, coalesce(p_include_future, false), p_expires_at)
  returning id into new_id;
  insert into public.sharing_access_log (grant_id, actor_id, action) values (new_id, me, 'created');
  insert into public.share_decisions (user_id, context, decision, fields) values (me, 'mentor_grant', 'shared', to_jsonb(p_categories));
  return jsonb_build_object('id', new_id, 'code', code);
end $$;

create or replace function public.accept_sharing_grant(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.sharing_grants%rowtype;
begin
  if me is null or not public.feature_enabled('mentor') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  select * into g from public.sharing_grants
    where invite_code_hash = encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex');
  -- Ftesa vlen 14 ditë, një herë, dhe jo për vetveten.
  if not found or g.mentor_id is not null or g.revoked_at is not null or g.expires_at <= now()
     or g.created_at < now() - interval '14 days' or g.owner_id = me or public.blocked_between(me, g.owner_id) then
    raise exception 'invalid_code' using errcode = 'P0404';
  end if;
  update public.sharing_grants set mentor_id = me, accepted_at = now() where id = g.id;
  insert into public.sharing_access_log (grant_id, actor_id, action) values (g.id, me, 'accepted');
  return g.id;
end $$;

-- Revokimi është i menjëhershëm: të dhënat e ndara fshihen në të njëjtin çast.
create or replace function public.revoke_sharing_grant(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.sharing_grants set revoked_at = now()
    where id = p_id and revoked_at is null and (owner_id = auth.uid() or mentor_id = auth.uid());
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  delete from public.shared_entries where grant_id = p_id;
  insert into public.sharing_access_log (grant_id, actor_id, action) values (p_id, auth.uid(), 'revoked');
end $$;

create or replace function public.mentor_view_grant(p_id uuid, p_download boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.sharing_grants%rowtype;
  entries jsonb;
begin
  select * into g from public.sharing_grants where id = p_id and mentor_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if g.revoked_at is not null or g.expires_at <= now() then
    insert into public.sharing_access_log (grant_id, actor_id, action) values (g.id, auth.uid(), 'expired_view_denied');
    raise exception 'grant_inactive' using errcode = '42501';
  end if;
  insert into public.sharing_access_log (grant_id, actor_id, action)
    values (g.id, auth.uid(), case when p_download then 'downloaded' else 'viewed' end);
  -- Filtri i dytë: edhe nëse një rresht do të kishte një fushë të tepërt, ajo nuk kthehet.
  select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'date', e.entry_date,
           'values', (select coalesce(jsonb_object_agg(k, e.payload -> k), '{}'::jsonb)
                      from jsonb_object_keys(e.payload) k
                      where (e.kind = 'day' and k = any (g.categories) and k <> 'weekly_summary')
                         or (e.kind = 'week' and k in ('changes', 'days'))))
         order by e.entry_date), '[]'::jsonb)
    into entries
    from public.shared_entries e
    where e.grant_id = g.id and e.entry_date >= g.range_start
      and (e.entry_date <= coalesce(g.range_end, 'infinity'::date) or (g.include_future and e.entry_date >= g.created_at::date));
  return jsonb_build_object('owner_label', g.owner_label, 'categories', g.categories, 'range_start', g.range_start,
    'range_end', g.range_end, 'include_future', g.include_future, 'expires_at', g.expires_at, 'entries', entries);
end $$;

create or replace function public.purge_inactive_shares()
returns void language sql security definer set search_path = '' as $$
  delete from public.shared_entries e using public.sharing_grants g
  where e.grant_id = g.id and (g.revoked_at is not null or g.expires_at <= now());
$$;

revoke execute on function public.shared_entries_guard(), public.purge_inactive_shares() from public, anon, authenticated;
revoke execute on function public.is_challenge_participant(uuid), public.challenge_board(uuid), public.create_sharing_grant(text, text, text[], date, date, boolean, timestamptz),
  public.accept_sharing_grant(text), public.revoke_sharing_grant(uuid), public.mentor_view_grant(uuid, boolean) from public, anon;
grant execute on function public.is_challenge_participant(uuid), public.challenge_board(uuid), public.create_sharing_grant(text, text, text[], date, date, boolean, timestamptz),
  public.accept_sharing_grant(text), public.revoke_sharing_grant(uuid), public.mentor_view_grant(uuid, boolean) to authenticated;
