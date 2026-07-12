-- Trip preview for the join flow: invited users are not members yet, so RLS
-- hides the trip. SECURITY DEFINER lets any signed-in link holder see
-- name/dates/member avatars before deciding to join (trip ids are unguessable UUIDs).

create or replace function public.trip_preview_rpc(p_trip_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'name', t.name,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'members', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'display_name', m.display_name,
           'avatar_url', m.avatar_url))
         from trip_members m
         where m.trip_id = t.id),
        '[]'::jsonb)
    )
    from trips t
    where t.id = p_trip_id
  ) end;
$$;
