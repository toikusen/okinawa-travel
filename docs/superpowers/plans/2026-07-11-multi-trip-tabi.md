# Multi-trip + Rename to Tabi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-trip PWA into a multi-trip app (trip list / create / edit / join / leave / delete / member management) and rename it from 沖繩旅遊 (`vite-okinawa`) to **Tabi** (`tabi`).

**Architecture:** Keep the Vite + React Router SPA + Supabase stack. Adopt share-money's list→detail routing (`/` list, `/trips/new`, `/trips/:tripId`, `/trips/:tripId/settings`). Kill the `okinawa_trip_id` localStorage key — trip identity comes from the route param. One new migration (008) adds leave-trip policy, `delete_trip_rpc`, and a storage delete policy.

**Tech Stack:** React 18, TypeScript, Vite 5, React Router 7, Tailwind 4, Supabase JS v2, Vitest + Testing Library (jsdom).

Spec: `docs/superpowers/specs/2026-07-11-multi-trip-rename-design.md`

## Global Constraints

- App display name: `Tabi`; package name: `tabi`
- All user-facing copy in Traditional Chinese (existing style: 旅程, 旅伴, 主揪)
- Commit style: Gitmoji + Conventional Commits (e.g. `✨ feat(trips): ...`)
- Tests: `npm test` (vitest run). Dev server: `npm run dev` (port 4200). Build: `npm run build`
- Work on a feature branch in a worktree under `okinawa-travel.worktrees/` (created at execution start via superpowers:using-git-worktrees); never commit to master checkout
- RLS policies must use `public.get_auth_email()`, NOT `auth.email()` (unreliable JWT claim — see migration 005)
- Existing untracked migrations `003`–`006` are already applied to the live DB; commit them in Task 1
- Owner cannot leave a trip (only delete it). Non-owner members can leave.
- `trips`/`days`/`events`/`trip_members` FKs already have `ON DELETE CASCADE` (001) — deleting the `trips` row is enough

---

### Task 1: Migration 008 — trip management SQL

**Files:**
- Create: `supabase/migrations/008_trip_management.sql`
- Commit (previously untracked): `supabase/migrations/003_members.sql`, `004_fix_members_rls.sql`, `005_fix_join_rls.sql`, `006_join_trip_rpc.sql`

**Interfaces:**
- Produces: `delete_trip_rpc(p_trip_id uuid) returns boolean` RPC (owner-only); `trip_members_leave` DELETE policy (self, non-owner); storage DELETE policy on `event-images`

- [ ] **Step 1: Write the migration**

```sql
-- 008_trip_management.sql
-- Multi-trip management: leave trip, delete trip, storage image cleanup.

-- Leave trip: a member may delete their own membership row — except the
-- owner, who must delete the trip instead (otherwise the trip becomes
-- unmanageable: owner_email would point at a non-member).
create policy "trip_members_leave" on trip_members
  for delete using (
    user_email = public.get_auth_email()
    and user_email <> (select owner_email from trips where id = trip_members.trip_id)
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
create policy "trip members can delete event images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] in (
      select trip_id::text from trip_members
      where user_email = public.get_auth_email()
    )
  );
```

- [ ] **Step 2: Apply to the live database**

Try `supabase db push` if the CLI is linked. If not linked (likely — 003–006 were applied manually), STOP and ask the user to run the SQL in the Supabase Dashboard SQL editor, then confirm before continuing. Do NOT proceed to Task 4+ (delete/leave features) until applied.

- [ ] **Step 3: Commit (migrations 003–008 together)**

```bash
git add supabase/migrations/003_members.sql supabase/migrations/004_fix_members_rls.sql supabase/migrations/005_fix_join_rls.sql supabase/migrations/006_join_trip_rpc.sql supabase/migrations/008_trip_management.sql
git commit -m "✨ feat(db): trip leave/delete policies + delete_trip_rpc; track applied migrations 003-006"
```

---

### Task 2: db.ts — fix stale joinTrip tests, extend supabase mock

The `joinTrip` tests in `src/__tests__/lib/db.test.ts` still mock `from().insert()`, but `joinTrip` (src/lib/db.ts:89) calls `supabase.rpc('join_trip_rpc', ...)`. The mocked supabase object has no `rpc`, so these tests are broken. Fix the mock first — Tasks 3–4 need `rpc` and `storage` in it.

**Files:**
- Modify: `src/__tests__/lib/db.test.ts`

**Interfaces:**
- Produces: hoisted mocks `mockFrom`, `mockChannel`, `mockRpc`, `mockStorageFrom` available to all db tests

- [ ] **Step 1: Extend the hoisted mock block**

Replace the `vi.hoisted` + `vi.mock` block at the top of `src/__tests__/lib/db.test.ts` with:

