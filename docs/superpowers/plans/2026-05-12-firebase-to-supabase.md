# Firebase → Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Auth + Firestore with Supabase Auth + PostgreSQL + Realtime, adding localStorage-based offline cache for read-only offline access when the network is unavailable.

**Architecture:** `src/supabase.ts` replaces `src/firebase.ts`. A new CRUD layer `src/lib/db.ts` replaces `src/lib/firestore.ts` — all function signatures stay the same so components need only import path changes. The three real-time hooks (useAuth, useTrip, useEvents) are rewritten for Supabase. Offline reads are served from `localStorage` cache populated during successful fetches. Supabase uses Google OAuth via redirect (not popup).

**Tech Stack:** @supabase/supabase-js, Supabase Auth (Google OAuth), Supabase PostgreSQL + Realtime, localStorage for offline cache

---

## Prerequisites (manual — do before Task 1)

1. In **Supabase Dashboard → Authentication → Providers**, enable **Google**. Copy the OAuth callback URL shown there.
2. In **Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs**, add that callback URL to "Authorized redirect URIs".
3. Copy **Project URL** and **anon public key** from Supabase Dashboard → Project Settings → API.

---

## File Map

| Action | File | Reason |
|--------|------|--------|
| Delete | `src/firebase.ts` | Replaced by `src/supabase.ts` |
| Delete | `src/lib/firestore.ts` | Replaced by `src/lib/db.ts` |
| Delete | `src/__tests__/lib/firestore.test.ts` | Replaced by `src/__tests__/lib/db.test.ts` |
| Delete | `firestore.rules` | Replaced by Supabase RLS in SQL |
| Create | `supabase/migrations/001_schema.sql` | Schema + RLS (run in Supabase dashboard) |
| Create | `src/supabase.ts` | Supabase client singleton |
| Create | `src/lib/db.ts` | All CRUD + subscription functions |
| Create | `src/__tests__/lib/db.test.ts` | Tests for db.ts |
| Rewrite | `src/hooks/useAuth.ts` | Supabase auth (redirect OAuth) |
| Rewrite | `src/__tests__/hooks/useAuth.test.ts` | Updated mocks for Supabase |
| Rewrite | `src/hooks/useTrip.ts` | Supabase fetch + realtime + localStorage |
| Rewrite | `src/hooks/useEvents.ts` | Supabase fetch + realtime + localStorage |
| Modify | `src/components/EventSheet.tsx` | Import path: firestore → db |
| Modify | `src/components/DaySection.tsx` | Import path: firestore → db |
| Modify | `src/pages/JoinPage.tsx` | Import path: firestore → db |
| Modify | `src/pages/SettingsPage.tsx` | Import path + user metadata fields |
| Modify | `src/pages/TimelinePage.tsx` | Import path + user metadata fields |
| Modify | `src/__tests__/components/EventSheet.test.tsx` | Mock path: firestore → db |
| Modify | `.env.local.example` | Supabase env vars |
| Modify | `package.json` | Remove firebase, add @supabase/supabase-js |

**Unchanged:** `src/types.ts`, `src/App.tsx`, `src/main.tsx`, `src/components/EventCard.tsx`, `src/components/ForkCard.tsx`, `src/hooks/useSyncStatus.ts`, `src/hooks/useInstallPrompt.ts`, `vite.config.ts`

---

### Task 1: Database Schema + RLS

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Create migration file**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/001_schema.sql`:

```sql
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
```

- [ ] **Step 2: Run SQL in Supabase dashboard**

Go to **Supabase Dashboard → SQL Editor → New query**.
Paste the entire file content and click **Run**.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify**

In **Table Editor**: confirm tables `trips`, `trip_members`, `days`, `events` exist.
In **Database → Replication**: confirm `trips`, `days`, `events` are in the `supabase_realtime` publication.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add Supabase schema, RLS policies, and realtime config"
```

---

### Task 2: Swap Packages + Supabase Client

**Files:**
- Modify: `package.json`
- Create: `src/supabase.ts`
- Modify: `.env.local.example`
- Modify: `.env.local`
- Delete: `src/firebase.ts`
- Delete: `firestore.rules`

