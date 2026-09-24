-- Kthen mbrapsht anon_function_hardening (nuk rekomandohet: rihap funksionet për përdoruesit pa hyrje).
drop policy if exists "published content readable (anon)" on public.content_pages;
drop policy if exists "published content readable" on public.content_pages;
create policy "published content readable" on public.content_pages
  for select to anon, authenticated using (published or public.has_any_role(array['admin', 'owner']::public.app_role[]));

grant execute on function public.has_role(public.app_role) to anon;
grant execute on function public.has_any_role(public.app_role[]) to anon;
grant execute on function public.has_pilot_access() to anon;
grant execute on function public.feature_enabled(text) to anon;
grant execute on function public.track_event(text, jsonb, text, text) to anon;
