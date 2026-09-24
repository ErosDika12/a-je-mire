-- Riparim nga testi: now() është koha e fillimit të transaksionit, prandaj një mesazh i dërguar menjëherë pas
-- "Fshij bisedën" merrte të njëjtën kohë dhe dukej i fshehur. clock_timestamp() jep kohën e vërtetë të çastit.
create or replace function public.messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_rate((select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute'), 20, 'messages_minute');
  perform public.enforce_rate((select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 day'), 500, 'messages_day');
  new.body := btrim(new.body);
  new.created_at := clock_timestamp();
  return new;
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = clock_timestamp()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.hide_conversation(p_conversation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set hidden_before = clock_timestamp(), last_read_at = clock_timestamp()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;
revoke execute on function public.messages_guard() from public, anon, authenticated;