- [ ] **Step 1: Swap npm packages**

```bash
npm uninstall firebase
npm install @supabase/supabase-js
```

- [ ] **Step 2: Replace .env.local.example**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Update .env.local with real values**

From **Supabase Dashboard → Project Settings → API**:
- "Project URL" → `VITE_SUPABASE_URL`
- "anon public" key → `VITE_SUPABASE_ANON_KEY`

Edit `.env.local` — replace the two values.

- [ ] **Step 4: Create src/supabase.ts**

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 5: Delete Firebase files**

```bash
rm src/firebase.ts firestore.rules
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace Firebase with Supabase client and env config"
```

Note: `npm run build` will fail here due to broken imports — this is expected and fixed in Tasks 3–5.

---

### Task 3: Supabase CRUD Layer + Tests

**Files:**
- Delete: `src/lib/firestore.ts`
- Delete: `src/__tests__/lib/firestore.test.ts`
- Create: `src/lib/db.ts`
- Create: `src/__tests__/lib/db.test.ts`
- Modify: `src/components/EventSheet.tsx` (import path)
- Modify: `src/components/DaySection.tsx` (import path)
- Modify: `src/pages/JoinPage.tsx` (import path)
- Modify: `src/pages/TimelinePage.tsx` (import path)
- Modify: `src/pages/SettingsPage.tsx` (import path)
- Modify: `src/__tests__/components/EventSheet.test.tsx` (mock path)

- [ ] **Step 1: Delete old Firestore files**

```bash
rm src/lib/firestore.ts src/__tests__/lib/firestore.test.ts
```

- [ ] **Step 2: Write failing tests**

Create `src/__tests__/lib/db.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUnsubscribe = vi.fn()

// Build a reusable chainable Supabase query mock
const makeInsertChain = (returnId: string) => ({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: returnId }, error: null }),
    }),
    then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve({ error: null }))
    ),
  }),
})

const makeUpdateChain = () => ({
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
})

const makeDeleteChain = () => ({
  delete: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
})

const makeSelectChain = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      single: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
    }),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }),
})

const mockFrom = vi.fn()
const mockChannel = vi.fn(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
}))

vi.mock('../../supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
  },
}))

import {
  createTrip,
  joinTrip,
  createEvent,
  reorderEvents,
} from '../../lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTrip', () => {
  it('inserts into trips, trip_members, and days; returns trip id', async () => {
    const dayInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'trip-id' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'trip_members') return { insert: memberInsert }
      if (table === 'days') return { insert: dayInsert }
      return {}
    })

    const id = await createTrip('沖繩 2025', 'sei@test.com', '2025-06-11', '2025-06-12')

    expect(id).toBe('trip-id')
    expect(memberInsert).toHaveBeenCalledWith({ trip_id: 'trip-id', user_email: 'sei@test.com' })

    // 2 days: June 11 and June 12
    const [daysArg] = dayInsert.mock.calls[0] as [Array<{ date: string }>]
    expect(daysArg.length).toBe(2)
    expect(daysArg[0].date).toBe('2025-06-11')
    expect(daysArg[1].date).toBe('2025-06-12')
  })
})

describe('joinTrip', () => {
  it('returns false when insert fails (trip not found / RLS blocks)', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'violates row-level security' } }),
    })
    const result = await joinTrip('bad-trip-id', 'user@test.com')
    expect(result).toBe(false)
  })

  it('returns true on successful insert', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
    const result = await joinTrip('trip-id', 'user@test.com')
    expect(result).toBe(true)
  })
})

describe('createEvent', () => {
  it('calls from("events").insert() with trip_id and day_id, returns new id', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'event-id' }, error: null }),
        }),
      }),
    })

    const id = await createEvent('trip-id', 'day-id', {
      type: 'shared',
      title: '美麗海水族館',
      time_start: '12:00',
      time_end: '15:00',
      location: '本部町',
      notes: '',
      sort_order: 0,
    })

    expect(mockFrom).toHaveBeenCalledWith('events')
    expect(id).toBe('event-id')
  })
})

describe('reorderEvents', () => {
  it('calls update for each id with correct sort_order index', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await reorderEvents('trip-id', 'day-id', ['e1', 'e2', 'e3'])

    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 0 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 2 })
    expect(mockEq).toHaveBeenCalledWith('id', 'e1')
    expect(mockEq).toHaveBeenCalledWith('id', 'e2')
    expect(mockEq).toHaveBeenCalledWith('id', 'e3')
  })
})
```

