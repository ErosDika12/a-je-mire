-- Riparim nga testi: një "raise exception" kthente mbrapsht edhe regjistrimin e qasjes së refuzuar.
-- Tani qasja pas skadimit/revokimit kthen {"error":"grant_inactive"} dhe regjistrimi mbetet në histori.
create or replace function public.mentor_view_grant(p_id uuid, p_download boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.sharing_grants%rowtype;
  entries jsonb;
begin
  select * into g from public.sharing_grants where id = p_id and mentor_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0404'; end if;
  if g.revoked_at is not null or g.expires_at <= now() then
    insert into public.sharing_access_log (grant_id, actor_id, action) values (g.id, auth.uid(), 'expired_view_denied');
    return jsonb_build_object('error', 'grant_inactive');
  end if;
  insert into public.sharing_access_log (grant_id, actor_id, action)
    values (g.id, auth.uid(), case when p_download then 'downloaded' else 'viewed' end);
  select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'date', e.entry_date,
           'values', (select coalesce(jsonb_object_agg(k, e.payload -> k), '{}'::jsonb)
                      from jsonb_object_keys(e.payload) k
                      where (e.kind = 'day' and k = any (g.categories) and k <> 'weekly_summary')
                         or (e.kind = 'week' and k in ('changes', 'days'))))
         order by e.entry_date), '[]'::jsonb)
    into entries
    from public.shared_entries e
    where e.grant_id = g.id and e.entry_date >= g.range_start
      and (e.entry_date <= coalesce(g.range_end, 'infinity'::date) or (g.include_future and e.entry_date >= g.created_at::date));
  return jsonb_build_object('owner_label', g.owner_label, 'categories', g.categories, 'range_start', g.range_start,
    'range_end', g.range_end, 'include_future', g.include_future, 'expires_at', g.expires_at, 'entries', entries);
end $$;
