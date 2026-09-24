-- Faza 2 · Moduli 3: komuniteti privat, bllokimi, heshtja, raportimi dhe moderimi.
-- Asnjë check-in, shënim, My Normal apo MY 5 nuk publikohet nga këtu: postimi përmban vetëm
-- tekstin që shkruan përdoruesi dhe, nëse e zgjedh shprehimisht, një matje të vetme të paraparë.
-- Rikthimi mbrapsht: supabase/rollback/20260924050207_down.sql

-- ---------- bllokimi dhe heshtja ----------
create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));

-- Bllokimi punon në të dy drejtimet: asnjëri nuk sheh apo prek tjetrin.
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create table public.mutes (
  muter_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table public.mutes enable row level security;
-- Heshtja është preferencë private: tjetri nuk e merr vesh kurrë.
create policy "own mutes read" on public.mutes for select to authenticated using (muter_id = (select auth.uid()));
create policy "own mutes insert" on public.mutes for insert to authenticated with check (muter_id = (select auth.uid()));
create policy "own mutes delete" on public.mutes for delete to authenticated using (muter_id = (select auth.uid()));

-- ---------- profili publik ----------
-- Çelësi i emrit heq shkronjat që ngatërrohen (0/o, 1/l, 3/e...) dhe shenjat, që "adm1n" të mos kalojë si emër i ri.
create or replace function public.nickname_key(p_nickname text)
returns text language sql immutable set search_path = '' as $$
  select translate(regexp_replace(lower(translate(p_nickname, 'ÇçËë', 'CcEe')), '[^a-z0-9]', '', 'g'), '013457', 'oleast');
$$;

create table public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 24 and nickname ~ '^[A-Za-z0-9ÇçËë_.-]+$'),
  nickname_key text generated always as (public.nickname_key(nickname)) stored unique,
  avatar_seed integer not null default floor(random() * 1000000)::integer,
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.public_profiles enable row level security;

-- Emrat që mund të ngatërrohen me stafin ose me vetë aplikacionin nuk lejohen.
create or replace function public.check_nickname()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.nickname_key(new.nickname) ~ '^(admin|administrator|moderator|mod|owner|staff|support|official|system|root|ajemire|kosict|mentor|helpdesk)'
     or public.nickname_key(new.nickname) in ('ajemire2036', 'ndihma', 'stafi') then
    raise exception 'nickname_reserved' using errcode = 'P0409';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger public_profiles_check before insert or update on public.public_profiles
  for each row execute function public.check_nickname();

create policy "profiles visible to members" on public.public_profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((public.feature_enabled('community') or public.feature_enabled('connections'))
        and not public.blocked_between((select auth.uid()), user_id))
  );
create policy "own profile insert" on public.public_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own profile update" on public.public_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own profile delete" on public.public_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- matja e ndarë (vetëm me veprim të qartë) ----------
-- Struktura e lejuar është e ngushtë: një matje, një mesatare ose një ndryshim. Asnjë shënim, asnjë emër.
create or replace function public.valid_shared_measure(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) <= 4
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('kind', 'metric', 'value', 'days'))
    and p ->> 'kind' in ('average', 'change_pct')
    and p ->> 'metric' in ('mood', 'sleep', 'energy', 'social', 'joy', 'load')
    and jsonb_typeof(p -> 'value') = 'number'
    and (p ->> 'value')::numeric between -100 and 500
    and jsonb_typeof(p -> 'days') = 'number'
    and (p ->> 'days')::integer between 1 and 30
  );
$$;