```ts
const { mockFrom, mockChannel, mockRpc, mockStorageFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockChannel = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  }))
  const mockRpc = vi.fn()
  const mockStorageFrom = vi.fn()
  return { mockFrom, mockChannel, mockRpc, mockStorageFrom }
})

vi.mock('../../supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  },
}))
```

- [ ] **Step 2: Rewrite the joinTrip describe block against the RPC**

```ts
describe('joinTrip', () => {
  it('returns true when join_trip_rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await joinTrip('trip-id', 'user@test.com', 'User', '')
    expect(mockRpc).toHaveBeenCalledWith('join_trip_rpc', { p_trip_id: 'trip-id' })
    expect(result).toBe(true)
  })

  it('returns false when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await joinTrip('bad-trip-id', 'user@test.com', 'User', '')
    expect(result).toBe(false)
  })

  it('returns false when the rpc reports failure (trip not found)', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await joinTrip('missing-trip', 'user@test.com', 'User', '')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 3: Run the db tests**

Run: `npm test -- src/__tests__/lib/db.test.ts`
Expected: PASS (all describes, including previously-broken joinTrip)

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/lib/db.test.ts
git commit -m "✅ test(db): fix stale joinTrip tests to mock join_trip_rpc"
```

---

### Task 3: db.ts — listMyTrips, updateTrip, deleteTrip

**Files:**
- Modify: `src/lib/db.ts` (Trip section, around line 100)
- Test: `src/__tests__/lib/db.test.ts`

**Interfaces:**
- Consumes: `delete_trip_rpc` (Task 1), mock infra (Task 2)
- Produces:
  - `type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'owner_email'>`
  - `listMyTrips(): Promise<TripSummary[]>`
  - `updateTrip(tripId: string, data: Partial<Pick<Trip, 'name' | 'start_date' | 'end_date'>>): Promise<void>` (replaces `updateTripName`)
  - `deleteTrip(tripId: string): Promise<boolean>`

- [ ] **Step 1: Write failing tests** (append to `db.test.ts`; add `listMyTrips`, `deleteTrip`, `updateTrip` to the import from `'../../lib/db'`)

```ts
describe('listMyTrips', () => {
  it('selects trips ordered by start_date desc', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 't1', name: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-05', owner_email: 'sei@test.com' }],
      error: null,
    })
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ order: mockOrder }) })

    const trips = await listMyTrips()

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockOrder).toHaveBeenCalledWith('start_date', { ascending: false })
    expect(trips).toHaveLength(1)
    expect(trips[0].id).toBe('t1')
  })
})

describe('updateTrip', () => {
  it('updates the given fields on the trip row', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await updateTrip('t1', { name: '新名字' })

    expect(mockFrom).toHaveBeenCalledWith('trips')
    expect(mockUpdate).toHaveBeenCalledWith({ name: '新名字' })
    expect(mockEq).toHaveBeenCalledWith('id', 't1')
  })
})

describe('deleteTrip', () => {
  it('removes trip images then calls delete_trip_rpc', async () => {
    const mockList = vi.fn().mockResolvedValue({ data: [{ name: 'a.jpg' }, { name: 'b.png' }], error: null })
    const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null })
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove })
    mockRpc.mockResolvedValue({ data: true, error: null })

    const ok = await deleteTrip('t1')

    expect(mockStorageFrom).toHaveBeenCalledWith('event-images')
    expect(mockList).toHaveBeenCalledWith('t1')
    expect(mockRemove).toHaveBeenCalledWith(['t1/a.jpg', 't1/b.png'])
    expect(mockRpc).toHaveBeenCalledWith('delete_trip_rpc', { p_trip_id: 't1' })
    expect(ok).toBe(true)
  })

  it('still deletes the trip when storage cleanup throws', async () => {
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockRejectedValue(new Error('storage down')),
      remove: vi.fn(),
    })
    mockRpc.mockResolvedValue({ data: true, error: null })

    const ok = await deleteTrip('t1')

    expect(ok).toBe(true)
  })

  it('returns false when rpc denies (not owner)', async () => {
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn(),
    })
    mockRpc.mockResolvedValue({ data: false, error: null })

    const ok = await deleteTrip('t1')

    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/lib/db.test.ts`
Expected: FAIL — `listMyTrips` / `updateTrip` / `deleteTrip` are not exported

- [ ] **Step 3: Implement in `src/lib/db.ts`** (in the `--- Trip ---` section; DELETE the existing `updateTripName` function, lines 100-102)

