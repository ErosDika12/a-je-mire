-- Testi i njoftimeve, abonimeve, kuotës së AI-së, analitikës dhe listave të administrimit.
-- A falas, P me abonim, B faturim, M moderator, D admin.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000091', 'p@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'm@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.invalid', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'billing'), ('00000000-0000-0000-0000-0000000000e1', 'moderator'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin');
insert into public.pilot_access (user_id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-000000000091');
insert into public.public_profiles (user_id, nickname) values ('00000000-0000-0000-0000-0000000000a1', 'Arta'), ('00000000-0000-0000-0000-000000000091', 'Pleta');
insert into public.subscriptions (user_id, stripe_subscription_id, status, price_key) values ('00000000-0000-0000-0000-000000000091', 'sub_TEST1', 'active', 'plus_monthly');
update public.feature_flags set server_enabled = true where key in ('notifications', 'connections', 'ai', 'analytics');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.as_system() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000a1';
  b uuid := '00000000-0000-0000-0000-0000000000b1';
  p uuid := '00000000-0000-0000-0000-000000000091';
  m uuid := '00000000-0000-0000-0000-0000000000e1';
  d uuid := '00000000-0000-0000-0000-0000000000d1';
  n int; ok boolean; left_ int;
begin
  -- ---------- njoftimet ----------
  -- Pa pëlqim: kërkesa e lidhjes nuk krijon njoftim
  perform pg_temp.as_user(p); perform public.request_connection('Arta');
  perform pg_temp.as_system(); select count(*) into n from public.notifications where user_id = a; if n <> 0 then raise exception 'FAIL: notification without consent'; end if;
  delete from public.connections;
  -- Me pëlqim për atë kategori: krijohet, pa asnjë përmbajtje
  perform pg_temp.as_user(a);
  insert into public.notification_prefs (user_id, enabled, categories) values (a, true, '{"connection_request": true}');
  begin insert into public.notification_prefs (user_id, enabled, categories) values (p, true, '{}'); raise exception 'FAIL: prefs for other user';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update public.notification_prefs set timezone = 'Mars/Olympus' where user_id = a; raise exception 'FAIL: invalid timezone';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update public.notification_prefs set categories = '{"risk_alert": true}' where user_id = a; raise exception 'FAIL: unknown category';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(p); perform public.request_connection('Arta');
  perform pg_temp.as_user(a); select count(*) into n from public.notifications where category = 'connection_request'; if n <> 1 then raise exception 'FAIL: notification not created'; end if;
  perform pg_temp.as_user(p); select count(*) into n from public.notifications; if n <> 0 then raise exception 'FAIL: sees others notifications'; end if;
  begin insert into public.notifications (user_id, category, dedupe_key) values (a, 'daily_reminder', 'x'); raise exception 'FAIL: user inserted notification';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Push vetëm te shërbimet e njohura
  perform pg_temp.as_user(a);
  begin insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (a, 'https://evil.example/collect', 'k', 'a'); raise exception 'FAIL: arbitrary push endpoint';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (a, 'https://fcm.googleapis.com/fcm/send/abc', 'k', 'a');

  -- ---------- abonimet ----------
  perform pg_temp.as_user(a);
  if public.has_plus() then raise exception 'FAIL: free user has plus'; end if;
  select count(*) into n from public.subscriptions; if n <> 0 then raise exception 'FAIL: free user sees subscriptions'; end if;
  begin insert into public.subscriptions (user_id, status) values (a, 'active'); raise exception 'FAIL: user granted self plus';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin ok := public.has_plus_for(p); raise exception 'FAIL: probed other user plus';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(p); if not public.has_plus() then raise exception 'FAIL: subscriber without plus'; end if;
  -- Periudha e faljes pas pagesës së dështuar
  perform pg_temp.as_system(); update public.subscriptions set status = 'past_due', grace_until = now() + interval '7 days' where user_id = p;
  perform pg_temp.as_user(p); if not public.has_plus() then raise exception 'FAIL: grace period'; end if;
  perform pg_temp.as_system(); update public.subscriptions set grace_until = now() - interval '1 minute' where user_id = p;
  perform pg_temp.as_user(p); if public.has_plus() then raise exception 'FAIL: grace not ended'; end if;
  perform pg_temp.as_system(); update public.subscriptions set status = 'active', grace_until = null where user_id = p;
  -- Historiku i kopjeve vetëm për Plus
  perform pg_temp.as_user(p); perform public.save_backup('C1', 's', 'i', 1, 'dev', null); perform public.save_backup('C2', 's', 'i', 1, 'dev', 1);
  select count(*) into n from public.backup_versions; if n <> 1 then raise exception 'FAIL: plus version history %', n; end if;
  perform pg_temp.as_user(a); perform public.save_backup('C1', 's', 'i', 1, 'dev', null); perform public.save_backup('C2', 's', 'i', 1, 'dev', 1);
  select count(*) into n from public.backup_versions; if n <> 0 then raise exception 'FAIL: free user history / cross-user leak'; end if;
  -- Faturimi: roli billing sheh metadata; moderatori jo; përdoruesi jo
  perform pg_temp.as_user(b); select count(*) into n from public.billing_list_subscriptions(); if n <> 1 then raise exception 'FAIL: billing list'; end if;
  select count(*) into n from public.reports; if n <> 0 then raise exception 'FAIL: billing sees reports'; end if;
  begin perform pg_temp.as_user(m); perform * from public.billing_list_subscriptions(); raise exception 'FAIL: moderator sees billing';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform pg_temp.as_user(b); perform * from public.mod_list_reports(); raise exception 'FAIL: billing sees report queue';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- ---------- AI: kuota ----------
  perform pg_temp.as_user(a);
  for n in 1..5 loop left_ := public.ai_consume(); end loop;
  begin left_ := public.ai_consume(); raise exception 'FAIL: free AI quota exceeded';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(p); for n in 1..6 loop left_ := public.ai_consume(); end loop;
  if left_ <> 24 then raise exception 'FAIL: plus quota %', left_; end if;

  -- ---------- analitika ----------
  -- Pa hyrje: funksioni nuk thirret fare (migrimi anon_function_hardening).
  begin perform pg_temp.as_anon(); ok := public.track_event('screen_opened', '{}', '2.1.0', 'mobile'); raise exception 'FAIL: anon tracked event';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  perform pg_temp.as_user(a);
  ok := public.track_event('screen_opened', '{"screen": "dashboard"}', '2.1.0', 'mobile');
  if not ok then raise exception 'FAIL: allowed event rejected'; end if;
  begin ok := public.track_event('screen_opened', '{"screen": "dashboard", "mood": 3}', '2.1.0', 'mobile'); raise exception 'FAIL: metric value accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin ok := public.track_event('screen_opened', '{"note": "sot u ndjeva..."}', '2.1.0', 'mobile'); raise exception 'FAIL: note accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin ok := public.track_event('screen_opened', '{"screen": "Arta Berisha"}', '2.1.0', 'mobile'); raise exception 'FAIL: free text accepted';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  select count(*) into n from public.analytics_events; if n <> 0 then raise exception 'FAIL: user reads analytics'; end if;
  perform pg_temp.as_system(); update public.feature_flags set server_enabled = false where key = 'analytics';
  perform pg_temp.as_user(a); ok := public.track_event('screen_opened', '{}', '2.1.0', 'mobile');
  if ok then raise exception 'FAIL: analytics while disabled'; end if;

  -- ---------- administrimi ----------
  perform pg_temp.as_user(d); select count(*) into n from public.admin_list_staff(); if n < 3 then raise exception 'FAIL: admin staff list'; end if;
  select count(*) into n from public.admin_list_staff() where email_masked like '%***@%'; if n = 0 then raise exception 'FAIL: email not masked'; end if;
  begin perform pg_temp.as_user(m); perform * from public.admin_audit(); raise exception 'FAIL: moderator reads admin audit';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Admini nuk shfleton të dhënat private
  perform pg_temp.as_user(d);
  select count(*) into n from public.encrypted_backups; if n <> 0 then raise exception 'FAIL: admin reads backups'; end if;
  select count(*) into n from public.messages; if n <> 0 then raise exception 'FAIL: admin reads messages'; end if;
  select count(*) into n from public.shared_entries; if n <> 0 then raise exception 'FAIL: admin reads mentor data'; end if;
  select count(*) into n from public.notification_prefs; if n <> 0 then raise exception 'FAIL: admin reads prefs'; end if;
end $$;

select 'PHASE2 PLATFORM: PASS' as result;
rollback;