-- ---------- postimet ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  shared jsonb check (public.valid_shared_measure(shared)),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'deleted' and body = '') or char_length(btrim(body)) between 1 and 1000)
);
create index posts_feed_idx on public.posts (created_at desc, id desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
alter table public.posts enable row level security;

create policy "posts visible" on public.posts for select to authenticated
  using (
    public.feature_enabled('community') and (
      author_id = (select auth.uid())
      or (status = 'visible' and not public.blocked_between((select auth.uid()), author_id))
    )
  );
create policy "post insert" on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.feature_enabled('community')
    and status = 'visible' and deleted_at is null
    and exists (select 1 from public.public_profiles where user_id = (select auth.uid()))
    and not public.is_sanctioned((select auth.uid()), 'community_suspend')
  );
-- Asnjë politikë update/delete: fshirja dhe moderimi kalojnë nga funksionet, që të jenë të kontrolluara.

-- Kufijtë e shpejtësisë dhe mbrojtja nga spam-i, në bazë, jo vetëm në ndërfaqe.
create or replace function public.posts_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_rate((select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '10 minutes'), 5, 'posts_10min');
  perform public.enforce_rate((select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '1 day'), 30, 'posts_day');
  if exists (select 1 from public.posts where author_id = new.author_id and body = new.body and created_at > now() - interval '1 day') then
    raise exception 'duplicate_content' using errcode = 'P0409';
  end if;
  if (select count(*) from regexp_matches(new.body, 'https?://|www\.', 'gi')) > 2 then
    raise exception 'too_many_links' using errcode = 'P0422';
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
create trigger posts_guard before insert on public.posts for each row execute function public.posts_guard();

-- ---------- përgjigjet ----------
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'deleted' and body = '') or char_length(btrim(body)) between 1 and 500)
);
create index replies_post_idx on public.replies (post_id, created_at, id);
create index replies_author_idx on public.replies (author_id, created_at desc);
alter table public.replies enable row level security;

create policy "replies visible" on public.replies for select to authenticated
  using (
    public.feature_enabled('community')
    and exists (select 1 from public.posts p where p.id = post_id)
    and (author_id = (select auth.uid())
         or (status = 'visible' and not public.blocked_between((select auth.uid()), author_id)))
  );
create policy "reply insert" on public.replies for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.feature_enabled('community')
    and status = 'visible' and deleted_at is null
    and exists (select 1 from public.public_profiles where user_id = (select auth.uid()))
    and not public.is_sanctioned((select auth.uid()), 'community_suspend')
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible'
                and not public.blocked_between((select auth.uid()), p.author_id))
  );

create or replace function public.replies_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_rate((select count(*) from public.replies where author_id = new.author_id and created_at > now() - interval '10 minutes'), 20, 'replies_10min');
  perform public.enforce_rate((select count(*) from public.replies where author_id = new.author_id and created_at > now() - interval '1 day'), 200, 'replies_day');
  if (select count(*) from regexp_matches(new.body, 'https?://|www\.', 'gi')) > 1 then
    raise exception 'too_many_links' using errcode = 'P0422';
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
create trigger replies_guard before insert on public.replies for each row execute function public.replies_guard();

-- ---------- reagimet ----------
-- Tre reagime të buta. Pa "dislike", pa renditje sipas popullaritetit.
create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('support', 'thanks', 'same')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index reactions_user_idx on public.reactions (user_id);
alter table public.reactions enable row level security;
create policy "reactions visible" on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "reaction insert" on public.reactions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.feature_enabled('community')
    and not public.is_sanctioned((select auth.uid()), 'community_suspend')
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible'
                and not public.blocked_between((select auth.uid()), p.author_id))
  );
create policy "own reaction delete" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- vendimet për ndarje ----------
-- Çdo herë që përdoruesi shikon parapamjen e një matjeje, vendimi i tij ruhet (ndau ose anuloi).
create table public.share_decisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  context text not null check (context in ('community_post', 'mentor_grant')),
  decision text not null check (decision in ('shared', 'cancelled')),
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index share_decisions_user_idx on public.share_decisions (user_id, created_at desc);
alter table public.share_decisions enable row level security;
create policy "own share decisions read" on public.share_decisions for select to authenticated using (user_id = (select auth.uid()));
create policy "own share decisions insert" on public.share_decisions for insert to authenticated
  with check (user_id = (select auth.uid()) and jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 8);