- [ ] **Step 3: Run — verify fail**

```bash
npm test src/__tests__/lib/db.test.ts
```

Expected: `Cannot find module '../../lib/db'`

- [ ] **Step 4: Create src/lib/db.ts**

```ts
import { supabase } from '../supabase'
import type { Trip, Day, TripEvent } from '../types'

// --- Trip ---

export function subscribeToTrip(
  tripId: string,
  onTrip: (trip: Trip | null) => void
): () => void {
  const fetch = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_members(user_email)')
      .eq('id', tripId)
      .single()
    if (error || !data) { onTrip(null); return }
    onTrip({
      id: data.id,
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      members: (data.trip_members as { user_email: string }[]).map(m => m.user_email),
    })
  }
  fetch()

  const channel = supabase
    .channel(`trip-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, fetch)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function createTrip(
  name: string,
  ownerEmail: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const { data, error } = await supabase
    .from('trips')
    .insert({ name, start_date: startDate, end_date: endDate })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'createTrip failed')

  await supabase.from('trip_members').insert({ trip_id: data.id, user_email: ownerEmail })

  const days: { trip_id: string; date: string; label: string; sort_order: number }[] = []
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const current = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  let sortOrder = 0
  while (current <= end) {
    const y = current.getFullYear()
    const mo = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    days.push({ trip_id: data.id, date: `${y}-${mo}-${d}`, label: '', sort_order: sortOrder++ })
    current.setDate(current.getDate() + 1)
  }
  await supabase.from('days').insert(days)

  return data.id
}

export async function joinTrip(tripId: string, email: string): Promise<boolean> {
  const { error } = await supabase
    .from('trip_members')
    .insert({ trip_id: tripId, user_email: email })
  return !error
}

export async function updateTripName(tripId: string, name: string): Promise<void> {
  await supabase.from('trips').update({ name }).eq('id', tripId)
}

// --- Days ---

export function subscribeToDays(
  tripId: string,
  onDays: (days: Day[]) => void
): () => void {
  const fetch = async () => {
    const { data } = await supabase
      .from('days')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order')
    onDays((data ?? []) as Day[])
  }
  fetch()

  const channel = supabase
    .channel(`days-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'days', filter: `trip_id=eq.${tripId}` }, fetch)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function updateDayLabel(
  tripId: string,
  dayId: string,
  label: string
): Promise<void> {
  await supabase.from('days').update({ label }).eq('id', dayId)
}

// --- Events ---

export function subscribeToEvents(
  tripId: string,
  dayId: string,
  onEvents: (events: TripEvent[]) => void
): () => void {
  const fetch = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('day_id', dayId)
      .order('sort_order')
    onEvents((data ?? []) as TripEvent[])
  }
  fetch()

  const channel = supabase
    .channel(`events-${dayId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `day_id=eq.${dayId}` }, fetch)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function createEvent(
  tripId: string,
  dayId: string,
  event: Omit<TripEvent, 'id'>
): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...event, trip_id: tripId, day_id: dayId })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'createEvent failed')
  return data.id
}

export async function updateEvent(
  _tripId: string,
  _dayId: string,
  eventId: string,
  data: Partial<Omit<TripEvent, 'id'>>
): Promise<void> {
  await supabase.from('events').update(data).eq('id', eventId)
}

export async function deleteEvent(
  _tripId: string,
  _dayId: string,
  eventId: string
): Promise<void> {
  await supabase.from('events').delete().eq('id', eventId)
}

export async function reorderEvents(
  _tripId: string,
  _dayId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('events').update({ sort_order: i }).eq('id', id)
    )
  )
}
```

- [ ] **Step 5: Run — verify db tests pass**

```bash
npm test src/__tests__/lib/db.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Update import paths — 6 files**

