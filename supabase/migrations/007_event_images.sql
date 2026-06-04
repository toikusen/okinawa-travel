-- Add image_url and link_url columns to events table
alter table events
  add column if not exists image_url text,
  add column if not exists link_url  text;

-- Storage policies (bucket must be created manually in Dashboard first:
--   Storage > New bucket > name: event-images, Public: ON)
create policy "trip members can upload event images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] in (
      select trip_id::text from trip_members where user_email = auth.email()
    )
  );

create policy "trip members can update event images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] in (
      select trip_id::text from trip_members where user_email = auth.email()
    )
  );