-- ---------- funksionet e përdoruesit ----------
create or replace function public.delete_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set status = 'deleted', body = '', shared = null, deleted_at = now()
  where id = p_id and author_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  -- Reagimet e një postimi të fshirë nuk kanë më kuptim.
  delete from public.reactions where post_id = p_id;
end $$;

create or replace function public.delete_reply(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.replies set status = 'deleted', body = '', deleted_at = now()
  where id = p_id and author_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end $$;

-- Bllokimi heq edhe lidhjet ekzistuese (tabelat e moduleve të tjera e zgjerojnë këtë funksion).
create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_target is null or p_target = auth.uid() then raise exception 'invalid' using errcode = '22023'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from public.mutes where muter_id = auth.uid() and muted_id = p_target;
  delete from public.reactions r using public.posts p
    where r.post_id = p.id and ((r.user_id = p_target and p.author_id = auth.uid()) or (r.user_id = auth.uid() and p.author_id = p_target));
end $$;

create or replace function public.unblock_user(p_target uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target;
$$;

-- Lista e bllokuarve ka nevojë për pseudonimin, edhe pse RLS e fsheh profilin e tyre.
create or replace function public.my_blocks()
returns table (user_id uuid, nickname text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, coalesce(pp.nickname, '—'), b.created_at
  from public.blocks b left join public.public_profiles pp on pp.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- Rrjedha e postimeve, me faqosje sipas (koha, id). Funksion "invoker": RLS vlen plotësisht.
create or replace function public.community_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (id uuid, author_id uuid, nickname text, avatar_seed integer, body text, shared jsonb, status text,
               created_at timestamptz, reply_count bigint, reactions jsonb, my_reactions text[], mine boolean)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.author_id, pp.nickname, pp.avatar_seed, p.body, p.shared, p.status, p.created_at,
    (select count(*) from public.replies r where r.post_id = p.id and r.status = 'visible'),
    (select coalesce(jsonb_object_agg(t.kind, t.n), '{}'::jsonb)
       from (select x.kind, count(*) as n from public.reactions x where x.post_id = p.id group by x.kind) t),
    (select coalesce(array_agg(x.kind), '{}') from public.reactions x where x.post_id = p.id and x.user_id = auth.uid()),
    p.author_id = auth.uid()
  from public.posts p
  left join public.public_profiles pp on pp.user_id = p.author_id
  where p.status <> 'deleted'
    and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = p.author_id)
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.post_replies(p_post uuid, p_after timestamptz default null, p_limit integer default 30)
returns table (id uuid, author_id uuid, nickname text, avatar_seed integer, body text, status text, created_at timestamptz, mine boolean)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.author_id, pp.nickname, pp.avatar_seed, r.body, r.status, r.created_at, r.author_id = auth.uid()
  from public.replies r
  left join public.public_profiles pp on pp.user_id = r.author_id
  where r.post_id = p_post and r.status <> 'deleted'
    and (p_after is null or r.created_at > p_after)
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = r.author_id)
  order by r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- ---------- raportimet ----------
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('post', 'reply', 'profile', 'message', 'conversation')),
  target_id text not null check (char_length(target_id) <= 64),
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'safety_concern', 'sexual', 'privacy', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  -- Pamja e përmbajtjes në momentin e raportit, e marrë nga serveri — raportuesi nuk mund ta falsifikojë.
  snapshot jsonb not null,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution text
);
create index reports_queue_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
alter table public.reports enable row level security;
-- Raportuesi sheh vetëm raportet e veta. Moderatorët NUK kanë politikë leximi: hyjnë vetëm nga
-- funksionet më poshtë, që regjistrojnë çdo hapje në auditim.
create policy "own reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

