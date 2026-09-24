drop function if exists public.get_vapid_public_key();
drop function if exists public.service_store_secret(text, text);
delete from vault.secrets where name in ('cron_secret', 'vapid_public_key', 'vapid_private_key');
