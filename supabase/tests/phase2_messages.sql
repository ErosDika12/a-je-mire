-- Testi i lidhjeve dhe mesazheve. A, B të lidhur; C i huaj; M moderator.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'm@test.invalid', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'moderator');
insert into public.pilot_access (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.public_profiles (user_id, nickname) values
  ('00000000-0000-0000-0000-0000000000a1', 'Arta'), ('00000000-0000-0000-0000-0000000000b1', 'Besi'), ('00000000-0000-0000-0000-0000000000c1', 'Cani');
update public.feature_flags set server_enabled = true where key in ('connections', 'messages');

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
  req uuid; conv uuid; msg uuid; n int; rid bigint; j jsonb;
begin
  -- 1. Mesazh pa lidhje: i pamundur
  begin perform pg_temp.as_user(a); conv := public.start_conversation(b); raise exception 'FAIL: conversation without connection';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- 2. Kërkesa, anulimi, kërkesa sërish, refuzimi i fshehur
  perform pg_temp.as_user(a); req := public.request_connection('besi');
  perform pg_temp.as_user(a); perform public.remove_connection(req);
  perform pg_temp.as_user(a); req := public.request_connection('Besi');
  begin perform pg_temp.as_user(a); perform public.respond_connection(req, true); raise exception 'FAIL: requester accepted own request';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(c); perform public.respond_connection(req, true); raise exception 'FAIL: stranger accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(c); select count(*) into n from public.connections; if n <> 0 then raise exception 'FAIL: C sees others connections'; end if;
  perform pg_temp.as_user(b); perform public.respond_connection(req, true);
  perform pg_temp.as_user(a); select count(*) into n from public.my_connections() where status = 'accepted'; if n <> 1 then raise exception 'FAIL: accepted list'; end if;

  -- C kërkon A, A refuzon: C nuk e sheh refuzimin
  perform pg_temp.as_user(c); req := public.request_connection('Arta');
  perform pg_temp.as_user(a); perform public.respond_connection(req, false);
  perform pg_temp.as_user(c); select count(*) into n from public.connections; if n <> 0 then raise exception 'FAIL: requester sees decline'; end if;

  -- 3. Biseda dhe mesazhet
  perform pg_temp.as_user(a); conv := public.start_conversation(b);
  insert into public.messages (conversation_id, sender_id, body) values (conv, a, 'Tung Besi') returning id into msg;
  begin insert into public.messages (conversation_id, sender_id, body) values (conv, b, 'imitim'); raise exception 'FAIL: A sent as B';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- I huaji nuk lexon, nuk shkruan, nuk e sheh bisedën
  perform pg_temp.as_user(c);
  select count(*) into n from public.messages; if n <> 0 then raise exception 'FAIL: C reads messages'; end if;
  select count(*) into n from public.conversations; if n <> 0 then raise exception 'FAIL: C sees conversation'; end if;
  begin insert into public.messages (conversation_id, sender_id, body) values (conv, c, 'hyrje'); raise exception 'FAIL: C wrote into conversation';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Moderatori NUK shfleton mesazhet
  perform pg_temp.as_user(m); select count(*) into n from public.messages; if n <> 0 then raise exception 'FAIL: moderator browses messages'; end if;

  -- 4. Të palexuarat dhe "Lexuar"
  perform pg_temp.as_user(b);
  select unread into n from public.my_conversations() where id = conv; if n <> 1 then raise exception 'FAIL: unread %', n; end if;
  perform public.mark_conversation_read(conv);
  select unread into n from public.my_conversations() where id = conv; if n <> 0 then raise exception 'FAIL: mark read'; end if;
  perform pg_temp.as_user(a);
  select count(*) into n from public.conversation_messages(conv) where read_by_other; if n <> 1 then raise exception 'FAIL: read receipt'; end if;

  -- 5. Fshirja lokale: vetëm për mua
  perform pg_temp.as_user(b); perform public.hide_conversation(conv);
  select count(*) into n from public.messages where conversation_id = conv; if n <> 0 then raise exception 'FAIL: hidden messages visible'; end if;
  perform pg_temp.as_user(a); select count(*) into n from public.messages where conversation_id = conv; if n <> 1 then raise exception 'FAIL: hide affected other'; end if;

  -- 6. Raporti i mesazhit: pamja nga serveri, hapja kërkon hyrje të freskët dhe auditohet
  perform pg_temp.as_user(b); insert into public.messages (conversation_id, sender_id, body) values (conv, b, 'Mesazh i keq') returning id into msg;
  begin perform pg_temp.as_user(b); rid := public.report_content('message', msg::text, 'harassment', ''); raise exception 'FAIL: reported own message';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a); rid := public.report_content('message', msg::text, 'harassment', 'test');
  begin perform pg_temp.as_user(c); rid := public.report_content('message', msg::text, 'spam', ''); raise exception 'FAIL: outsider reported message';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a); select id into rid from public.reports where target_type = 'message';
  begin perform pg_temp.as_user(m, false); j := public.mod_open_report(rid); raise exception 'FAIL: private report opened without reauth';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(m); j := public.mod_open_report(rid);
  if j -> 'snapshot' ->> 'body' <> 'Mesazh i keq' then raise exception 'FAIL: message snapshot'; end if;
  perform public.mod_resolve_report(rid, 'suspend_messaging_7d', 'test');
  begin perform pg_temp.as_user(b); insert into public.messages (conversation_id, sender_id, body) values (conv, b, 'gjatë pezullimit'); raise exception 'FAIL: suspended user messaged';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_system(); update public.sanctions set revoked_at = now();

  -- 7. Bllokimi ndalon mesazhet dhe heq lidhjen
  perform pg_temp.as_user(b); perform public.block_user(a);
  begin perform pg_temp.as_user(a); insert into public.messages (conversation_id, sender_id, body) values (conv, a, 'pas bllokimit'); raise exception 'FAIL: blocked user messaged';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(a); req := public.request_connection('Besi'); raise exception 'FAIL: blocked user requested connection';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a); select count(*) into n from public.connections where b in (requester_id, addressee_id); if n <> 0 then raise exception 'FAIL: connection survived block'; end if;

  -- 8. Flamuri i fikur: asnjë mesazh nuk lexohet nga API
  perform pg_temp.as_system(); update public.feature_flags set server_enabled = false where key = 'messages';
  perform pg_temp.as_user(a); select count(*) into n from public.messages; if n <> 0 then raise exception 'FAIL: messages readable while disabled'; end if;
end $$;

select 'PHASE2 CONNECTIONS + MESSAGES: PASS' as result;
rollback;