create or replace function public.report_content(p_type text, p_target text, p_reason text, p_details text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  snap jsonb;
  owner_id uuid;
  existing bigint;
  new_id bigint;
  post_row public.posts%rowtype;
  reply_row public.replies%rowtype;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_type in ('post', 'reply', 'profile') and not public.feature_enabled('community') then
    raise exception 'feature_disabled' using errcode = '42501';
  end if;
  perform public.enforce_rate((select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour'), 10, 'reports_hour');

  if p_type = 'post' then
    select * into post_row from public.posts where id = p_target::uuid and status = 'visible';
    if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
    owner_id := post_row.author_id;
    snap := jsonb_build_object('body', post_row.body, 'shared', post_row.shared, 'created_at', post_row.created_at,
      'nickname', (select nickname from public.public_profiles where user_id = owner_id));
  elsif p_type = 'reply' then
    select * into reply_row from public.replies where id = p_target::uuid and status = 'visible';
    if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
    owner_id := reply_row.author_id;
    snap := jsonb_build_object('body', reply_row.body, 'created_at', reply_row.created_at,
      'nickname', (select nickname from public.public_profiles where user_id = owner_id));
  elsif p_type = 'profile' then
    select user_id, jsonb_build_object('nickname', nickname, 'bio', bio) into owner_id, snap
      from public.public_profiles where user_id = p_target::uuid;
    if owner_id is null then raise exception 'not_found' using errcode = 'P0404'; end if;
  else
    -- Mesazhet dhe bisedat shtohen nga migrimi i mesazheve, që e zgjeron këtë funksion.
    raise exception 'unsupported' using errcode = '22023';
  end if;

  if owner_id = me then raise exception 'cannot_report_self' using errcode = '22023'; end if;

  select id into existing from public.reports
    where reporter_id = me and target_type = p_type and target_id = p_target and status = 'open';
  if existing is not null then return existing; end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details, snapshot)
  values (me, p_type, p_target, owner_id, p_reason, left(coalesce(p_details, ''), 500), snap)
  returning id into new_id;

  -- Tre raportues të ndryshëm fshehin përkohësisht përmbajtjen derisa ta shohë një moderator.
  if p_type in ('post', 'reply') and (select count(distinct reporter_id) from public.reports
      where target_type = p_type and target_id = p_target and status = 'open') >= 3 then
    if p_type = 'post' then update public.posts set status = 'hidden' where id = p_target::uuid and status = 'visible';
    else update public.replies set status = 'hidden' where id = p_target::uuid and status = 'visible'; end if;
    perform public.audit('moderation.auto_hide', p_type, p_target, '{}'::jsonb);
  end if;
  return new_id;
end $$;

-- ---------- moderimi ----------
create or replace function public.mod_list_reports(p_status text default 'open', p_before bigint default null, p_limit integer default 25)
returns table (id bigint, target_type text, target_id text, reason text, status text, created_at timestamptz, same_target_open bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Pa pamje të përmbajtjes dhe pa emrin e raportuesit: vetëm metadata për radhën.
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
      (select count(*) from public.reports o where o.target_type = r.target_type and o.target_id = r.target_id and o.status = 'open')
    from public.reports r
    where r.status = p_status and (p_before is null or r.id < p_before)
    order by r.id desc
    limit least(greatest(coalesce(p_limit, 25), 1), 100);
end $$;

create or replace function public.mod_open_report(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row_data public.reports%rowtype;
begin
  if not public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into row_data from public.reports where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  -- Mesazhet private hapen vetëm pas hyrjes së freskët dhe gjithmonë regjistrohen.
  if row_data.target_type in ('message', 'conversation') and not public.recently_authenticated() then
    raise exception 'reauth_required' using errcode = 'P0401';
  end if;
  perform public.audit('report.open', row_data.target_type, p_id::text, jsonb_build_object('target', row_data.target_id));
  return jsonb_build_object('id', row_data.id, 'target_type', row_data.target_type, 'target_id', row_data.target_id,
    'target_user_id', row_data.target_user_id, 'reason', row_data.reason, 'details', row_data.details,
    'snapshot', row_data.snapshot, 'status', row_data.status, 'created_at', row_data.created_at);
end $$;

create or replace function public.mod_resolve_report(p_id bigint, p_action text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  row_data public.reports%rowtype;
begin
  if not public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'hide', 'remove', 'restore', 'suspend_community_7d', 'suspend_messaging_7d') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  select * into row_data from public.reports where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;

  if p_action in ('hide', 'remove', 'restore') then
    if row_data.target_type = 'post' then
      update public.posts set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'visible' end
        where id = row_data.target_id::uuid and status <> 'deleted';
    elsif row_data.target_type = 'reply' then
      update public.replies set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'visible' end
        where id = row_data.target_id::uuid and status <> 'deleted';
    end if;
  elsif p_action like 'suspend_%' then
    if row_data.target_user_id is null then raise exception 'no_target_user' using errcode = '22023'; end if;
    insert into public.sanctions (user_id, kind, reason, until, created_by)
    values (row_data.target_user_id,
            case when p_action = 'suspend_community_7d' then 'community_suspend' else 'messaging_suspend' end,
            coalesce(nullif(btrim(p_note), ''), 'Shkelje e rregullave të komunitetit'), now() + interval '7 days', auth.uid());
  end if;

  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
    resolved_at = now(), resolved_by = auth.uid(), resolution = p_action
  where target_type = row_data.target_type and target_id = row_data.target_id and status = 'open';

  perform public.audit('report.resolve', row_data.target_type, p_id::text,
    jsonb_build_object('action', p_action, 'target', row_data.target_id, 'note', left(coalesce(p_note, ''), 200)));
end $$;

create or replace function public.mod_list_sanctions()
returns table (id bigint, user_id uuid, nickname text, kind text, reason text, until timestamptz, created_at timestamptz, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select s.id, s.user_id, pp.nickname, s.kind, s.reason, s.until, s.created_at, s.revoked_at
    from public.sanctions s left join public.public_profiles pp on pp.user_id = s.user_id
    order by s.created_at desc limit 200;
end $$;

create or replace function public.mod_revoke_sanction(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.sanctions set revoked_at = now() where id = p_id and revoked_at is null;
  perform public.audit('sanction.revoke', 'sanction', p_id::text, '{}'::jsonb);
end $$;

-- Mbajtja: pamjet e raporteve të mbyllura fshihen pas 180 ditësh (thirret nga pg_cron).
create or replace function public.purge_resolved_reports()
returns void language sql security definer set search_path = '' as $$
  update public.reports set snapshot = '{"purged": true}'::jsonb, details = ''
  where status <> 'open' and resolved_at < now() - interval '180 days' and snapshot <> '{"purged": true}'::jsonb;
$$;
revoke all on function public.purge_resolved_reports() from public, anon, authenticated;

revoke execute on function public.delete_post(uuid), public.delete_reply(uuid), public.block_user(uuid),
  public.unblock_user(uuid), public.my_blocks(), public.report_content(text, text, text, text),
  public.mod_list_reports(text, bigint, integer), public.mod_open_report(bigint),
  public.mod_resolve_report(bigint, text, text), public.mod_list_sanctions(), public.mod_revoke_sanction(bigint),
  public.community_feed(timestamptz, uuid, integer), public.post_replies(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.delete_post(uuid), public.delete_reply(uuid), public.block_user(uuid),
  public.unblock_user(uuid), public.my_blocks(), public.report_content(text, text, text, text),
  public.mod_list_reports(text, bigint, integer), public.mod_open_report(bigint),
  public.mod_resolve_report(bigint, text, text), public.mod_list_sanctions(), public.mod_revoke_sanction(bigint),
  public.community_feed(timestamptz, uuid, integer), public.post_replies(uuid, timestamptz, integer)
  to authenticated;