In each file below, change `from '../lib/firestore'` → `from '../lib/db'` (or `../../lib/db` for test files):

**src/components/EventSheet.tsx** — line 3:
```ts
import { createEvent, updateEvent, deleteEvent } from '../lib/db'
```

**src/components/DaySection.tsx** — line with firestore import:
```ts
import { reorderEvents, updateDayLabel } from '../lib/db'
```

**src/pages/JoinPage.tsx**:
```ts
import { joinTrip } from '../lib/db'
```

**src/pages/TimelinePage.tsx**:
```ts
import { createTrip } from '../lib/db'
```

**src/pages/SettingsPage.tsx**:
```ts
import { updateTripName } from '../lib/db'
```

**src/__tests__/components/EventSheet.test.tsx** — mock path:
```ts
vi.mock('../../lib/db', () => ({
  createEvent: vi.fn().mockResolvedValue('new-id'),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}))
```

Also update the mock module path in the same file from `'../../lib/firestore'` to `'../../lib/db'`.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All 5 test files pass (db.test.ts + 4 component/hook tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase CRUD layer (db.ts) and update all import paths"
```

---

### Task 4: Rewrite useAuth + Update User Metadata in Pages

**Files:**
- Rewrite: `src/hooks/useAuth.ts`
- Rewrite: `src/__tests__/hooks/useAuth.test.ts`
- Modify: `src/pages/TimelinePage.tsx` (lines 86–88)
- Modify: `src/pages/SettingsPage.tsx` (lines 73–76)

- [ ] **Step 1: Write failing test**

Replace entire `src/__tests__/hooks/useAuth.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  },
}))

import { useAuth } from '../../hooks/useAuth'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })
})

