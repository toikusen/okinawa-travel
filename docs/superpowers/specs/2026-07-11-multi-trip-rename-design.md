# Multi-trip restructure + rename to Tabi — Design

Date: 2026-07-11
Status: Approved (user confirmed route/DB/rename scope in conversation)

## Goal

Turn the single-trip PWA (localStorage-pinned trip) into a multi-trip app:
logged-in users see a trip list, can create / edit / join / leave / delete
trips, and manage members. Rename the app from 沖繩旅遊 / `vite-okinawa` to
**Tabi** (`tabi`).

Reference architecture: `~/share-money` (list → detail routing, membership
join table, SECURITY DEFINER RPCs). We adopt its structure, NOT its stack —
this project stays Vite + React Router SPA + Supabase.

## Current state (verified 2026-07-11)

- DB already many-to-many: `trips`, `trip_members` (composite PK), RLS via
  `is_trip_member()`, `join_trip_rpc(p_trip_id)` upserts membership.
- Frontend is the gap: `TimelinePage`/`SettingsPage`/`JoinPage` all read the
  single localStorage key `okinawa_trip_id`; joining a second trip clobbers
  the first. No trip list.
- Auth: Supabase Google OAuth only, via `useAuth.ts`. Unchanged by this work.

## Routes (after)

| Route | Page | Notes |
|---|---|---|
| `/login` | LoginPage | catch-all when logged out (unchanged) |
| `/join/:tripId` | JoinPage | works logged-out → login → join; success redirects to `/trips/:tripId` |
| `/` | **TripListPage (new)** | cards of user's trips + "新增旅程" button |
| `/trips/new` | **NewTripPage (new)** | create form, extracted from TimelinePage's inline form |
| `/trips/:tripId` | TimelinePage | reads trip id from route param; localStorage key removed |
| `/trips/:tripId/settings` | SettingsPage | per-trip: edit name/dates, member list, remove member (owner), leave trip, delete trip (owner) |

Logged-in catch-all redirects to `/`. `okinawa_trip_id` localStorage usage is
deleted everywhere (no migration shim — users just land on the list).

## Data layer

New migration `supabase/migrations/008_trip_management.sql`:

- `trip_members` self-delete policy: a user may delete their own row
  (leave trip), EXCEPT the trip owner (`user_email <> trips.owner_email`) —
  otherwise a trip could end up with no one able to manage it. Owner's only
  exit is deleting the trip (ownership transfer is YAGNI).
  Owner-removes-member policy already exists (003).
- `delete_trip_rpc(p_trip_id)`: SECURITY DEFINER, asserts caller is
  `trips.owner_email`, deletes the `trips` row only — `trip_members`,
  `days`, `events` all have `ON DELETE CASCADE` (001_schema.sql:14,21,29).
- Storage delete policy on `storage.objects` for `event-images`, scoped to
  trip members (007 has insert/update/select but NO delete policy today).
- Trip edit (name/start_date/end_date) uses the existing member-update
  policy from 001 — no new SQL.

Trip deletion flow: client best-effort removes `event-images/{tripId}/*`
via storage API first, then calls `delete_trip_rpc`. If storage cleanup
fails, accept orphaned images (`ponytail:` comment; periodic cleanup can
come later).

Note: untracked migrations 003–006 are already applied to the live DB but
not in git — commit them together with this work.

`src/lib/db.ts` additions: `listMyTrips()`, `createTrip()` (move/reuse
existing logic), `updateTrip()`, `deleteTrip()` (RPC), `leaveTrip()`,
`removeMember()` (already possible via 003 policy).

## Rename surface

- `package.json` name → `tabi` (lockfile regenerates)
- `index.html` title → `Tabi`
- `vite.config.ts` PWA manifest name/short_name → `Tabi`
- `LoginPage.tsx` heading → `Tabi`
- localStorage key `okinawa_trip_id`: deleted (not renamed)
- Repo directory: renamed as the FINAL step (after all code changes and
  tests pass): `mv ~/okinawa-travel ~/tabi`. The user must reopen the
  Claude Code session in the new path afterwards.
- GitHub repo: `gh repo rename tabi` (old URL redirects automatically).
- Supabase: project display name is changed manually in the dashboard
  (Settings → General). Project ref and API URL do NOT change, so
  `.env.local` stays valid. No code impact.
- NOT touched: `002_import_itinerary.sql` (historical data seed),
  `docs/` planning files

## Tests

- TripListPage: renders trips, empty state, navigates to `/trips/:id`
- db.ts: listMyTrips / deleteTrip / leaveTrip call shapes
- TimelinePage: reads trip from route param (no localStorage)
- JoinPage: redirects to `/trips/:tripId` on success
- Existing 7 test files keep passing; update any `okinawa` fixtures

## Out of scope

- Invite tokens (UUID trip id in join link is unguessable; existing RPC kept)
- Next.js / Server Actions migration
- Cross-trip views (review/notifications à la share-money)
