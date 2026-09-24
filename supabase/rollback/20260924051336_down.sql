-- Përfshin edhe 20260924051500 (vetëm një funksion i zëvendësuar).
drop function if exists public.purge_inactive_shares();
drop function if exists public.mentor_view_grant(uuid, boolean);
drop function if exists public.revoke_sharing_grant(uuid);
drop function if exists public.accept_sharing_grant(text);
drop function if exists public.create_sharing_grant(text, text, text[], date, date, boolean, timestamptz);
drop table if exists public.sharing_access_log;
drop table if exists public.shared_entries;
drop function if exists public.shared_entries_guard();
drop table if exists public.sharing_grants;
drop function if exists public.challenge_board(uuid);
drop table if exists public.challenge_participants;
drop table if exists public.challenges;
drop function if exists public.participants_guard();
drop function if exists public.challenges_after();
drop function if exists public.challenges_guard();
drop function if exists public.is_challenge_participant(uuid);
