-- Përfshin edhe 20260924050954. Pas kësaj, rizbato report_content dhe block_user
-- nga 20260924050207_community_moderation.sql (versioni pa mesazhe).
drop function if exists public.conversation_messages(uuid, timestamptz, uuid, integer);
drop function if exists public.my_conversations();
drop function if exists public.hide_conversation(uuid);
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.start_conversation(uuid);
drop table if exists public.messages;
drop function if exists public.messages_after();
drop function if exists public.messages_guard();
drop table if exists public.conversation_members;
drop table if exists public.conversations;
drop function if exists public.is_member(uuid);
drop function if exists public.conversation_other(uuid);
drop function if exists public.my_connections();
drop function if exists public.remove_connection(uuid);
drop function if exists public.respond_connection(uuid, boolean);
drop function if exists public.request_connection(text);
drop function if exists public.are_connected(uuid, uuid);
drop table if exists public.connections;
