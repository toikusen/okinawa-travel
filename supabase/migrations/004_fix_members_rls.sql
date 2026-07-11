-- Fix self-referential RLS on trip_members causing each user to only see their own row.
--
-- The original policy checked membership by querying trip_members itself, which PostgreSQL
-- evaluates recursively — resulting in every user seeing only their own row.
--
-- Solution: a security definer function that runs with owner privileges (bypassing RLS),
-- then use it as the sole check in the policy.

create or replace function is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trip_members
    where trip_id = p_trip_id and user_email = auth.email()
  );
$$;

drop policy if exists "trip_members_read" on trip_members;

create policy "trip_members_read" on trip_members
  for select using (is_trip_member(trip_id));
