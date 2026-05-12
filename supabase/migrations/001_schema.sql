-- =========================
-- Tables
-- =========================

create table if not exists trips (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  start_date date not null,
  end_date   date not null,
  created_at timestamptz default now()
);

create table if not exists trip_members (
  trip_id    uuid references trips(id) on delete cascade not null,
  user_email text not null,
  primary key (trip_id, user_email)
);

create table if not exists days (
  id         uuid default gen_random_uuid() primary key,
  trip_id    uuid references trips(id) on delete cascade not null,
  date       date not null,
  label      text not null default '',
  sort_order int  not null default 0
);

create table if not exists events (
  id         uuid default gen_random_uuid() primary key,
  day_id     uuid references days(id)  on delete cascade not null,
  trip_id    uuid references trips(id) on delete cascade not null,
  type       text not null check (type in ('shared', 'fork')),
  title      text not null default '',
  time_start text not null default '',
  time_end   text not null default '',
  location   text not null default '',
  notes      text not null default '',
  sort_order int  not null default 0,
  fork_items jsonb
);

-- =========================
-- Row Level Security
-- =========================

alter table trips        enable row level security;
alter table trip_members enable row level security;
alter table days         enable row level security;
alter table events       enable row level security;

-- trips: any authenticated user can create; only members can read/update; no delete
create policy "trips_create" on trips
  for insert to authenticated with check (true);

create policy "trips_read" on trips
  for select using (
    auth.email() in (
      select user_email from trip_members where trip_id = trips.id
    )
  );

create policy "trips_update" on trips
  for update using (
    auth.email() in (
      select user_email from trip_members where trip_id = trips.id
    )
  );

-- trip_members: members can read; any authenticated user can insert themselves
create policy "trip_members_read" on trip_members
  for select using (
    auth.email() in (
      select user_email from trip_members m where m.trip_id = trip_members.trip_id
    )
  );

create policy "trip_members_join" on trip_members
  for insert to authenticated with check (auth.email() = user_email);

-- days: trip members have full CRUD
create policy "days_all" on days
  for all using (
    auth.email() in (
      select user_email from trip_members where trip_id = days.trip_id
    )
  )
  with check (
    auth.email() in (
      select user_email from trip_members where trip_id = days.trip_id
    )
  );

-- events: trip members have full CRUD
create policy "events_all" on events
  for all using (
    auth.email() in (
      select user_email from trip_members where trip_id = events.trip_id
    )
  )
  with check (
    auth.email() in (
      select user_email from trip_members where trip_id = events.trip_id
    )
  );

-- =========================
-- Realtime
-- =========================

alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table days;
alter publication supabase_realtime add table events;
