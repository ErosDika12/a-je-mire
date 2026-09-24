-- Ngushtim pas këshilluesit të sigurisë: përdoruesi pa hyrje nuk ka pse të thërrasë funksionet e roleve,
-- të flamujve apo të analitikës. Analitika dërgohet vetëm nga llogaritë që e kanë ndezur vetë.

-- Faqet publike: pa hyrje lexohen vetëm të publikuarat, pa thirrur funksionin e roleve.
drop policy if exists "published content readable" on public.content_pages;
create policy "published content readable (anon)" on public.content_pages
  for select to anon using (published);
create policy "published content readable" on public.content_pages
  for select to authenticated using (published or public.has_any_role(array['admin', 'owner']::public.app_role[]));

revoke execute on function public.has_role(public.app_role) from anon, public;
revoke execute on function public.has_any_role(public.app_role[]) from anon, public;
revoke execute on function public.has_pilot_access() from anon, public;
revoke execute on function public.feature_enabled(text) from anon, public;
revoke execute on function public.track_event(text, jsonb, text, text) from anon, public;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_pilot_access() to authenticated;
grant execute on function public.feature_enabled(text) to authenticated;
grant execute on function public.track_event(text, jsonb, text, text) to authenticated;
