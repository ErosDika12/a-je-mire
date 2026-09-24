-- Sekretet e serverit krijohen brenda serverit: askush (as ky repo, as zhvilluesi) nuk i sheh.
-- Sekreti i cron-it gjenerohet këtu; çelësat VAPID i gjeneron funksioni notify-dispatch në nisjen e parë.

-- Shkrimi i një sekreti nga funksionet e serverit (vetëm service_role), pa mbishkruar ekzistuesin.
create or replace function public.service_store_secret(p_name text, p_value text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('vapid_public_key', 'vapid_private_key') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from vault.secrets where name = p_name) then return false; end if;
  perform vault.create_secret(p_value, p_name, 'Generated server-side');
  return true;
end $$;
revoke all on function public.service_store_secret(text, text) from public, anon, authenticated;
grant execute on function public.service_store_secret(text, text) to service_role;

-- Çelësi publik VAPID është publik nga natyra: shfletuesi e përdor për t'u regjistruar te shërbimi i push-it.
create or replace function public.get_vapid_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key' limit 1;
$$;
revoke execute on function public.get_vapid_public_key() from public, anon;
grant execute on function public.get_vapid_public_key() to authenticated;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'pg_cron -> notify-dispatch');
  end if;
end $$;
