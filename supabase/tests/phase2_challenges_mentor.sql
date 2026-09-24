-- Testi i sfidave dhe i ndarjes me mentor. A pronar, B lidhje, C i huaj, T mentor.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000071', 't@test.invalid', 'authenticated', 'authenticated');
insert into public.pilot_access (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-000000000071');
insert into public.public_profiles (user_id, nickname) values
  ('00000000-0000-0000-0000-0000000000a1', 'Arta'), ('00000000-0000-0000-0000-0000000000b1', 'Besi'), ('00000000-0000-0000-0000-0000000000c1', 'Cani');
insert into public.connections (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'accepted');
update public.feature_flags set server_enabled = true where key in ('challenges', 'mentor', 'connections');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_system() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
grant execute on all functions in schema pg_temp to authenticated;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000a1';
  b uuid := '00000000-0000-0000-0000-0000000000b1';
  c uuid := '00000000-0000-0000-0000-0000000000c1';
  t uuid := '00000000-0000-0000-0000-000000000071';
  ch uuid; g jsonb; gid uuid; code text; n int; j jsonb;
begin
  -- ---------- sfidat ----------
  perform pg_temp.as_user(a);
  insert into public.challenges (owner_id, template, target, start_date, end_date)
    values (a, 'checkins_5_in_7', 5, current_date, current_date + 6) returning id into ch;
  select count(*) into n from public.challenge_participants where challenge_id = ch; if n <> 1 then raise exception 'FAIL: owner auto-join'; end if;
  -- Lidhja B e sheh dhe bashkohet; i huaji C jo
  perform pg_temp.as_user(b); insert into public.challenge_participants (challenge_id, user_id) values (ch, b);
  perform pg_temp.as_user(c); select count(*) into n from public.challenges; if n <> 0 then raise exception 'FAIL: stranger sees challenge'; end if;
  begin insert into public.challenge_participants (challenge_id, user_id) values (ch, c); raise exception 'FAIL: stranger joined';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Progresi: vetëm i vetes, i kufizuar te objektivi, përfundimi nga serveri
  perform pg_temp.as_user(b); update public.challenge_participants set progress = 99 where challenge_id = ch and user_id = b;
  select count(*) into n from public.challenge_participants where user_id = b and progress = 5 and completed_at is not null;
  if n <> 1 then raise exception 'FAIL: progress clamp/completion'; end if;
  update public.challenge_participants set progress = 3 where challenge_id = ch and user_id = a; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B changed A progress'; end if;
  -- Fshehja e arritjes: A nuk e sheh më rreshtin e B
  update public.challenge_participants set hide_achievement = true where challenge_id = ch and user_id = b;
  perform pg_temp.as_user(a); select count(*) into n from public.challenge_participants where user_id = b; if n <> 0 then raise exception 'FAIL: hidden achievement visible'; end if;
  -- Largimi
  perform pg_temp.as_user(b); delete from public.challenge_participants where challenge_id = ch and user_id = b;

  -- ---------- mentori ----------
  perform pg_temp.as_user(a);
  g := public.create_sharing_grant('Mësuesja', 'Arta', array['sleep', 'mood', 'weekly_summary'], current_date - 7, null, true, now() + interval '30 days');
  gid := (g ->> 'id')::uuid; code := g ->> 'code';
  -- Vetëm kategoritë e lejuara; shënimet refuzohen
  insert into public.shared_entries (grant_id, kind, entry_date, payload) values (gid, 'day', current_date - 1, '{"sleep": 7.5, "mood": 6}');
  begin insert into public.shared_entries (grant_id, kind, entry_date, payload) values (gid, 'day', current_date - 2, '{"sleep": 7, "note": "sekret"}'); raise exception 'FAIL: note accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin insert into public.shared_entries (grant_id, kind, entry_date, payload) values (gid, 'day', current_date - 2, '{"energy": 5}'); raise exception 'FAIL: unshared category accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin insert into public.shared_entries (grant_id, kind, entry_date, payload) values (gid, 'day', current_date - 30, '{"sleep": 7}'); raise exception 'FAIL: outside range accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- I huaji nuk shkruan në ndarjen e A-së
  perform pg_temp.as_user(c);
  begin insert into public.shared_entries (grant_id, kind, entry_date, payload) values (gid, 'day', current_date, '{"sleep": 1}'); raise exception 'FAIL: stranger wrote share';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Kodi: jo nga vetë pronari, po nga mentori, një herë
  perform pg_temp.as_user(a);
  begin gid := public.accept_sharing_grant(code); raise exception 'FAIL: owner accepted own invite';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(t); gid := public.accept_sharing_grant(lower(code));
  perform pg_temp.as_user(c);
  begin gid := public.accept_sharing_grant(code); raise exception 'FAIL: invite reused';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Mentori nuk lexon tabelën drejtpërdrejt; lexon vetëm përmes funksionit që regjistron
  perform pg_temp.as_user(t);
  select count(*) into n from public.shared_entries; if n <> 0 then raise exception 'FAIL: mentor reads table directly'; end if;
  j := public.mentor_view_grant(gid);
  if jsonb_array_length(j -> 'entries') <> 1 or (j -> 'entries' -> 0 -> 'values' ->> 'sleep')::numeric <> 7.5 then raise exception 'FAIL: mentor view %', j; end if;
  -- Mentori nuk sheh asnjë të dhënë tjetër të A-së
  select count(*) into n from public.encrypted_backups; if n <> 0 then raise exception 'FAIL: mentor sees backup'; end if;
  perform pg_temp.as_user(a); select count(*) into n from public.sharing_access_log where action = 'viewed'; if n <> 1 then raise exception 'FAIL: access log'; end if;
  -- I huaji nuk hap ndarjen
  begin perform pg_temp.as_user(c); j := public.mentor_view_grant(gid); raise exception 'FAIL: stranger viewed grant';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- Skadimi: pas afatit mentori refuzohet dhe refuzimi regjistrohet
  perform pg_temp.as_system(); update public.sharing_grants set created_at = now() - interval '40 days', expires_at = now() - interval '1 minute' where id = gid;
  perform pg_temp.as_user(t); j := public.mentor_view_grant(gid);
  if j ->> 'error' is distinct from 'grant_inactive' or j ? 'entries' then raise exception 'FAIL: expired grant viewed'; end if;
  perform pg_temp.as_system(); select count(*) into n from public.sharing_access_log where grant_id = gid and action = 'expired_view_denied';
  if n <> 1 then raise exception 'FAIL: denied view not logged'; end if;

  -- Revokimi: i menjëhershëm, të dhënat fshihen
  update public.sharing_grants set created_at = now(), expires_at = now() + interval '10 days' where id = gid;
  perform pg_temp.as_user(a); perform public.revoke_sharing_grant(gid);
  select count(*) into n from public.shared_entries where grant_id = gid; if n <> 0 then raise exception 'FAIL: data kept after revoke'; end if;
  perform pg_temp.as_user(t); j := public.mentor_view_grant(gid);
  if j ->> 'error' is distinct from 'grant_inactive' or j ? 'entries' then raise exception 'FAIL: revoked grant viewed'; end if;

  -- Flamuri i fikur
  perform pg_temp.as_system(); update public.feature_flags set server_enabled = false where key in ('mentor', 'challenges');
  begin perform pg_temp.as_user(a); g := public.create_sharing_grant('X', '', array['sleep'], current_date, current_date, false, now() + interval '1 day'); raise exception 'FAIL: grant while disabled';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a); select count(*) into n from public.challenges; if n <> 0 then raise exception 'FAIL: challenges visible while disabled'; end if;
end $$;

select 'PHASE2 CHALLENGES + MENTOR: PASS' as result;
rollback;
