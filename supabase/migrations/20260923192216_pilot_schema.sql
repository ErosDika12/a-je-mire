-- A JE MIRË? 2036 — skema e pilotit publik.
-- Serveri ruan vetëm tekst të enkriptuar: çelësi krijohet në pajisje dhe nuk dërgohet kurrë.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.encrypted_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ciphertext text not null check (length(ciphertext) <= 5000000),
  salt text not null,
  iv text not null,
  format_version int not null default 1,
  revision bigint not null default 1,
  device_id text not null check (length(device_id) <= 64),
  updated_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('local_storage','cloud_backup','terms','privacy')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists consent_records_user_idx on public.consent_records(user_id);

alter table public.profiles enable row level security;
alter table public.encrypted_backups enable row level security;
alter table public.consent_records enable row level security;

-- Çdo përdorues sheh dhe prek vetëm rreshtat e vet.
create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

create policy "own backup read" on public.encrypted_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "own backup delete" on public.encrypted_backups for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own consent read" on public.consent_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "own consent insert" on public.consent_records for insert to authenticated with check ((select auth.uid()) = user_id);

-- Ruajtja kalon vetëm nga ky funksion, që revizioni të kontrollohet në mënyrë atomike:
-- nëse një pajisje tjetër ka ruajtur ndërkohë, kthehet konflikt në vend që të mbishkruhet.
create or replace function public.save_backup(
  p_ciphertext text, p_salt text, p_iv text, p_format_version int,
  p_device_id text, p_expected_revision bigint
) returns table(revision bigint, updated_at timestamptz, conflict boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_rev bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select b.revision into current_rev from public.encrypted_backups b where b.user_id = uid for update;
  if current_rev is not null and current_rev <> coalesce(p_expected_revision, -1) then
    return query select current_rev, (select b.updated_at from public.encrypted_backups b where b.user_id = uid), true;
    return;
  end if;
  if current_rev is null then
    insert into public.encrypted_backups(user_id, ciphertext, salt, iv, format_version, revision, device_id)
      values (uid, p_ciphertext, p_salt, p_iv, p_format_version, 1, p_device_id);
  else
    update public.encrypted_backups b set ciphertext = p_ciphertext, salt = p_salt, iv = p_iv,
      format_version = p_format_version, revision = current_rev + 1, device_id = p_device_id, updated_at = now()
      where b.user_id = uid;
  end if;
  return query select b.revision, b.updated_at, false from public.encrypted_backups b where b.user_id = uid;
end $$;

-- Funksioni ka nevojë të shkruajë, prandaj i japim politika insert/update vetëm për rreshtin e vet.
create policy "own backup insert" on public.encrypted_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own backup update" on public.encrypted_backups for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on function public.save_backup(text,text,text,int,text,bigint) from public, anon;
grant execute on function public.save_backup(text,text,text,int,text,bigint) to authenticated;
