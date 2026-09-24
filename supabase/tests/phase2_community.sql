-- Testi i autorizimit për themelin dhe komunitetin. Ekzekutohet në transaksion që kthehet mbrapsht.
-- Përdorues: A, B (të zakonshëm), C (i bllokuar nga A), M (moderator), D (admin), O (pronar).
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'm@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'o@test.invalid', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'moderator'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin'),
  ('00000000-0000-0000-0000-0000000000f1', 'owner');

-- Si përdorues: JWT me "amr" të freskët (p_fresh) ose të vjetër.
create function pg_temp.as_user(p_id uuid, p_fresh boolean default true) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', 'password',
      'timestamp', extract(epoch from now() - case when p_fresh then interval '0' else interval '2 hours' end)::bigint)))::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_system() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
grant execute on all functions in schema pg_temp to authenticated;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000a1';
  b uuid := '00000000-0000-0000-0000-0000000000b1';
  c uuid := '00000000-0000-0000-0000-0000000000c1';
  m uuid := '00000000-0000-0000-0000-0000000000e1';
  d uuid := '00000000-0000-0000-0000-0000000000d1';
  post_a uuid; post_c uuid; n int; rid bigint; j jsonb;
begin
  -- Profilet
  perform pg_temp.as_user(a); insert into public.public_profiles (user_id, nickname) values (a, 'Arta');
  perform pg_temp.as_user(b); insert into public.public_profiles (user_id, nickname) values (b, 'Besi');
  perform pg_temp.as_user(c); insert into public.public_profiles (user_id, nickname) values (c, 'Cani');

  -- 1. Emrat e rezervuar dhe imitimi refuzohen
  begin perform pg_temp.as_user(b); update public.public_profiles set nickname = 'Adm1n' where user_id = b; raise exception 'FAIL: reserved nickname accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(b); update public.public_profiles set nickname = 'ar.ta' where user_id = b; raise exception 'FAIL: impersonation accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Askush nuk shkruan profilin e tjetrit
  perform pg_temp.as_user(b); update public.public_profiles set bio = 'hack' where user_id = a; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B edited A profile'; end if;

  -- 2. Flamuri i fikur: postimi refuzohet edhe nga API
  begin perform pg_temp.as_user(a); insert into public.posts (author_id, body) values (a, 'Tung'); raise exception 'FAIL: post while flag off';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 3. Flamuri ndezur vetëm për pilot: pa qasje në pilot ende refuzohet
  perform pg_temp.as_system(); update public.feature_flags set server_enabled = true, pilot_only = true where key = 'community';
  begin perform pg_temp.as_user(a); insert into public.posts (author_id, body) values (a, 'Tung'); raise exception 'FAIL: post without pilot access';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_system(); insert into public.pilot_access (user_id) values (a), (b), (c);

  perform pg_temp.as_user(a); insert into public.posts (author_id, body) values (a, 'Postimi i parë') returning id into post_a;
  perform pg_temp.as_user(c); insert into public.posts (author_id, body) values (c, 'Postimi i C') returning id into post_c;

  -- 4. Nuk postohet në emër të tjetrit; statusi nuk falsifikohet
  begin perform pg_temp.as_user(b); insert into public.posts (author_id, body) values (a, 'imitim'); raise exception 'FAIL: B posted as A';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(b); insert into public.posts (author_id, body, status) values (b, 'x', 'hidden'); raise exception 'FAIL: status forged';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Matja e ndarë: vetëm struktura e lejuar
  begin perform pg_temp.as_user(b); insert into public.posts (author_id, body, shared) values (b, 'x', '{"kind":"average","metric":"sleep","value":7,"days":7,"note":"sekret"}'); raise exception 'FAIL: extra shared field';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(b); insert into public.posts (author_id, body, shared) values (b, 'Gjumi im', '{"kind":"average","metric":"sleep","value":7.2,"days":7}');

  -- 5. B sheh, reagon dhe përgjigjet
  perform pg_temp.as_user(b);
  select count(*) into n from public.posts where id = post_a; if n <> 1 then raise exception 'FAIL: B cannot see A post'; end if;
  insert into public.reactions (post_id, user_id, kind) values (post_a, b, 'support');
  insert into public.replies (post_id, author_id, body) values (post_a, b, 'Faleminderit');
  begin insert into public.reactions (post_id, user_id, kind) values (post_a, a, 'thanks'); raise exception 'FAIL: B reacted as A';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 6. A bllokon C: në të dy drejtimet nuk shihen dhe nuk ndërveprojnë
  perform pg_temp.as_user(a); perform public.block_user(c);
  perform pg_temp.as_user(c);
  select count(*) into n from public.posts where id = post_a; if n <> 0 then raise exception 'FAIL: blocked C sees A post'; end if;
  select count(*) into n from public.public_profiles where user_id = a; if n <> 0 then raise exception 'FAIL: blocked C sees A profile'; end if;
  begin insert into public.replies (post_id, author_id, body) values (post_a, c, 'hej'); raise exception 'FAIL: blocked C replied';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin insert into public.reactions (post_id, user_id, kind) values (post_a, c, 'same'); raise exception 'FAIL: blocked C reacted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a);
  select count(*) into n from public.posts where id = post_c; if n <> 0 then raise exception 'FAIL: A sees blocked C post'; end if;
  select count(*) into n from public.blocks; if n <> 1 then raise exception 'FAIL: A block list'; end if;
  perform pg_temp.as_user(c);
  select count(*) into n from public.blocks; if n <> 0 then raise exception 'FAIL: C sees who blocked them'; end if;

  -- 7. Heshtja: B hesht A, rrjedha e fsheh, por është vetëm preferencë
  perform pg_temp.as_user(b); insert into public.mutes (muter_id, muted_id) values (b, a);
  select count(*) into n from public.community_feed() f where f.author_id = a; if n <> 0 then raise exception 'FAIL: muted author in feed'; end if;
  perform pg_temp.as_user(a); select count(*) into n from public.mutes; if n <> 0 then raise exception 'FAIL: A sees mute'; end if;
  perform pg_temp.as_user(b); delete from public.mutes where muted_id = a;

  -- 8. Kufiri i shpejtësisë dhe dyfishimi
  perform pg_temp.as_user(a);
  begin insert into public.posts (author_id, body) values (a, 'Postimi i parë'); raise exception 'FAIL: duplicate accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  insert into public.posts (author_id, body) values (a, 'p2'), (a, 'p3'), (a, 'p4'), (a, 'p5');
  begin insert into public.posts (author_id, body) values (a, 'p6'); raise exception 'FAIL: rate limit not enforced';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 9. Fshirja: vetëm autori
  begin perform pg_temp.as_user(b); perform public.delete_post(post_a); raise exception 'FAIL: B deleted A post';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 10. Raportimi dhe moderimi
  perform pg_temp.as_user(b); rid := public.report_content('post', post_a::text, 'spam', 'test');
  begin perform pg_temp.as_user(b); perform * from public.mod_list_reports(); raise exception 'FAIL: user listed reports';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(b); j := public.mod_open_report(rid); raise exception 'FAIL: user opened report';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a); select count(*) into n from public.reports; if n <> 0 then raise exception 'FAIL: A sees report about them'; end if;
  perform pg_temp.as_user(m);
  select count(*) into n from public.reports; if n <> 0 then raise exception 'FAIL: moderator reads reports table directly'; end if;
  select count(*) into n from public.mod_list_reports(); if n <> 1 then raise exception 'FAIL: moderator queue %', n; end if;
  j := public.mod_open_report(rid);
  if j -> 'snapshot' ->> 'body' <> 'Postimi i parë' then raise exception 'FAIL: snapshot'; end if;
  perform public.mod_resolve_report(rid, 'remove', 'test');
  perform pg_temp.as_system();
  select count(*) into n from public.audit_events where action in ('report.open', 'report.resolve'); if n <> 2 then raise exception 'FAIL: audit %', n; end if;
  perform pg_temp.as_user(b); select count(*) into n from public.posts where id = post_a; if n <> 0 then raise exception 'FAIL: removed post visible'; end if;
  perform pg_temp.as_user(a); select to_jsonb(status) into j from public.posts where id = post_a;
  if j #>> '{}' <> 'removed' then raise exception 'FAIL: author cannot see moderation status'; end if;
  -- Moderatori nuk lexon auditimin
  perform pg_temp.as_user(m); select count(*) into n from public.audit_events; if n <> 0 then raise exception 'FAIL: moderator reads audit'; end if;

  -- 11. Sanksioni ndalon postimin
  perform pg_temp.as_system(); insert into public.sanctions (user_id, kind, reason, until) values (b, 'community_suspend', 'test', now() + interval '1 day');
  begin perform pg_temp.as_user(b); insert into public.posts (author_id, body) values (b, 'gjatë pezullimit'); raise exception 'FAIL: suspended user posted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 12. Rolet: pa vetë-ngritje, pa ngritje pa pronar, pa hyrje të freskët
  begin perform pg_temp.as_user(a); insert into public.user_roles (user_id, role) values (a, 'admin'); raise exception 'FAIL: self insert role';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(a); perform public.set_role('a@test.invalid', 'moderator', true); raise exception 'FAIL: user granted role';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(d); perform public.set_role('b@test.invalid', 'admin', true); raise exception 'FAIL: admin granted admin';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(d); perform public.set_role('d@test.invalid', 'owner', true); raise exception 'FAIL: owner granted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(d, false); perform public.set_role('b@test.invalid', 'moderator', true); raise exception 'FAIL: stale auth accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(d); perform public.set_role('b@test.invalid', 'moderator', true);
  begin perform pg_temp.as_user(d); perform public.set_role('d@test.invalid', 'moderator', false); raise exception 'FAIL: self role change';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Moderatori nuk ndryshon flamujt
  begin perform pg_temp.as_user(m); perform public.set_feature_flag('ai', true, true, true, true, false); raise exception 'FAIL: moderator changed flag';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 13. Anashkalimi i flamurit: kur serveri e fik modulin, API nuk kthen më asgjë
  perform pg_temp.as_system(); update public.feature_flags set server_enabled = false where key = 'community';
  perform pg_temp.as_user(b);
  select count(*) into n from public.posts; if n <> 0 then raise exception 'FAIL: posts readable while disabled'; end if;
  select count(*) into n from public.community_feed(); if n <> 0 then raise exception 'FAIL: feed while disabled'; end if;
end $$;

select 'PHASE2 COMMUNITY + ROLES: PASS' as result;
rollback;
