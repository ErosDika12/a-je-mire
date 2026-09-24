-- Riparim nga këshilluesi i sigurisë: funksionet ndihmëse ishin të thirrshme si RPC.
-- "blocked_between" dhe "is_sanctioned" tani përgjigjen vetëm për thirrësin (ose për moderatorët),
-- që askush të mos pyesë nëse dy persona të tjerë janë bllokuar apo nëse dikush është pezulluar.
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and auth.uid() in (p_a, p_b) and exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create or replace function public.is_sanctioned(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_user = auth.uid() or public.has_any_role(array['moderator', 'admin', 'owner']::public.app_role[]))
    and exists (
      select 1 from public.sanctions
      where user_id = p_user and kind = p_kind and revoked_at is null and until > now()
    );
$$;

-- Funksionet e trigger-ave nuk kanë pse të thirren nga API.
revoke execute on function public.posts_guard(), public.replies_guard(), public.check_nickname() from public, anon, authenticated;
-- Ndihmësit që i përdorin politikat duhet të mbeten të ekzekutueshëm, por jo për vizitorët pa llogari.
revoke execute on function public.blocked_between(uuid, uuid), public.is_sanctioned(uuid, text) from public, anon;
grant execute on function public.blocked_between(uuid, uuid), public.is_sanctioned(uuid, text) to authenticated;
