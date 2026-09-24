-- Faza 2 · Moduli 4: lidhjet dhe mesazhet direkte.
-- Pa import kontaktesh, pa sugjerime, pa numra ndjekësish. Një lidhje kërkohet vetëm me pseudonimin e saktë.
-- Mesazhet NUK janë të enkriptuara skaj-më-skaj: enkriptohen gjatë transportit (TLS) dhe në disk nga ofruesi.
-- Rikthimi mbrapsht: supabase/rollback/20260924050833_down.sql

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- Një çift i vetëm, pavarësisht kush e dërgoi kërkesën.
create unique index connections_pair_idx on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
create index connections_requester_idx on public.connections (requester_id, status, created_at desc);
alter table public.connections enable row level security;
-- Kërkesa e refuzuar nuk i tregohet dërguesit: për të thjesht zhduket.
create policy "own connections" on public.connections for select to authenticated
  using (addressee_id = (select auth.uid()) or (requester_id = (select auth.uid()) and status <> 'declined'));
-- Asnjë politikë shkrimi: çdo ndryshim kalon nga funksionet më poshtë.

create or replace function public.are_connected(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and auth.uid() in (p_a, p_b) and exists (
    select 1 from public.connections
    where status = 'accepted' and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

create or replace function public.request_connection(p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.connections%rowtype;
  new_id uuid;
begin
  if me is null or not public.feature_enabled('connections') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  if public.is_sanctioned(me, 'community_suspend') then raise exception 'suspended' using errcode = '42501'; end if;
  if not exists (select 1 from public.public_profiles where user_id = me) then raise exception 'profile_required' using errcode = '42501'; end if;
  perform public.enforce_rate((select count(*) from public.connections where requester_id = me and created_at > now() - interval '1 day'), 20, 'connections_day');
  select user_id into target from public.public_profiles where nickname_key = public.nickname_key(p_nickname);
  -- I njëjti gabim kur emri nuk ekziston ose kur ka bllokim: bllokimi nuk zbulohet.
  if target is null or target = me or public.blocked_between(me, target) then raise exception 'not_found' using errcode = 'P0404'; end if;
  select * into existing from public.connections
    where least(requester_id, addressee_id) = least(me, target) and greatest(requester_id, addressee_id) = greatest(me, target);
  if found then
    if existing.status = 'declined' and existing.requester_id = me and existing.responded_at < now() - interval '30 days' then
      delete from public.connections where id = existing.id;
    elsif existing.status = 'pending' and existing.addressee_id = me then
      -- Të dy e kërkuan njëri-tjetrin: pranohet.
      update public.connections set status = 'accepted', responded_at = now() where id = existing.id;
      return existing.id;
    else
      return existing.id;
    end if;
  end if;
  insert into public.connections (requester_id, addressee_id) values (me, target) returning id into new_id;
  return new_id;
end $$;

create or replace function public.respond_connection(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.connections
    set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_id and addressee_id = auth.uid() and status = 'pending'
    and not public.blocked_between(requester_id, addressee_id);
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end $$;

-- Anulimi (kërkesë në pritje) dhe heqja (lidhje e pranuar) fshijnë rreshtin.
create or replace function public.remove_connection(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.connections
  where id = p_id and (requester_id = auth.uid() or addressee_id = auth.uid())
    and not (status = 'declined' and requester_id = auth.uid());
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
end $$;

-- Lista me pseudonimet; pa asnjë numërim publik.
create or replace function public.my_connections()
returns table (id uuid, other_id uuid, nickname text, avatar_seed integer, status text, direction text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,
    case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
    pp.nickname, pp.avatar_seed, c.status,
    case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    c.created_at
  from public.connections c
  left join public.public_profiles pp on pp.user_id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
  where (c.addressee_id = auth.uid() and c.status in ('pending', 'accepted'))
     or (c.requester_id = auth.uid() and c.status in ('pending', 'accepted'))
  order by c.status, pp.nickname;
$$;

-- ---------- bisedat ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (user_low < user_high),
  unique (user_low, user_high)
);
alter table public.conversations enable row level security;
create policy "member conversations" on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_low, user_high) and public.feature_enabled('messages'));

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  -- "Fshij bisedën" në këtë pajisje/llogari: mesazhet para kësaj kohe nuk shfaqen më për mua.
  hidden_before timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
alter table public.conversation_members enable row level security;
-- Anëtarët shohin njëri-tjetrin (për "Lexuar"), askush tjetër.
create policy "members see members" on public.conversation_members for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));

create or replace function public.is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = auth.uid());
$$;

