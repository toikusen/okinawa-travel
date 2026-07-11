-- Add owner tracking to trips
alter table trips add column if not exists owner_email text;

-- Add display info to trip_members
alter table trip_members add column if not exists display_name text not null default '';
alter table trip_members add column if not exists avatar_url  text not null default '';

-- Allow trip owner to remove other members (not themselves)
create policy "trip_members_remove" on trip_members
  for delete using (
    auth.email() = (select owner_email from trips where id = trip_members.trip_id)
    and trip_members.user_email != auth.email()
  );

-- Enable realtime for member changes
alter publication supabase_realtime add table trip_members;
