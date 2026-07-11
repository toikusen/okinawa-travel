-- 008_trip_management.sql
-- Multi-trip management: leave trip, delete trip, storage image cleanup.

-- Leave trip: a member may delete their own membership row — except the
-- owner, who must delete the trip instead (otherwise the trip becomes
-- unmanageable: owner_email would point at a non-member).
-- owner_email is read via a SECURITY DEFINER helper so the check does not
-- depend on trips_read RLS (which still uses the unreliable auth.email(),
-- see migration 005). IS DISTINCT FROM keeps legacy null-owner rows leavable.
create or replace function public.get_trip_owner_email(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select owner_email from trips where id = p_trip_id
$$;

drop policy if exists "trip_members_leave" on trip_members;

create policy "trip_members_leave" on trip_members
  for delete using (
    user_email = public.get_auth_email()
    and user_email is distinct from public.get_trip_owner_email(trip_id)
  );

-- Owner-only trip deletion. trip_members / days / events all cascade
-- via their FKs (001), so deleting the trips row is sufficient.
create or replace function public.delete_trip_rpc(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from trips
    where id = p_trip_id and owner_email = public.get_auth_email()
  ) then
    return false;
  end if;

  delete from trips where id = p_trip_id;
  return true;
end;
$$;

-- 007 created insert/update/select storage policies but no delete —
-- members could not remove images at all. Needed for trip deletion cleanup.
drop policy if exists "trip members can delete event images" on storage.objects;

create policy "trip members can delete event images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] in (
      select trip_id::text from trip_members
      where user_email = public.get_auth_email()
    )
  );

-- Backfill: trips created before 003 have null owner_email (the 002 seed
-- trip). Assign a deterministic owner so delete/leave semantics apply.
update trips t
set owner_email = (
  select user_email from trip_members m
  where m.trip_id = t.id
  order by m.user_email
  limit 1
)
where t.owner_email is null;

-- Any member could rewrite owner_email via the permissive trips_update
-- policy (001), subverting the owner-only delete/leave semantics above.
-- Column-level grants keep member edits to name/dates only.
revoke update on table trips from anon, authenticated;
grant update (name, start_date, end_date) on table trips to authenticated;

-- RLS policies call this as definer; clients never need it directly, and
-- anon holding a trip UUID could resolve the owner's email.
revoke execute on function public.get_trip_owner_email(uuid) from public, anon;
grant execute on function public.get_trip_owner_email(uuid) to authenticated;
