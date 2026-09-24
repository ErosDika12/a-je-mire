-- Riparim i gjetur nga testi i autorizimit: "Adm1n" kalonte, sepse 1 kthehej në "l".
-- Tani 1, l dhe i bëhen të gjitha "i", dhe fjalët e rezervuara kalojnë nga i njëjti normalizim.
create or replace function public.nickname_key(p_nickname text)
returns text language sql immutable set search_path = '' as $$
  select translate(regexp_replace(lower(translate(p_nickname, 'ÇçËë', 'CcEe')), '[^a-z0-9]', '', 'g'), '01l3457', 'oiieast');
$$;

create or replace function public.check_nickname()
returns trigger language plpgsql set search_path = '' as $$
declare
  normalized text := public.nickname_key(new.nickname);
begin
  -- Fjalët e gjata bllokohen si fillim emri ("admin_arta"), të shkurtrat vetëm si emër i plotë.
  if exists (
    select 1 from unnest(array['admin', 'administrator', 'moderator', 'owner', 'staff', 'support', 'official',
                               'system', 'ajemire', 'kosict', 'mentor', 'helpdesk', 'ndihma', 'stafi']) as word
    where normalized like public.nickname_key(word) || '%'
  ) or normalized in (public.nickname_key('mod'), public.nickname_key('root'), public.nickname_key('ajm')) then
    raise exception 'nickname_reserved' using errcode = 'P0409';
  end if;
  new.updated_at := now();
  return new;
end $$;