```ts
export type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'owner_email'>

export async function listMyTrips(): Promise<TripSummary[]> {
  // RLS (trips_read) already restricts rows to trips the caller is a member of
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, owner_email')
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TripSummary[]
}

export async function updateTrip(
  tripId: string,
  data: Partial<Pick<Trip, 'name' | 'start_date' | 'end_date'>>
): Promise<void> {
  await supabase.from('trips').update(data).eq('id', tripId)
}

export async function deleteTrip(tripId: string): Promise<boolean> {
  // ponytail: best-effort image cleanup; if it fails we accept orphaned
  // storage objects rather than blocking deletion (periodic cleanup later)
  try {
    const { data: files } = await supabase.storage.from('event-images').list(tripId)
    if (files?.length) {
      await supabase.storage.from('event-images').remove(files.map(f => `${tripId}/${f.name}`))
    }
  } catch { /* accept orphans */ }

  const { data, error } = await supabase.rpc('delete_trip_rpc', { p_trip_id: tripId })
  return !error && data === true
}
```

Note: removing `updateTripName` breaks `src/pages/SettingsPage.tsx:5` — update that import in the same commit by replacing `updateTripName(tripId, name)` with `updateTrip(tripId, { name })` (SettingsPage is fully rewritten later in Task 6; here just keep it compiling):
in `SettingsPage.tsx` change the import to `import { updateTrip, removeMember } from '../lib/db'` and `handleSaveName` body to `await updateTrip(tripId, { name: nameInput.trim() })`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- src/__tests__/lib/db.test.ts && npx tsc -b`
Expected: PASS, no type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/pages/SettingsPage.tsx src/__tests__/lib/db.test.ts
git commit -m "✨ feat(db): listMyTrips, updateTrip, deleteTrip with storage cleanup"
```

---

### Task 4: db.ts — dateRange helper + updateTripDates

Editing trip dates must keep the `days` table in sync (the timeline renders `days`, not the trip's date columns). Rule: extend = insert missing day rows; shrink = delete out-of-range days ONLY if they have no events, otherwise refuse and report which dates block.

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/__tests__/lib/db.test.ts`

**Interfaces:**
- Consumes: `updateTrip` shape from Task 3 (same file)
- Produces:
  - `dateRange(startDate: string, endDate: string): string[]` — inclusive `YYYY-MM-DD` list
  - `updateTripDates(tripId: string, startDate: string, endDate: string): Promise<{ ok: boolean; blockedDates?: string[] }>`

- [ ] **Step 1: Write failing tests** (append; import `dateRange`, `updateTripDates`)

```ts
describe('dateRange', () => {
  it('returns inclusive date list', () => {
    expect(dateRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ])
  })

  it('returns single date when start equals end', () => {
    expect(dateRange('2026-08-30', '2026-08-30')).toEqual(['2026-08-30'])
  })
})