create or replace function public.conversation_other(p_conversation uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when c.user_low = auth.uid() then c.user_high else c.user_low end
  from public.conversations c where c.id = p_conversation and auth.uid() in (c.user_low, c.user_high);
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select to authenticated
  using (
    public.feature_enabled('messages') and public.is_member(conversation_id)
    and created_at > (select m.hidden_before from public.conversation_members m
                      where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid()))
  );
-- Çdo mesazh kërkon veprim të qëllimshëm të dërguesit; serveri kontrollon lidhjen dhe bllokimin sa herë.
create policy "members send messages" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.feature_enabled('messages')
    and public.is_member(conversation_id)
    and not public.is_sanctioned((select auth.uid()), 'messaging_suspend')
    and public.are_connected((select auth.uid()), public.conversation_other(conversation_id))
    and not public.blocked_between((select auth.uid()), public.conversation_other(conversation_id))
  );

create or replace function public.messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_rate((select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute'), 20, 'messages_minute');
  perform public.enforce_rate((select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 day'), 500, 'messages_day');
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
create trigger messages_guard before insert on public.messages for each row execute function public.messages_guard();

create or replace function public.messages_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- Dërguesi e ka "lexuar" mesazhin e vet.
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger messages_after after insert on public.messages for each row execute function public.messages_after();
revoke execute on function public.messages_guard(), public.messages_after() from public, anon, authenticated;

create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  low uuid; high uuid; conv uuid;
begin
  if me is null or not public.feature_enabled('messages') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  if p_other is null or p_other = me or not public.are_connected(me, p_other) or public.blocked_between(me, p_other) then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  low := least(me, p_other); high := greatest(me, p_other);
  select id into conv from public.conversations where user_low = low and user_high = high;
  if conv is null then
    insert into public.conversations (user_low, user_high) values (low, high) returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, low), (conv, high);
  end if;
  return conv;
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.hide_conversation(p_conversation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set hidden_before = now(), last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.my_conversations()
returns table (id uuid, other_id uuid, nickname text, avatar_seed integer, last_message_at timestamptz,
               last_body text, last_from_me boolean, unread bigint, blocked boolean)
language sql stable security invoker set search_path = '' as $$
  select c.id, o.other_id, pp.nickname, pp.avatar_seed, c.last_message_at,
    lm.body, lm.sender_id = auth.uid(),
    (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
       and m.created_at > me.last_read_at),
    public.blocked_between(auth.uid(), o.other_id)
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
  cross join lateral (select case when c.user_low = auth.uid() then c.user_high else c.user_low end as other_id) o
  left join public.public_profiles pp on pp.user_id = o.other_id
  left join lateral (select m.body, m.sender_id from public.messages m where m.conversation_id = c.id
                     order by m.created_at desc, m.id desc limit 1) lm on true
  where c.last_message_at is not null and c.last_message_at > me.hidden_before
  order by c.last_message_at desc;
$$;

-- Faqosja: mesazhet para (koha, id) të dhënë, më të rejat së pari.
create or replace function public.conversation_messages(p_conversation uuid, p_before timestamptz default null,
                                                        p_before_id uuid default null, p_limit integer default 30)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz, mine boolean, read_by_other boolean)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.sender_id, m.body, m.created_at, m.sender_id = auth.uid(),
    m.sender_id = auth.uid() and exists (
      select 1 from public.conversation_members om
      where om.conversation_id = m.conversation_id and om.user_id <> auth.uid() and om.last_read_at >= m.created_at)
  from public.messages m
  where m.conversation_id = p_conversation
    and (p_before is null or (m.created_at, m.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Bllokimi tani heq edhe lidhjen dhe kërkesat mes dy personave.
create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_target is null or p_target = auth.uid() then raise exception 'invalid' using errcode = '22023'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from public.mutes where muter_id = auth.uid() and muted_id = p_target;
  delete from public.reactions r using public.posts p
    where r.post_id = p.id and ((r.user_id = p_target and p.author_id = auth.uid()) or (r.user_id = auth.uid() and p.author_id = p_target));
  delete from public.connections
    where least(requester_id, addressee_id) = least(auth.uid(), p_target)
      and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_target);
end $$;

-- Raportimi i mesazheve: pamja merret nga serveri, vetëm nga mesazhet e personit tjetër.
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
  message_row public.messages%rowtype;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_type in ('post', 'reply', 'profile') and not public.feature_enabled('community') and not public.feature_enabled('connections') then
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
  elsif p_type = 'message' then
    select m.* into message_row from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id and cm.user_id = me
      where m.id = p_target::uuid and m.sender_id <> me;
    if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
    owner_id := message_row.sender_id;
    snap := jsonb_build_object('body', message_row.body, 'created_at', message_row.created_at,
      'nickname', (select nickname from public.public_profiles where user_id = owner_id));
  elsif p_type = 'conversation' then
    if not exists (select 1 from public.conversation_members where conversation_id = p_target::uuid and user_id = me) then
      raise exception 'not_found' using errcode = 'P0404';
    end if;
    select case when c.user_low = me then c.user_high else c.user_low end into owner_id from public.conversations c where c.id = p_target::uuid;
    -- Vetëm 10 mesazhet e fundit, me dërguesin të shënuar si "raportuesi" ose "tjetri".
    select jsonb_build_object('nickname', (select nickname from public.public_profiles where user_id = owner_id),
      'messages', coalesce(jsonb_agg(jsonb_build_object('from', case when t.sender_id = me then 'reporter' else 'other' end,
                                                        'body', t.body, 'created_at', t.created_at) order by t.created_at), '[]'::jsonb))
      into snap
      from (select sender_id, body, created_at from public.messages where conversation_id = p_target::uuid
            order by created_at desc limit 10) t;
  else
    raise exception 'unsupported' using errcode = '22023';
  end if;

  if owner_id = me then raise exception 'cannot_report_self' using errcode = '22023'; end if;

  select id into existing from public.reports
    where reporter_id = me and target_type = p_type and target_id = p_target and status = 'open';
  if existing is not null then return existing; end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details, snapshot)
  values (me, p_type, p_target, owner_id, p_reason, left(coalesce(p_details, ''), 500), snap)
  returning id into new_id;

  if p_type in ('post', 'reply') and (select count(distinct reporter_id) from public.reports
      where target_type = p_type and target_id = p_target and status = 'open') >= 3 then
    if p_type = 'post' then update public.posts set status = 'hidden' where id = p_target::uuid and status = 'visible';
    else update public.replies set status = 'hidden' where id = p_target::uuid and status = 'visible'; end if;
    perform public.audit('moderation.auto_hide', p_type, p_target, '{}'::jsonb);
  end if;
  return new_id;
end $$;

revoke execute on function public.are_connected(uuid, uuid), public.is_member(uuid), public.conversation_other(uuid) from public, anon;
grant execute on function public.are_connected(uuid, uuid), public.is_member(uuid), public.conversation_other(uuid) to authenticated;
revoke execute on function public.request_connection(text), public.respond_connection(uuid, boolean), public.remove_connection(uuid),
  public.my_connections(), public.start_conversation(uuid), public.mark_conversation_read(uuid), public.hide_conversation(uuid),
  public.my_conversations(), public.conversation_messages(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.request_connection(text), public.respond_connection(uuid, boolean), public.remove_connection(uuid),
  public.my_connections(), public.start_conversation(uuid), public.mark_conversation_read(uuid), public.hide_conversation(uuid),
  public.my_conversations(), public.conversation_messages(uuid, timestamptz, uuid, integer) to authenticated;
