-- Pastron të dhënat e llogarive të testit (vetëm @ajm-test.invalid) para një ekzekutimi E2E.
-- Nuk prek asnjë përdorues të vërtetë.
with test_users as (select id from auth.users where email like '%@ajm-test.invalid')
, a as (delete from public.reports where reporter_id in (select id from test_users) or target_user_id in (select id from test_users) returning 1)
, b as (delete from public.posts where author_id in (select id from test_users) returning 1)
, c as (delete from public.connections where requester_id in (select id from test_users) or addressee_id in (select id from test_users) returning 1)
, d as (delete from public.conversations where user_low in (select id from test_users) or user_high in (select id from test_users) returning 1)
, e as (delete from public.blocks where blocker_id in (select id from test_users) returning 1)
, f as (delete from public.mutes where muter_id in (select id from test_users) returning 1)
, g as (delete from public.sharing_grants where owner_id in (select id from test_users) returning 1)
, h as (delete from public.challenges where owner_id in (select id from test_users) returning 1)
, i as (delete from public.notification_prefs where user_id in (select id from test_users) returning 1)
, j as (delete from public.notifications where user_id in (select id from test_users) returning 1)
, k as (delete from public.public_profiles where user_id in (select id from test_users) returning 1)
, l as (delete from public.ai_usage where user_id in (select id from test_users) returning 1)
, m as (delete from public.sanctions where user_id in (select id from test_users) returning 1)
, n as (delete from public.push_subscriptions where user_id in (select id from test_users) returning 1)
select (select count(*) from test_users) as test_users;