describe('updateTripDates', () => {
  function setupDaysMock(opts: {
    existingDays: { id: string; date: string }[]
    eventsOnDayIds?: string[]
  }) {
    const daysSelectEq = vi.fn().mockResolvedValue({ data: opts.existingDays, error: null })
    const eventsSelectIn = vi.fn().mockResolvedValue({
      data: (opts.eventsOnDayIds ?? []).map(day_id => ({ day_id })),
      error: null,
    })
    const daysDeleteIn = vi.fn().mockResolvedValue({ error: null })
    const daysInsert = vi.fn().mockResolvedValue({ error: null })
    const daysUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const tripsUpdateEq = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'days') return {
        select: vi.fn().mockReturnValue({ eq: daysSelectEq }),
        delete: vi.fn().mockReturnValue({ in: daysDeleteIn }),
        insert: daysInsert,
        update: vi.fn().mockReturnValue({ eq: daysUpdateEq }),
      }
      if (table === 'events') return {
        select: vi.fn().mockReturnValue({ in: eventsSelectIn }),
      }
      if (table === 'trips') return {
        update: vi.fn().mockReturnValue({ eq: tripsUpdateEq }),
      }
      return {}
    })

    return { daysDeleteIn, daysInsert, tripsUpdateEq }
  }

  it('extends the range by inserting missing days', async () => {
    const { daysInsert, tripsUpdateEq } = setupDaysMock({
      existingDays: [{ id: 'd1', date: '2026-08-01' }],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-02')

    expect(result.ok).toBe(true)
    expect(daysInsert).toHaveBeenCalledWith([
      { trip_id: 't1', date: '2026-08-02', label: '', sort_order: 1 },
    ])
    expect(tripsUpdateEq).toHaveBeenCalledWith('id', 't1')
  })

  it('shrinks the range by deleting empty out-of-range days', async () => {
    const { daysDeleteIn } = setupDaysMock({
      existingDays: [
        { id: 'd1', date: '2026-08-01' },
        { id: 'd2', date: '2026-08-02' },
      ],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result.ok).toBe(true)
    expect(daysDeleteIn).toHaveBeenCalledWith('id', ['d2'])
  })

  it('refuses to shrink when a removed day still has events', async () => {
    const { daysDeleteIn, tripsUpdateEq } = setupDaysMock({
      existingDays: [
        { id: 'd1', date: '2026-08-01' },
        { id: 'd2', date: '2026-08-02' },
      ],
      eventsOnDayIds: ['d2'],
    })

    const result = await updateTripDates('t1', '2026-08-01', '2026-08-01')

    expect(result.ok).toBe(false)
    expect(result.blockedDates).toEqual(['2026-08-02'])
    expect(daysDeleteIn).not.toHaveBeenCalled()
    expect(tripsUpdateEq).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/lib/db.test.ts`
Expected: FAIL — `dateRange` / `updateTripDates` not exported

- [ ] **Step 3: Implement.** Extract `dateRange` and reuse it inside `createTrip` (replace the inline while-loop at src/lib/db.ts:65-77 with `dateRange(startDate, endDate).map(...)`):

```ts
export function dateRange(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const current = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const out: string[] = []
  while (current <= end) {
    const y = current.getFullYear()
    const mo = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    out.push(`${y}-${mo}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return out
}
```

In `createTrip`, replace lines 65-77 with:

```ts
  const days = dateRange(startDate, endDate).map((date, i) => ({
    trip_id: tripId, date, label: '', sort_order: i,
  }))
```

New function:

```ts
export async function updateTripDates(
  tripId: string,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; blockedDates?: string[] }> {
  const { data: existing } = await supabase
    .from('days').select('id, date').eq('trip_id', tripId)
  const days = (existing ?? []) as { id: string; date: string }[]

  const wanted = dateRange(startDate, endDate)
  const wantedSet = new Set(wanted)
  const toRemove = days.filter(d => !wantedSet.has(d.date))

  if (toRemove.length) {
    const { data: evts } = await supabase
      .from('events').select('day_id')
      .in('day_id', toRemove.map(d => d.id))
    if (evts?.length) {
      const blockedIds = new Set((evts as { day_id: string }[]).map(e => e.day_id))
      return {
        ok: false,
        blockedDates: toRemove.filter(d => blockedIds.has(d.id)).map(d => d.date).sort(),
      }
    }
    await supabase.from('days').delete().in('id', toRemove.map(d => d.id))
  }

  const existingSet = new Set(days.map(d => d.date))
  const toAdd = wanted.filter(date => !existingSet.has(date))
  if (toAdd.length) {
    await supabase.from('days').insert(
      toAdd.map(date => ({ trip_id: tripId, date, label: '', sort_order: wanted.indexOf(date) }))
    )
  }

  // Renumber kept days so sort_order follows date order
  const kept = days.filter(d => wantedSet.has(d.date))
  await Promise.all(kept.map(d =>
    supabase.from('days').update({ sort_order: wanted.indexOf(d.date) }).eq('id', d.id)
  ))

  await supabase.from('trips').update({ start_date: startDate, end_date: endDate }).eq('id', tripId)
  return { ok: true }
}
```

- [ ] **Step 4: Run tests (whole db file — createTrip must still pass after the refactor)**

Run: `npm test -- src/__tests__/lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/__tests__/lib/db.test.ts
git commit -m "✨ feat(db): updateTripDates with day sync; extract dateRange helper"
```

---

### Task 5: TripListPage + route restructure in App.tsx

**Files:**
- Create: `src/pages/TripListPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/__tests__/pages/TripListPage.test.tsx` (new directory)

**Interfaces:**
- Consumes: `listMyTrips`, `TripSummary` (Task 3); `useAuth` (existing)
- Produces: `TripListPage` component at `/`; routes `/trips/new`, `/trips/:tripId`, `/trips/:tripId/settings` registered (pages arrive in Tasks 6–7; App.tsx changes land here in one pass to avoid touching it three times)

- [ ] **Step 1: Write failing test** — `src/__tests__/pages/TripListPage.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockListMyTrips = vi.fn()
vi.mock('../../lib/db', () => ({
  listMyTrips: () => mockListMyTrips(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} } }),
}))

vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TripListPage } from '../../pages/TripListPage'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <TripListPage />
    </MemoryRouter>
  )
}

describe('TripListPage', () => {
  it('renders trips and navigates to the trip on tap', async () => {
    mockListMyTrips.mockResolvedValue([
      { id: 't1', name: '沖繩 2026', start_date: '2026-08-01', end_date: '2026-08-05', owner_email: 'sei@test.com' },
      { id: 't2', name: '東京跨年', start_date: '2026-12-30', end_date: '2027-01-02', owner_email: 'other@test.com' },
    ])

    renderPage()

    expect(await screen.findByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByText('東京跨年')).toBeInTheDocument()

    fireEvent.click(screen.getByText('沖繩 2026'))
    expect(mockNavigate).toHaveBeenCalledWith('/trips/t1')
  })

  it('shows empty state when there are no trips', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('還沒有旅程,建立第一個吧!')).toBeInTheDocument()
  })

  it('navigates to /trips/new from the create button', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()
    fireEvent.click(await screen.findByText('+ 新增旅程'))

    expect(mockNavigate).toHaveBeenCalledWith('/trips/new')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/pages/TripListPage.test.tsx`
Expected: FAIL — cannot resolve `../../pages/TripListPage`

- [ ] **Step 3: Implement `src/pages/TripListPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listMyTrips, type TripSummary } from '../lib/db'
import { InstallPrompt } from '../components/InstallPrompt'

export function TripListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripSummary[] | null>(null)

  useEffect(() => {
    listMyTrips().then(setTrips).catch(() => setTrips([]))
  }, [])

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-[#1a2530]">我的旅程</h1>
        {user?.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
        )}
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {trips === null && <p className="text-sm text-[#8fa0b0] text-center py-8">載入中...</p>}

        {trips?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12">
            <div className="text-4xl">🌺</div>
            <p className="text-sm text-[#8fa0b0]">還沒有旅程,建立第一個吧!</p>
          </div>
        )}

        {trips?.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trips/${trip.id}`)}
            className="bg-white rounded-[12px] p-4 border border-[#e8edf2] text-left active:opacity-70"
          >
            <p className="text-sm font-bold text-[#1a2530]">{trip.name}</p>
            <p className="text-xs text-[#8fa0b0] mt-1">{trip.start_date} ~ {trip.end_date}</p>
          </button>
        ))}

        {trips !== null && (
          <button
            onClick={() => navigate('/trips/new')}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold active:opacity-80"
          >
            + 新增旅程
          </button>
        )}
      </main>

      <InstallPrompt />
    </div>
  )
}
```

Note: no settings gear in this header — Settings is per-trip (`/trips/:tripId/settings`); sign-out lives there. Header right side is avatar only.

- [ ] **Step 4: Update `src/App.tsx` logged-in routes** (imports for `NewTripPage` land in Task 6 — to keep App compiling NOW, register only `/` and keep old routes for pages that still exist; the full final block below is applied incrementally, finishing in Task 7):

Final target state of the logged-in `<Routes>` (reached by end of Task 7):

```tsx
<Routes>
  <Route path="/" element={<TripListPage />} />
  <Route path="/trips/new" element={<NewTripPage />} />
  <Route path="/trips/:tripId" element={<TimelinePage />} />
  <Route path="/trips/:tripId/settings" element={<SettingsPage />} />
  <Route path="/join/:tripId" element={<JoinPage />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

In THIS task, change only: `/` renders `TripListPage` (import it), and add `<Route path="/trips/:tripId" element={<TimelinePage />} />` (TimelinePage still reads localStorage until Task 6 — the route just exists). Keep `/settings` temporarily.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- src/__tests__/pages/TripListPage.test.tsx && npx tsc -b`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/TripListPage.tsx src/App.tsx src/__tests__/pages/TripListPage.test.tsx
git commit -m "✨ feat(trips): trip list page at / with create entry"
```

---

### Task 6: NewTripPage + param-based TimelinePage

**Files:**
- Create: `src/pages/NewTripPage.tsx`
- Modify: `src/pages/TimelinePage.tsx`, `src/App.tsx`
- Test: `src/__tests__/pages/TimelinePage.test.tsx` (new)

**Interfaces:**
- Consumes: `createTrip` (existing), `useTrip(tripId)` (existing), routes from Task 5
- Produces: `NewTripPage` at `/trips/new`; `TimelinePage` driven by `useParams().tripId`

- [ ] **Step 1: Write failing test** — `src/__tests__/pages/TimelinePage.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: (id: string | null) => mockUseTrip(id) }))
vi.mock('../../hooks/useSyncStatus', () => ({ useSyncStatus: () => 'synced' }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} } }),
}))
vi.mock('../../components/DaySection', () => ({ DaySection: () => <div data-testid="day-section" /> }))
vi.mock('../../components/SyncIndicator', () => ({ SyncIndicator: () => null }))
vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TimelinePage } from '../../pages/TimelinePage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trips/:tripId" element={<TimelinePage />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TimelinePage', () => {
  it('feeds the route param tripId into useTrip and renders the trip', () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩 2026', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      loading: false,
    })

    renderAt('/trips/t1')

    expect(mockUseTrip).toHaveBeenCalledWith('t1')
    expect(screen.getByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByTestId('day-section')).toBeInTheDocument()
  })

  it('redirects to / when the trip fails to load (not a member)', () => {
    mockUseTrip.mockReturnValue({ trip: null, days: [], loading: false })

    renderAt('/trips/unknown')

    expect(screen.getByTestId('trip-list')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/pages/TimelinePage.test.tsx`
Expected: FAIL — TimelinePage ignores the route param (useTrip called with localStorage value `null`) and shows the create form instead of redirecting

- [ ] **Step 3: Rewrite `src/pages/TimelinePage.tsx`**

Changes relative to current file:
- Delete `const TRIP_ID_KEY = 'okinawa_trip_id'` and the `useState`/localStorage trip id (lines 11, 16)
- `const { tripId } = useParams<{ tripId: string }>()` (import `useParams`, `Navigate` from react-router-dom)
- Delete the whole create-form branch and its state (`tripName`, `startDate`, `endDate`, `creating`, `handleCreateTrip`, lines 75-135) — creation moves to NewTripPage
- Not-found branch: `if (!trip) return <Navigate to="/" replace />` (after loading check)
- Header: add a back button `←` navigating to `/` before the title
- Bottom nav 設定 button: `navigate(\`/trips/${tripId}/settings\`)`
- Keep the today-autoscroll effect and everything else as-is

Resulting file:

```tsx
import { useEffect } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { SyncIndicator } from '../components/SyncIndicator'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()

  useEffect(() => {
    if (!days.length) return

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const tryScroll = () => {
      const todayEvents = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-date="${todayStr}"]`)
      ).sort((a, b) => toMinutes(a.dataset.timeStart ?? '') - toMinutes(b.dataset.timeStart ?? ''))

      if (!todayEvents.length) {
        if (attempts < 10) {
          attempts++
          timer = setTimeout(tryScroll, 300)
        }
        return
      }

      let target: HTMLElement | null = null
      let lastPast: HTMLElement | null = null

      for (const el of todayEvents) {
        const minutes = toMinutes(el.dataset.timeStart ?? '')
        if (minutes <= currentMinutes) {
          lastPast = el
        } else {
          target = el
          break
        }
      }

      // 優先顯示目前正在進行的行程；若還沒開始，顯示下一個
      const scrollTarget = lastPast ?? target ?? todayEvents[0]
      if (scrollTarget) {
        const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 56
        scrollTarget.style.scrollMarginTop = `${headerHeight + 8}px`
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    timer = setTimeout(tryScroll, 300)

    return () => clearTimeout(timer)
  }, [days.length])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <p className="text-sm text-[#8fa0b0]">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate('/')} className="text-[#0077b6] text-sm shrink-0" aria-label="回旅程列表">←</button>
          <h1 className="text-base font-bold text-[#1a2530] truncate">{trip.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator status={syncStatus} />
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection key={day.id} day={day} tripId={trip.id} members={trip.members} />
          ))}
        </div>
      </main>

      <nav className="bg-white border-t border-[#e8edf2] flex sticky bottom-0">
        <button className="flex-1 py-3 flex flex-col items-center gap-0.5">
          <span className="text-xl">🗓</span>
          <span className="text-[10px] font-semibold text-[#0077b6]">行程</span>
        </button>
        <button
          className="flex-1 py-3 flex flex-col items-center gap-0.5"
          onClick={() => navigate(`/trips/${tripId}/settings`)}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] text-[#8fa0b0]">設定</span>
        </button>
      </nav>

      <InstallPrompt />
    </div>
  )
}
```

- [ ] **Step 4: Create `src/pages/NewTripPage.tsx`** (the extracted create form; success → navigate to the new trip)

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createTrip } from '../lib/db'

export function NewTripPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateTrip = async () => {
    if (!user?.email || !tripName.trim() || !startDate || !endDate || startDate > endDate) return
    setCreating(true)
    try {
      const displayName = (user.user_metadata?.full_name as string) ?? user.email ?? ''
      const avatarUrl = (user.user_metadata?.avatar_url as string) ?? ''
      const id = await createTrip(tripName.trim(), user.email, displayName, avatarUrl, startDate, endDate)
      navigate(`/trips/${id}`, { replace: true })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => navigate('/')} className="text-[#0077b6] text-sm">← 返回</button>
        <h1 className="text-base font-bold text-[#1a2530]">新增旅程</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-4xl">🌺</div>
        <div className="w-full max-w-sm flex flex-col gap-3">
          <input
            className="border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
            placeholder="旅程名稱"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreateTrip}
            disabled={creating || !tripName.trim() || !startDate || !endDate || startDate > endDate}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? '建立中...' : '建立旅程'}
          </button>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Register `/trips/new` in `src/App.tsx`** (import `NewTripPage`, add the route above `/trips/:tripId`)

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test && npx tsc -b`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/TimelinePage.tsx src/pages/NewTripPage.tsx src/App.tsx src/__tests__/pages/TimelinePage.test.tsx
git commit -m "✨ feat(trips): param-based timeline + dedicated new-trip page"
```

---

### Task 7: Per-trip SettingsPage + JoinPage redirect

**Files:**
- Modify: `src/pages/SettingsPage.tsx`, `src/pages/JoinPage.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `updateTrip`, `updateTripDates`, `deleteTrip`, `removeMember` (Tasks 3–4); route `/trips/:tripId/settings` (Task 5)
- Produces: final App.tsx route table (see Task 5 Step 4); JoinPage lands on `/trips/:tripId`