describe('useAuth', () => {
  it('resolves loading and sets user to null when unauthenticated', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('calls signInWithOAuth with google provider on signIn()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    await act(() => result.current.signIn())
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('calls supabase signOut on signOut()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes auth listener on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test src/__tests__/hooks/useAuth.test.ts
```

Expected: errors because useAuth still imports from `../firebase`.

- [ ] **Step 3: Rewrite src/hooks/useAuth.ts**

```ts
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  const signOut = () => supabase.auth.signOut()

  return { user, loading, signIn, signOut }
}
```

- [ ] **Step 4: Run — verify useAuth tests pass**

```bash
npm test src/__tests__/hooks/useAuth.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Update TimelinePage.tsx — user metadata**

In `src/pages/TimelinePage.tsx`, replace lines 86–88:

Old:
```tsx
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          )}
```

New:
```tsx
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          )}
```

- [ ] **Step 6: Update SettingsPage.tsx — user metadata**

In `src/pages/SettingsPage.tsx`, replace lines 73–76:

Old:
```tsx
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-sm text-[#1a2530]">{user?.displayName}</p>
```

New:
```tsx
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url as string} alt="" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-sm text-[#1a2530]">{user?.user_metadata?.full_name as string}</p>
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All test files pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAuth.ts src/__tests__/hooks/useAuth.test.ts \
  src/pages/TimelinePage.tsx src/pages/SettingsPage.tsx
git commit -m "feat: rewrite useAuth for Supabase OAuth + fix user metadata in pages"
```

---

### Task 5: Rewrite useTrip + useEvents (with localStorage offline cache)

**Files:**
- Rewrite: `src/hooks/useTrip.ts`
- Rewrite: `src/hooks/useEvents.ts`

- [ ] **Step 1: Rewrite src/hooks/useTrip.ts**

```ts
import { useState, useEffect } from 'react'
import { subscribeToTrip, subscribeToDays } from '../lib/db'
import type { Trip, Day } from '../types'

const TRIP_CACHE  = (id: string) => `sb_trip_${id}`
const DAYS_CACHE  = (id: string) => `sb_days_${id}`

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function useTrip(tripId: string | null) {
  const [trip, setTrip]     = useState<Trip | null>(() => tripId ? readCache<Trip>(TRIP_CACHE(tripId)) : null)
  const [days, setDays]     = useState<Day[]>(() => tripId ? (readCache<Day[]>(DAYS_CACHE(tripId)) ?? []) : [])
  const [loading, setLoading] = useState<boolean>(() => !tripId ? false : !readCache(TRIP_CACHE(tripId ?? '')))

  useEffect(() => {
    if (!tripId) { setLoading(false); return }

    const tripUnsub = subscribeToTrip(tripId, (t) => {
      setTrip(t)
      setLoading(false)
      if (t) localStorage.setItem(TRIP_CACHE(tripId), JSON.stringify(t))
    })

    const daysUnsub = subscribeToDays(tripId, (d) => {
      setDays(d)
      localStorage.setItem(DAYS_CACHE(tripId), JSON.stringify(d))
    })

    return () => { tripUnsub(); daysUnsub() }
  }, [tripId])

  return { trip, days, loading }
}
```

- [ ] **Step 2: Rewrite src/hooks/useEvents.ts**

```ts
import { useState, useEffect } from 'react'
import { subscribeToEvents } from '../lib/db'
import type { TripEvent } from '../types'

const EVENTS_CACHE = (tripId: string, dayId: string) => `sb_events_${tripId}_${dayId}`

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function useEvents(tripId: string | null, dayId: string) {
  const [events, setEvents] = useState<TripEvent[]>(
    () => tripId ? (readCache<TripEvent[]>(EVENTS_CACHE(tripId, dayId)) ?? []) : []
  )

  useEffect(() => {
    if (!tripId) return
    return subscribeToEvents(tripId, dayId, (e) => {
      setEvents(e)
      localStorage.setItem(EVENTS_CACHE(tripId, dayId), JSON.stringify(e))
    })
  }, [tripId, dayId])

  return events
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All test files pass.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors. `dist/sw.js` and `dist/manifest.webmanifest` generated.

- [ ] **Step 5: Verify no Firebase imports remain**

```bash
grep -r "firebase" src/ --include="*.ts" --include="*.tsx"
```

Expected: No output.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTrip.ts src/hooks/useEvents.ts
git commit -m "feat: rewrite useTrip and useEvents for Supabase with localStorage offline cache"
```

---

### Task 6: Final Smoke Test + Push

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 5 test files, all passing.

- [ ] **Step 2: Local smoke test**

```bash
npm run dev
```

Open `http://localhost:5173`:

1. Click "Google 帳號登入" — browser redirects to Google, then back to app
2. Create a trip with start/end dates
3. Add a shared event → verify it appears in timeline
4. Add a fork event → verify 2-column card appears
5. Edit an event → verify form pre-fills and saves
6. Go to Settings → copy invite link → open in another browser tab → sign in as a different Google account → verify they join the same trip

**Offline test:**
7. Open DevTools → Network tab → set to Offline
8. Reload the page
9. Verify cached trip data still displays (from localStorage)

Stop dev server.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin master
```

---

## Self-Review: Spec Coverage

| Requirement | Task |
|-------------|------|
| PostgreSQL schema: trips, trip_members, days, events | Task 1 |
| RLS: only trip members can read/write | Task 1 |
| No-delete policy on trips | Task 1 |
| Realtime enabled for trips, days, events | Task 1 |
| Remove firebase package | Task 2 |
| Supabase client singleton | Task 2 |
| VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY env vars | Task 2 |
| All 11 CRUD functions ported (same signatures) | Task 3 |
| Timezone-safe date generation in createTrip | Task 3 |
| Import paths updated in 6 files | Task 3 |
| Google OAuth via Supabase redirect | Task 4 |
| useAuth uses Supabase auth, unsubscribes on unmount | Task 4 |
| user.photoURL → user.user_metadata.avatar_url | Task 4 |
| user.displayName → user.user_metadata.full_name | Task 4 |
| useTrip: Supabase subscriptions + localStorage cache | Task 5 |
| useEvents: Supabase subscriptions + localStorage cache | Task 5 |
| Offline reads served from cache | Task 5 |
| Build succeeds, no Firebase imports | Task 6 |
