-- Testi i izolimit mes përdoruesve (RLS). Ekzekutohet në një transaksion që kthehet mbrapsht,
-- kështu që nuk lë asnjë gjurmë. Nëse diçka rrjedh, bllokun e ndal një exception.
begin;
insert into auth.users(id, email, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','a@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000b','b@test.invalid','authenticated','authenticated');
set local role authenticated;

do $$
declare n int; c boolean;
begin
  -- Përdoruesi A ruan një kopje.
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
  perform public.save_backup('CIPHER_A','s','i',1,'devA',null);
  insert into public.consent_records(user_id, kind, granted, policy_version)
    values ('00000000-0000-0000-0000-00000000000a','cloud_backup',true,'2026-09');

  -- Revizion i vjetër duhet të japë konflikt, jo mbishkrim.
  select conflict into c from public.save_backup('X','s','i',1,'devA',99);
  if not c then raise exception 'FAIL: stale revision overwrote backup'; end if;

  -- Përdoruesi B nuk sheh, nuk ndryshon dhe nuk fshin asgjë të A-së.
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
  select count(*) into n from public.encrypted_backups;
  if n <> 0 then raise exception 'FAIL: B sees % backups', n; end if;
  select count(*) into n from public.consent_records;
  if n <> 0 then raise exception 'FAIL: B sees % consent rows', n; end if;
  update public.encrypted_backups set ciphertext = 'HACK' where user_id = '00000000-0000-0000-0000-00000000000a';
  delete from public.encrypted_backups where user_id = '00000000-0000-0000-0000-00000000000a';
  begin
    insert into public.encrypted_backups(user_id, ciphertext, salt, iv, device_id)
      values ('00000000-0000-0000-0000-00000000000a','HACK','s','i','devB');
    raise exception 'FAIL: B inserted a row for A';
  exception when insufficient_privilege or unique_violation then null;
  end;
  begin
    insert into public.consent_records(user_id, kind, granted, policy_version)
      values ('00000000-0000-0000-0000-00000000000a','terms',true,'x');
    raise exception 'FAIL: B inserted consent for A';
  exception when insufficient_privilege then null;
  end;

  -- A e ka ende kopjen e paprekur.
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
  select count(*) into n from public.encrypted_backups where ciphertext = 'CIPHER_A';
  if n <> 1 then raise exception 'FAIL: A backup was modified or deleted'; end if;
end $$;

select 'RLS isolation: PASS' as result;
rollback;