- [ ] **Step 1: Rewrite `src/pages/SettingsPage.tsx`**

Changes relative to current file:
- `const { tripId } = useParams<{ tripId: string }>()` replaces the localStorage read (delete `TRIP_ID_KEY`)
- Trip-name save uses `updateTrip(tripId, { name })` (already switched in Task 3)
- New 日期 section with two date inputs + save-on-blur via `updateTripDates`; blocked result shows an error line
- New 危險區 section: non-owner sees 退出旅程, owner sees 刪除旅程; both `window.confirm` then navigate `/`
- Everything else (member list, invite copy, sign-out) unchanged

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTrip, updateTripDates, deleteTrip, removeMember } from '../lib/db'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip } = useTrip(tripId ?? null)
  const [nameInput, setNameInput] = useState('')
  const [dates, setDates] = useState({ start: '', end: '' })
  const [dateError, setDateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  useEffect(() => {
    if (trip) setDates({ start: trip.start_date, end: trip.end_date })
  }, [trip?.start_date, trip?.end_date])

  const isOwner = trip?.owner_email === user?.email

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim()) return
    await updateTrip(tripId, { name: nameInput.trim() })
  }

  const handleSaveDates = async () => {
    if (!tripId || !dates.start || !dates.end || dates.start > dates.end) return
    if (trip && dates.start === trip.start_date && dates.end === trip.end_date) return
    const result = await updateTripDates(tripId, dates.start, dates.end)
    if (result.ok) setDateError(null)
    else if (result.blockedDates) setDateError(`以下日期已有行程,請先清空:${result.blockedDates.join('、')}`)
    else setDateError('日期更新失敗,請再試一次')
  }

  const handleCopyInvite = async () => {
    if (!tripId) return
    const url = `${window.location.origin}/join/${tripId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRemoveMember = async (email: string) => {
    if (!tripId) return
    setRemoving(email)
    await removeMember(tripId, email)
    setRemoving(null)
  }

  const handleLeave = async () => {
    if (!tripId || !user?.email || !window.confirm('確定要退出這個旅程嗎?')) return
    setBusy(true)
    await removeMember(tripId, user.email)
    navigate('/', { replace: true })
  }

  const handleDelete = async () => {
    if (!tripId || !window.confirm('確定要刪除整個旅程嗎?所有行程與圖片將一併刪除,無法復原。')) return
    setBusy(true)
    const ok = await deleteTrip(tripId)
    setBusy(false)
    if (ok) navigate('/', { replace: true })
    else window.alert('刪除失敗,只有主揪可以刪除旅程。')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => navigate(-1)} className="text-[#0077b6] text-sm">
          ← 返回
        </button>
        <h1 className="text-base font-bold text-[#1a2530]">設定</h1>
      </header>

      <main className="px-4 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-2">旅程名稱</p>
          <input
            className="w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <p className="text-xs font-semibold text-[#8fa0b0] mt-4 mb-2">旅程日期</p>
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.start}
              onChange={(e) => setDates(d => ({ ...d, start: e.target.value }))}
              onBlur={handleSaveDates}
            />
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.end}
              onChange={(e) => setDates(d => ({ ...d, end: e.target.value }))}
              onBlur={handleSaveDates}
            />
          </div>
          {dateError && <p className="text-xs text-[#dc2626] mt-2">{dateError}</p>}
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">
            旅伴 {trip ? `(${trip.members.length})` : ''}
          </p>
          <div className="flex flex-col gap-3 mb-3">
            {trip?.members.map((member) => (
              <div key={member.email} className="flex items-center gap-3">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#e8edf2] flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-[#5a7a8a]">
                      {(member.display_name || member.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2530] truncate">
                    {member.display_name || member.email}
                  </p>
                  {member.display_name && (
                    <p className="text-[11px] text-[#8fa0b0] truncate">{member.email}</p>
                  )}
                  {trip.owner_email === member.email && (
                    <p className="text-[10px] text-[#0077b6] font-semibold">主揪</p>
                  )}
                </div>
                {isOwner && member.email !== user?.email && (
                  <button
                    onClick={() => handleRemoveMember(member.email)}
                    disabled={removing === member.email}
                    className="text-[#dc2626] text-xs font-semibold shrink-0 disabled:opacity-40"
                  >
                    {removing === member.email ? '移除中' : '移除'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleCopyInvite}
            className="w-full bg-[#f0f4f8] text-[#0077b6] rounded-[8px] py-2.5 text-sm font-semibold active:opacity-70"
          >
            {copied ? '✓ 已複製連結' : '複製邀請連結'}
          </button>
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">危險區</p>
          {isOwner ? (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '刪除中...' : '刪除旅程'}
            </button>
          ) : (
            <button
              onClick={handleLeave}
              disabled={busy}
              className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '退出中...' : '退出旅程'}
            </button>
          )}
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">帳號</p>
          <div className="flex items-center gap-3 mb-4">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url as string} alt="" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-sm text-[#1a2530]">{user?.user_metadata?.full_name as string}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold"
          >
            登出
          </button>
        </section>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/pages/JoinPage.tsx`**

- Delete `const TRIP_ID_KEY = 'okinawa_trip_id'` (line 7)
- Delete the `supabase.auth.getSession()` debug wrapper + `console.log` block (lines 20-37) — legacy debugging of the fixed RLS issue; call `joinTrip` directly
- Success: `navigate(\`/trips/${tid}\`, { replace: true })` instead of localStorage + `/`
- Remove the now-unused `import { supabase } from '../supabase'`

The `useEffect` becomes:

```tsx
  useEffect(() => {
    if (!tripId || !user?.email) return
    const tid = tripId
    const displayName = (user.user_metadata?.full_name as string) ?? user.email
    const avatarUrl = (user.user_metadata?.avatar_url as string) ?? ''
    joinTrip(tid, user.email, displayName, avatarUrl).then((success) => {
      if (success) navigate(`/trips/${tid}`, { replace: true })
      else setStatus('error')
    })
  }, [tripId, user, navigate])
```

- [ ] **Step 3: Finalize `src/App.tsx`** — apply the final route table from Task 5 Step 4: `/trips/:tripId/settings` → `SettingsPage`, remove the old `/settings` route. `PendingJoinRedirect` stays unchanged.

- [ ] **Step 4: Full test run + typecheck**

Run: `npm test && npx tsc -b`
Expected: ALL PASS. Also grep to confirm the key is gone:
`grep -rn "okinawa_trip_id" src/` → no matches

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/pages/JoinPage.tsx src/App.tsx
git commit -m "✨ feat(trips): per-trip settings with dates/leave/delete; join lands on trip"
```

---

### Task 8: Rename to Tabi + full verification

**Files:**
- Modify: `package.json`, `index.html`, `vite.config.ts`, `src/pages/LoginPage.tsx`

**Interfaces:** none (string changes only)

- [ ] **Step 1: Apply renames**

- `package.json`: `"name": "vite-okinawa"` → `"name": "tabi"`
- `index.html` line 7: `<title>沖繩旅遊</title>` → `<title>Tabi</title>`
- `vite.config.ts` lines 13-14: manifest `name: '沖繩旅遊'` → `name: 'Tabi'`, `short_name: '沖繩旅遊'` → `short_name: 'Tabi'`
- `src/pages/LoginPage.tsx` line 10: replace the `沖繩旅遊` heading text with `Tabi`

- [ ] **Step 2: Regenerate lockfile**

Run: `npm install`
Expected: `package-lock.json` name fields update to `tabi`

- [ ] **Step 3: Verify no stray references in shipped code**

Run: `grep -rn "沖繩旅遊\|okinawa" src/ index.html vite.config.ts package.json`
Expected: no matches (docs/, migrations 002 seed, and test fixture strings like '沖繩 2026' are intentionally untouched — fixtures are data, not branding)

- [ ] **Step 4: Full test + build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts src/pages/LoginPage.tsx
git commit -m "🚚 chore: rename app to Tabi"
```

---

### Task 9: Integrate + external renames (checkpoint with user)

- [ ] **Step 1: Verify end-to-end in the real app** (use the `verify` skill): `npm run dev` in the worktree, drive: login → trip list → create trip → open timeline → settings (rename, dates) → copy invite → join flow in second context if feasible → delete trip. Fix anything broken before merging.

- [ ] **Step 2: Merge feature branch into master** (per superpowers:finishing-a-development-branch — present merge/PR options to the user)

- [ ] **Step 3: GitHub repo rename** (needs user-visible confirmation before running):

```bash
gh repo rename tabi
```

- [ ] **Step 4: Tell the user to rename the Supabase project display name** in Dashboard → Settings → General (project ref/URL unchanged; `.env.local` stays valid)

- [ ] **Step 5: LAST — rename the working directory** (after everything else is merged and verified; the current session's paths break after this, user must reopen in the new path):

```bash
mv /Users/seitumbp2025/okinawa-travel /Users/seitumbp2025/tabi
```
