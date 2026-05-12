# 沖繩旅遊 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2-person shared travel itinerary PWA with offline support, real-time Firebase sync, and a fork-itinerary feature for when the two travelers separate.

**Architecture:** React SPA served as a PWA. Firebase Auth handles Google sign-in; Firestore stores shared trip data (trips → days → events hierarchy) with offline persistence enabled so the app works without network. vite-plugin-pwa + Workbox caches the app shell. The main view is a vertical scrollable timeline grouped by day, with bottom-sheet forms for create/edit.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4, Firebase v10 (Auth + Firestore), vite-plugin-pwa, React Router v6, @dnd-kit/sortable, Vitest + React Testing Library

---

## Prerequisites (manual steps before Task 1)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Google Sign-In** in Authentication → Sign-in method
3. Create a **Firestore database** (start in test mode; security rules are added in Task 14)
4. Copy the Firebase SDK config values — needed for `.env.local` in Task 2
5. Add two PNG icons to `public/`: `icon-192.png` (192×192) and `icon-512.png` (512×512)

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/types.ts` | All TypeScript types: Trip, Day, TripEvent, ForkItem |
| `src/firebase.ts` | Firebase app, auth, db instances |
| `src/lib/firestore.ts` | All Firestore CRUD and subscription functions |
| `src/hooks/useAuth.ts` | Google sign-in/out + auth state listener |
| `src/hooks/useTrip.ts` | Trip + days real-time subscription |
| `src/hooks/useEvents.ts` | Events real-time subscription for one day |
| `src/hooks/useSyncStatus.ts` | Online/offline/syncing status |
| `src/hooks/useInstallPrompt.ts` | PWA beforeinstallprompt capture |
| `src/pages/LoginPage.tsx` | Google sign-in UI |
| `src/pages/JoinPage.tsx` | /join/:tripId invite handler |
| `src/pages/TimelinePage.tsx` | Main vertical timeline view |
| `src/pages/SettingsPage.tsx` | Trip name, invite link, sign-out |
| `src/components/EventCard.tsx` | Shared event card (pure display) |
| `src/components/ForkCard.tsx` | Fork event card with 2-column layout |
| `src/components/DaySection.tsx` | Day divider + sortable event list |
| `src/components/EventSheet.tsx` | Bottom sheet create/edit form |
| `src/components/SyncIndicator.tsx` | Colored dot + status text |
| `src/components/InstallPrompt.tsx` | PWA install banner |
| `src/App.tsx` | React Router setup + auth guard |
| `src/main.tsx` | App entry point |
| `vite.config.ts` | Vite + Tailwind v4 + vite-plugin-pwa + Vitest |
| `src/index.css` | Tailwind import + design tokens |
| `src/test-setup.ts` | @testing-library/jest-dom matchers |
| `firestore.rules` | Firestore security rules |

---

### Task 1: Project Scaffold

**Files:**
- Create: `vite.config.ts` (replaces scaffolded version)
- Create: `src/index.css` (replaces scaffolded version)
- Create: `src/test-setup.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Scaffold Vite project into existing directory**

```bash
cd /Users/seitumbp2025/okinawa-travel
npm create vite@latest . -- --template react-ts
```

When prompted about the non-empty directory, choose **"Ignore files and continue"** to keep the existing `.git`, `.gitignore`, and `docs/`.

- [ ] **Step 2: Install all dependencies**

```bash
npm install
npm install firebase react-router-dom
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install tailwindcss @tailwindcss/vite vite-plugin-pwa
npm install -D vitest @vitest/ui @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Replace vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '沖繩旅遊',
        short_name: '沖繩旅遊',
        theme_color: '#0077b6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Replace src/index.css**

```css
@import "tailwindcss";

@theme {
  --color-primary: #0077b6;
  --color-bg: #f0f4f8;
  --color-card: #ffffff;
  --color-border: #e8edf2;
  --color-text-secondary: #5a7a8a;
  --color-text-label: #8fa0b0;
  --color-danger: #dc2626;
}

* {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body {
  background-color: #f0f4f8;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 5: Create src/test-setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test scripts to package.json**

In the `"scripts"` section of `package.json`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 7: Verify scaffold compiles**

```bash
npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`, browser shows the Vite + React default page. Stop with Ctrl+C.

```bash
npm test
```

Expected: "No test files found, exiting with code 0" (no tests yet — this is fine).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold React + Vite + Tailwind v4 + Firebase + PWA + Vitest"
```

---

### Task 2: TypeScript Types + Firebase Init

**Files:**
- Create: `src/types.ts`
- Create: `src/firebase.ts`
- Create: `.env.local.example`
- Create: `.env.local` (not committed — contains real secrets)

- [ ] **Step 1: Write src/types.ts**

```ts
export interface ForkItem {
  person: string
  title: string
  location: string
  notes: string
}

export interface TripEvent {
  id: string
  type: 'shared' | 'fork'
  title: string
  time_start: string
  time_end: string
  location: string
  notes: string
  sort_order: number
  fork_items?: [ForkItem, ForkItem]
}

export interface Day {
  id: string
  date: string       // 'YYYY-MM-DD'
  label: string
  sort_order: number
}

export interface Trip {
  id: string
  name: string
  members: string[]  // email addresses
  start_date: string // 'YYYY-MM-DD'
  end_date: string   // 'YYYY-MM-DD'
}
```

- [ ] **Step 2: Create .env.local.example**

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

- [ ] **Step 3: Create .env.local with real values**

```bash
cp .env.local.example .env.local
# Edit .env.local — paste real values from Firebase Console → Project Settings → SDK setup
```

- [ ] **Step 4: Ensure .env.local is in .gitignore**

Add to `.gitignore` if not already present:

```
.env.local
```

- [ ] **Step 5: Write src/firebase.ts**

```ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
})
```

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/firebase.ts .env.local.example .gitignore
git commit -m "feat: add TypeScript types and Firebase initialization"
```

---

### Task 3: Firestore CRUD + Tests

**Files:**
- Create: `src/lib/firestore.ts`
- Create: `src/__tests__/lib/firestore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/firestore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBatch = {
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}
const mockDocRef = { id: 'mock-trip-id' }

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col'),
  doc: vi.fn(() => mockDocRef),
  setDoc: vi.fn().mockResolvedValue(undefined),
  writeBatch: vi.fn(() => mockBatch),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  arrayUnion: vi.fn((v: unknown) => v),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-event-id' }),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}))

vi.mock('../../firebase', () => ({ db: {} }))

import {
  createTrip,
  joinTrip,
  createEvent,
  reorderEvents,
} from '../../lib/firestore'
import { setDoc, getDoc, updateDoc, addDoc } from 'firebase/firestore'

beforeEach(() => vi.clearAllMocks())

describe('createTrip', () => {
  it('calls setDoc with trip data and batch-creates day documents', async () => {
    const id = await createTrip('沖繩 2025', 'sei@test.com', '2025-06-11', '2025-06-12')
    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({ name: '沖繩 2025', members: ['sei@test.com'] })
    )
    // 2 days: June 11 and June 12
    expect(mockBatch.set).toHaveBeenCalledTimes(2)
    expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    expect(id).toBe('mock-trip-id')
  })
})

describe('joinTrip', () => {
  it('returns false when trip does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any)
    const result = await joinTrip('nonexistent-id', 'user@test.com')
    expect(result).toBe(false)
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('adds email to members and returns true when trip exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true } as any)
    const result = await joinTrip('trip-id', 'user@test.com')
    expect(result).toBe(true)
    expect(updateDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({ members: 'user@test.com' })
    )
  })
})

describe('createEvent', () => {
  it('calls addDoc and returns the new event id', async () => {
    const eventData = {
      type: 'shared' as const,
      title: '美麗海水族館',
      time_start: '12:00',
      time_end: '15:00',
      location: '本部町',
      notes: '',
      sort_order: 0,
    }
    const id = await createEvent('trip-id', 'day-id', eventData)
    expect(addDoc).toHaveBeenCalledWith('mock-col', eventData)
    expect(id).toBe('new-event-id')
  })
})

describe('reorderEvents', () => {
  it('batch-updates sort_order for each event id in order', async () => {
    await reorderEvents('trip-id', 'day-id', ['e1', 'e2', 'e3'])
    expect(mockBatch.update).toHaveBeenCalledTimes(3)
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 0 })
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 1 })
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 2 })
    expect(mockBatch.commit).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```

Expected: `Error: Cannot find module '../../lib/firestore'`

- [ ] **Step 3: Write src/lib/firestore.ts**

```ts
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch,
  arrayUnion, getDoc, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Trip, Day, TripEvent } from '../types'

// --- Trip ---

export function subscribeToTrip(
  tripId: string,
  onTrip: (trip: Trip | null) => void
) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    if (!snap.exists()) { onTrip(null); return }
    onTrip({ id: snap.id, ...snap.data() } as Trip)
  })
}

export async function createTrip(
  name: string,
  ownerEmail: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const tripRef = doc(collection(db, 'trips'))
  await setDoc(tripRef, {
    name,
    members: [ownerEmail],
    start_date: startDate,
    end_date: endDate,
  })
  const batch = writeBatch(db)
  let sortOrder = 0
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    const dayRef = doc(collection(db, 'trips', tripRef.id, 'days'))
    batch.set(dayRef, {
      date: current.toISOString().split('T')[0],
      label: '',
      sort_order: sortOrder++,
    })
    current.setDate(current.getDate() + 1)
  }
  await batch.commit()
  return tripRef.id
}

export async function joinTrip(tripId: string, email: string): Promise<boolean> {
  const tripRef = doc(db, 'trips', tripId)
  const snap = await getDoc(tripRef)
  if (!snap.exists()) return false
  await updateDoc(tripRef, { members: arrayUnion(email) })
  return true
}

export async function updateTripName(tripId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId), { name })
}

// --- Days ---

export function subscribeToDays(
  tripId: string,
  onDays: (days: Day[]) => void
) {
  const q = query(collection(db, 'trips', tripId, 'days'), orderBy('sort_order'))
  return onSnapshot(q, (snap) => {
    onDays(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Day))
  })
}

export async function updateDayLabel(
  tripId: string,
  dayId: string,
  label: string
): Promise<void> {
  await updateDoc(doc(db, 'trips', tripId, 'days', dayId), { label })
}

// --- Events ---

export function subscribeToEvents(
  tripId: string,
  dayId: string,
  onEvents: (events: TripEvent[]) => void
) {
  const q = query(
    collection(db, 'trips', tripId, 'days', dayId, 'events'),
    orderBy('sort_order')
  )
  return onSnapshot(q, (snap) => {
    onEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TripEvent))
  })
}

export async function createEvent(
  tripId: string,
  dayId: string,
  event: Omit<TripEvent, 'id'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'trips', tripId, 'days', dayId, 'events'),
    event
  )
  return ref.id
}

export async function updateEvent(
  tripId: string,
  dayId: string,
  eventId: string,
  data: Partial<Omit<TripEvent, 'id'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'trips', tripId, 'days', dayId, 'events', eventId),
    data
  )
}

export async function deleteEvent(
  tripId: string,
  dayId: string,
  eventId: string
): Promise<void> {
  await deleteDoc(doc(db, 'trips', tripId, 'days', dayId, 'events', eventId))
}

export async function reorderEvents(
  tripId: string,
  dayId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, i) => {
    batch.update(
      doc(db, 'trips', tripId, 'days', dayId, 'events', id),
      { sort_order: i }
    )
  })
  await batch.commit()
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore.ts src/__tests__/lib/firestore.test.ts
git commit -m "feat: add Firestore CRUD functions with tests"
```

---

### Task 4: Auth Hook + Login Page

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/pages/LoginPage.tsx`
- Create: `src/__tests__/hooks/useAuth.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/hooks/useAuth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.fn()
const mockSignInWithPopup = vi.fn()
const mockSignOut = vi.fn()

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  getAuth: vi.fn(),
}))

vi.mock('../../firebase', () => ({
  auth: {
    onAuthStateChanged: (cb: (u: null) => void) => {
      cb(null)
      return mockUnsubscribe
    },
  },
}))

import { useAuth } from '../../hooks/useAuth'

beforeEach(() => vi.clearAllMocks())

describe('useAuth', () => {
  it('resolves loading and sets user to null when unauthenticated', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('calls signInWithPopup on signIn()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(() => result.current.signIn())
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1)
  })

  it('calls signOut on signOut()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes auth listener on unmount', () => {
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```

Expected: `Cannot find module '../../hooks/useAuth'`

- [ ] **Step 3: Write src/hooks/useAuth.ts**

```ts
import { useState, useEffect } from 'react'
import { User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return auth.onAuthStateChanged((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
  const signOut = () => firebaseSignOut(auth)

  return { user, loading, signIn, signOut }
}
```

- [ ] **Step 4: Write src/pages/LoginPage.tsx**

```tsx
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[#f0f4f8] px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">🌺</div>
        <h1 className="text-2xl font-bold text-[#1a2530]">沖繩旅遊</h1>
        <p className="text-[#5a7a8a] mt-2 text-sm">共享行程，一起出發</p>
      </div>
      <button
        onClick={signIn}
        className="w-full max-w-xs bg-[#0077b6] text-white rounded-[10px] py-3 px-6 font-semibold text-sm active:opacity-80 transition-opacity"
      >
        Google 帳號登入
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Run — verify pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAuth.ts src/pages/LoginPage.tsx src/__tests__/hooks/useAuth.test.ts
git commit -m "feat: add useAuth hook and LoginPage"
```

---

### Task 5: App Router + Route Guard + Placeholder Pages

**Files:**
- Replace: `src/main.tsx`
- Replace: `src/App.tsx`
- Create: `src/pages/TimelinePage.tsx` (placeholder)
- Create: `src/pages/JoinPage.tsx` (placeholder)
- Create: `src/pages/SettingsPage.tsx` (placeholder)

- [ ] **Step 1: Replace src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 2: Replace src/App.tsx**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { TimelinePage } from './pages/TimelinePage'
import { JoinPage } from './pages/JoinPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="text-[#8fa0b0] text-sm">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/join/:tripId" element={<JoinPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<TimelinePage />} />
      <Route path="/join/:tripId" element={<JoinPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Create placeholder pages**

Create `src/pages/TimelinePage.tsx`:

```tsx
export function TimelinePage() {
  return <div className="p-4 text-[#1a2530]">Timeline (placeholder)</div>
}
```

Create `src/pages/JoinPage.tsx`:

```tsx
export function JoinPage() {
  return <div className="p-4 text-[#1a2530]">Join (placeholder)</div>
}
```

Create `src/pages/SettingsPage.tsx`:

```tsx
export function SettingsPage() {
  return <div className="p-4 text-[#1a2530]">Settings (placeholder)</div>
}
```

- [ ] **Step 4: Verify app compiles**

```bash
npm run dev
```

Expected: App loads and shows LoginPage (not authenticated). No TypeScript errors in terminal. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx src/pages/TimelinePage.tsx src/pages/JoinPage.tsx src/pages/SettingsPage.tsx
git commit -m "feat: add React Router with auth guard and placeholder pages"
```

---

### Task 6: Trip + Events Hooks

**Files:**
- Create: `src/hooks/useTrip.ts`
- Create: `src/hooks/useEvents.ts`

- [ ] **Step 1: Write src/hooks/useTrip.ts**

```ts
import { useState, useEffect } from 'react'
import { subscribeToTrip, subscribeToDays } from '../lib/firestore'
import type { Trip, Day } from '../types'

export function useTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) { setLoading(false); return }

    const tripUnsub = subscribeToTrip(tripId, (t) => {
      setTrip(t)
      setLoading(false)
    })
    const daysUnsub = subscribeToDays(tripId, setDays)

    return () => {
      tripUnsub()
      daysUnsub()
    }
  }, [tripId])

  return { trip, days, loading }
}
```

- [ ] **Step 2: Write src/hooks/useEvents.ts**

```ts
import { useState, useEffect } from 'react'
import { subscribeToEvents } from '../lib/firestore'
import type { TripEvent } from '../types'

export function useEvents(tripId: string | null, dayId: string) {
  const [events, setEvents] = useState<TripEvent[]>([])

  useEffect(() => {
    if (!tripId) return
    return subscribeToEvents(tripId, dayId, setEvents)
  }, [tripId, dayId])

  return events
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTrip.ts src/hooks/useEvents.ts
git commit -m "feat: add useTrip and useEvents real-time hooks"
```

---

### Task 7: EventCard + ForkCard + Tests

**Files:**
- Create: `src/components/EventCard.tsx`
- Create: `src/components/ForkCard.tsx`
- Create: `src/__tests__/components/EventCard.test.tsx`
- Create: `src/__tests__/components/ForkCard.test.tsx`

- [ ] **Step 1: Write failing tests for EventCard**

Create `src/__tests__/components/EventCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '../../components/EventCard'
import type { TripEvent } from '../../types'

const sharedEvent: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '美麗海水族館',
  time_start: '12:00',
  time_end: '15:00',
  location: '本部町',
  notes: '',
  sort_order: 0,
}

describe('EventCard', () => {
  it('renders title and time range', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('美麗海水族館')).toBeInTheDocument()
    expect(screen.getByText('12:00 – 15:00')).toBeInTheDocument()
  })

  it('renders location when present', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('本部町')).toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<EventCard event={sharedEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('美麗海水族館'))
    expect(onClick).toHaveBeenCalledWith(sharedEvent)
  })
})
```

- [ ] **Step 2: Write failing tests for ForkCard**

Create `src/__tests__/components/ForkCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ForkCard } from '../../components/ForkCard'
import type { TripEvent } from '../../types'

const forkEvent: TripEvent = {
  id: 'e2',
  type: 'fork',
  title: '',
  time_start: '15:30',
  time_end: '17:30',
  location: '',
  notes: '',
  sort_order: 1,
  fork_items: [
    { person: 'Sei', title: '參加活動', location: '', notes: '' },
    { person: '同事', title: '浦添 PARCO', location: '', notes: '' },
  ],
}

describe('ForkCard', () => {
  it('renders both person names', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('Sei')).toBeInTheDocument()
    expect(screen.getByText('同事')).toBeInTheDocument()
  })

  it('renders both activity titles', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('參加活動')).toBeInTheDocument()
    expect(screen.getByText('浦添 PARCO')).toBeInTheDocument()
  })

  it('shows time range in header', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText(/15:30–17:30/)).toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<ForkCard event={forkEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('Sei'))
    expect(onClick).toHaveBeenCalledWith(forkEvent)
  })
})
```

- [ ] **Step 3: Run — verify fail**

```bash
npm test
```

Expected: `Cannot find module '../../components/EventCard'` and `ForkCard`.

- [ ] **Step 4: Write src/components/EventCard.tsx**

```tsx
import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function EventCard({ event, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(event)}
      className="w-full bg-white rounded-[12px] px-4 py-3 border border-[#e8edf2] text-left active:opacity-70 transition-opacity"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#8fa0b0] mb-1">
            {event.time_start} – {event.time_end}
          </p>
          <p className="text-sm font-semibold text-[#1a2530] truncate">{event.title}</p>
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
          )}
        </div>
        <span className="text-[#e8edf2] text-lg ml-2 shrink-0">›</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Write src/components/ForkCard.tsx**

```tsx
import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function ForkCard({ event, onClick }: Props) {
  const [left, right] = event.fork_items ?? [
    { person: '', title: '', location: '', notes: '' },
    { person: '', title: '', location: '', notes: '' },
  ]

  return (
    <button
      onClick={() => onClick(event)}
      className="w-full bg-white rounded-[12px] border border-[#e8edf2] border-l-[3px] border-l-[#0077b6] text-left active:opacity-70 transition-opacity overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-[#0077b6] tracking-wide">
          ↕ 分岔行程 · {event.time_start}–{event.time_end}
        </p>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <div className="flex-1 bg-[#f0f7ff] border border-[#cce4f6] rounded-[8px] p-2">
          <p className="text-[10px] font-bold text-[#0077b6] mb-1">{left.person}</p>
          <p className="text-xs font-semibold text-[#1a2530]">{left.title}</p>
          {left.location && (
            <p className="text-[10px] text-[#5a7a8a] mt-0.5">{left.location}</p>
          )}
        </div>
        <div className="flex-1 bg-[#f8f9fa] border border-[#e8edf2] rounded-[8px] p-2">
          <p className="text-[10px] font-bold text-[#5a7a8a] mb-1">{right.person}</p>
          <p className="text-xs font-semibold text-[#1a2530]">{right.title}</p>
          {right.location && (
            <p className="text-[10px] text-[#5a7a8a] mt-0.5">{right.location}</p>
          )}
        </div>
      </div>
    </button>
  )
}
```

- [ ] **Step 6: Run — verify pass**

```bash
npm test
```

Expected: All tests pass including 7 new EventCard + ForkCard tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/EventCard.tsx src/components/ForkCard.tsx \
  src/__tests__/components/EventCard.test.tsx src/__tests__/components/ForkCard.test.tsx
git commit -m "feat: add EventCard and ForkCard components with tests"
```

---

### Task 8: EventSheet Bottom Sheet + Tests

**Files:**
- Create: `src/components/EventSheet.tsx`
- Create: `src/__tests__/components/EventSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/components/EventSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EventSheet } from '../../components/EventSheet'
import type { TripEvent } from '../../types'

vi.mock('../../lib/firestore', () => ({
  createEvent: vi.fn().mockResolvedValue('new-id'),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}))

const sharedEvent: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '美麗海水族館',
  time_start: '12:00',
  time_end: '15:00',
  location: '本部町',
  notes: '',
  sort_order: 0,
}

describe('EventSheet', () => {
  it('renders nothing when open=false', () => {
    render(
      <EventSheet open={false} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    expect(screen.queryByText('共同')).toBeNull()
  })

  it('shows create title and empty form when open=true with no event', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    expect(screen.getByText('新增行程')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('行程名稱')).toBeInTheDocument()
  })

  it('shows edit title and pre-fills fields from existing event', () => {
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" eventCount={1} onClose={() => {}} />
    )
    expect(screen.getByText('編輯行程')).toBeInTheDocument()
    expect(screen.getByDisplayValue('美麗海水族館')).toBeInTheDocument()
  })

  it('switches to fork mode when 分岔 toggle clicked', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分岔'))
    expect(screen.getByPlaceholderText('人名 A')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('人名 B')).toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```

Expected: `Cannot find module '../../components/EventSheet'`

- [ ] **Step 3: Write src/components/EventSheet.tsx**

```tsx
import { useState, useEffect } from 'react'
import type { TripEvent, ForkItem } from '../types'
import { createEvent, updateEvent, deleteEvent } from '../lib/firestore'

interface Props {
  open: boolean
  event: TripEvent | null
  dayId: string
  tripId: string
  eventCount: number
  onClose: () => void
}

const emptyFork = (): ForkItem => ({ person: '', title: '', location: '', notes: '' })

export function EventSheet({ open, event, dayId, tripId, eventCount, onClose }: Props) {
  const isEdit = event !== null
  const [type, setType] = useState<'shared' | 'fork'>('shared')
  const [title, setTitle] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [forkA, setForkA] = useState<ForkItem>(emptyFork())
  const [forkB, setForkB] = useState<ForkItem>(emptyFork())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setType(event?.type ?? 'shared')
    setTitle(event?.title ?? '')
    setTimeStart(event?.time_start ?? '')
    setTimeEnd(event?.time_end ?? '')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    setForkA(event?.fork_items?.[0] ?? emptyFork())
    setForkB(event?.fork_items?.[1] ?? emptyFork())
  }, [event, open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    const base = {
      type,
      time_start: timeStart,
      time_end: timeEnd,
      sort_order: isEdit ? event.sort_order : eventCount,
    }
    const data: Omit<TripEvent, 'id'> = type === 'shared'
      ? { ...base, title, location, notes }
      : { ...base, title: '', location: '', notes: '', fork_items: [forkA, forkB] }

    if (isEdit) {
      await updateEvent(tripId, dayId, event.id, data)
    } else {
      await createEvent(tripId, dayId, data)
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!isEdit) return
    setSaving(true)
    await deleteEvent(tripId, dayId, event.id)
    setSaving(false)
    onClose()
  }

  const inputCls =
    'w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530] bg-white focus:outline-none focus:border-[#0077b6]'
  const labelCls = 'text-[11px] font-semibold text-[#8fa0b0] mb-1 block'

  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] px-4 pt-3 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mb-4" />
        <p className="text-[15px] font-bold text-[#1a2530] mb-4">
          {isEdit ? '編輯行程' : '新增行程'}
        </p>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          {(['shared', 'fork'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-[8px] py-1.5 text-xs font-semibold transition-colors ${
                type === t
                  ? 'bg-[#0077b6] text-white'
                  : 'bg-[#f0f4f8] text-[#5a7a8a]'
              }`}
            >
              {t === 'shared' ? '共同' : '分岔'}
            </button>
          ))}
        </div>

        {type === 'shared' ? (
          <>
            <div className="mb-3">
              <label className={labelCls}>名稱</label>
              <input
                className={inputCls}
                placeholder="行程名稱"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={labelCls}>開始</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>結束</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>地點</label>
              <input
                className={inputCls}
                placeholder="地點（選填）"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className={labelCls}>備註</label>
              <textarea
                className={`${inputCls} h-16 resize-none`}
                placeholder="備註（選填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={labelCls}>開始</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>結束</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              {(
                [
                  { item: forkA, setItem: setForkA, label: 'A' },
                  { item: forkB, setItem: setForkB, label: 'B' },
                ] as const
              ).map(({ item, setItem, label }) => (
                <div key={label} className="flex-1 bg-[#f8f9fa] rounded-[8px] p-2 flex flex-col gap-1.5">
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder={`人名 ${label}`}
                    value={item.person}
                    onChange={(e) => setItem({ ...item, person: e.target.value })}
                  />
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="活動"
                    value={item.title}
                    onChange={(e) => setItem({ ...item, title: e.target.value })}
                  />
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="地點"
                    value={item.location}
                    onChange={(e) => setItem({ ...item, location: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#0077b6] text-white rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            儲存
          </button>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="bg-[#fee2e2] text-[#dc2626] rounded-[10px] px-4 text-sm font-semibold disabled:opacity-60"
            >
              刪除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```

Expected: All tests pass including 5 new EventSheet tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventSheet.tsx src/__tests__/components/EventSheet.test.tsx
git commit -m "feat: add EventSheet bottom sheet with create/edit/delete and fork mode"
```

---

### Task 9: DaySection (with drag-to-reorder)

**Files:**
- Create: `src/components/DaySection.tsx`

- [ ] **Step 1: Write src/components/DaySection.tsx**

```tsx
import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEvents } from '../hooks/useEvents'
import { reorderEvents, updateDayLabel } from '../lib/firestore'
import { EventCard } from './EventCard'
import { ForkCard } from './ForkCard'
import { EventSheet } from './EventSheet'
import type { Day, TripEvent } from '../types'

function SortableCard({
  event,
  onEdit,
}: {
  event: TripEvent
  onEdit: (e: TripEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {event.type === 'fork' ? (
        <ForkCard event={event} onClick={onEdit} />
      ) : (
        <EventCard event={event} onClick={onEdit} />
      )}
    </div>
  )
}

interface Props {
  day: Day
  tripId: string
}

export function DaySection({ day, tripId }: Props) {
  const events = useEvents(tripId, day.id)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(day.label)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  )

  const dateObj = new Date(day.date + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay()]})`

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = events.findIndex((e) => e.id === active.id)
    const newIndex = events.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(events, oldIndex, newIndex)
    await reorderEvents(tripId, day.id, reordered.map((e) => e.id))
  }

  const handleLabelBlur = async () => {
    setEditingLabel(false)
    if (labelDraft !== day.label) {
      await updateDayLabel(tripId, day.id, labelDraft)
    }
  }

  const openCreate = () => {
    setSelectedEvent(null)
    setSheetOpen(true)
  }

  const openEdit = (e: TripEvent) => {
    setSelectedEvent(e)
    setSheetOpen(true)
  }

  return (
    <section>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-[#0077b6] whitespace-nowrap">{dateLabel}</span>
        {editingLabel ? (
          <input
            autoFocus
            className="text-xs text-[#5a7a8a] bg-transparent border-b border-[#0077b6] outline-none flex-1 min-w-0"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-xs text-[#8fa0b0] flex-1 min-w-0 text-left truncate"
          >
            {day.label || '點擊新增標籤'}
          </button>
        )}
        <div className="h-px flex-1 bg-[#e8edf2] shrink" />
        <button
          onClick={openCreate}
          className="text-[#0077b6] text-xl leading-none w-7 h-7 flex items-center justify-center shrink-0"
        >
          ＋
        </button>
      </div>

      {/* Sortable event list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <SortableCard key={event.id} event={event} onEdit={openEdit} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <EventSheet
        open={sheetOpen}
        event={selectedEvent}
        dayId={day.id}
        tripId={tripId}
        eventCount={events.length}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  )
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: All existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DaySection.tsx
git commit -m "feat: add DaySection with drag-to-reorder via @dnd-kit"
```

---

### Task 10: Sync Status

**Files:**
- Create: `src/hooks/useSyncStatus.ts`
- Create: `src/components/SyncIndicator.tsx`

- [ ] **Step 1: Write src/hooks/useSyncStatus.ts**

```ts
import { useState, useEffect } from 'react'

export type SyncStatus = 'synced' | 'syncing' | 'offline'

export function useSyncStatus(): SyncStatus {
  const [online, setOnline] = useState(navigator.onLine)
  const [justCameOnline, setJustCameOnline] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const handleOnline = () => {
      setOnline(true)
      setJustCameOnline(true)
      timer = setTimeout(() => setJustCameOnline(false), 2000)
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(timer)
    }
  }, [])

  if (!online) return 'offline'
  if (justCameOnline) return 'syncing'
  return 'synced'
}
```

- [ ] **Step 2: Write src/components/SyncIndicator.tsx**

```tsx
import type { SyncStatus } from '../hooks/useSyncStatus'

const config: Record<SyncStatus, { dot: string; text: string; pulse: boolean }> = {
  synced:  { dot: 'bg-green-500',  text: '已同步',    pulse: false },
  syncing: { dot: 'bg-yellow-400', text: '同步中...', pulse: true  },
  offline: { dot: 'bg-red-500',    text: '離線模式',  pulse: false },
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  const { dot, text, pulse } = config[status]
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-[11px] text-[#5a7a8a]">{text}</span>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSyncStatus.ts src/components/SyncIndicator.tsx
git commit -m "feat: add useSyncStatus hook and SyncIndicator component"
```

---

### Task 11: Timeline Page (full implementation)

**Files:**
- Replace: `src/pages/TimelinePage.tsx`

- [ ] **Step 1: Replace src/pages/TimelinePage.tsx**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { createTrip } from '../lib/firestore'
import { SyncIndicator } from '../components/SyncIndicator'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tripId, setTripId] = useState<string | null>(() => localStorage.getItem(TRIP_ID_KEY))
  const { trip, days, loading } = useTrip(tripId)
  const syncStatus = useSyncStatus()

  const [tripName, setTripName] = useState('沖繩旅遊')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateTrip = async () => {
    if (!user?.email || !startDate || !endDate) return
    setCreating(true)
    const id = await createTrip(tripName, user.email, startDate, endDate)
    localStorage.setItem(TRIP_ID_KEY, id)
    setTripId(id)
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <p className="text-sm text-[#8fa0b0]">載入中...</p>
      </div>
    )
  }

  if (!tripId || !trip) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-4xl">🌺</div>
        <h2 className="text-lg font-bold text-[#1a2530]">建立你的旅程</h2>
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
            disabled={creating || !startDate || !endDate}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? '建立中...' : '建立旅程'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-[#1a2530]">{trip.name}</h1>
        <div className="flex items-center gap-3">
          <SyncIndicator status={syncStatus} />
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection key={day.id} day={day} tripId={trip.id} />
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
          onClick={() => navigate('/settings')}
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

- [ ] **Step 2: Create placeholder InstallPrompt so file compiles**

Create `src/components/InstallPrompt.tsx`:

```tsx
export function InstallPrompt() {
  return null
}
```

- [ ] **Step 3: Run tests + smoke test**

```bash
npm test
```

Expected: All tests pass.

```bash
npm run dev
```

Open `http://localhost:5173`. Sign in with Google. Create a trip with a date range. Verify:
- Days appear as sections
- ＋ button opens EventSheet
- Creating an event shows it in the timeline
- Editing an event pre-fills the form
- Deleting removes it

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TimelinePage.tsx src/components/InstallPrompt.tsx
git commit -m "feat: implement full Timeline page with DaySection and sync indicator"
```

---

### Task 12: Join Page + Settings Page

**Files:**
- Replace: `src/pages/JoinPage.tsx`
- Replace: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Replace src/pages/JoinPage.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { joinTrip } from '../lib/firestore'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function JoinPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'joining' | 'error'>('joining')

  useEffect(() => {
    if (!tripId || !user?.email) return

    joinTrip(tripId, user.email).then((success) => {
      if (success) {
        localStorage.setItem(TRIP_ID_KEY, tripId)
        navigate('/', { replace: true })
      } else {
        setStatus('error')
      }
    })
  }, [tripId, user, navigate])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-[#1a2530]">請先登入以加入旅程</p>
        <button
          onClick={signIn}
          className="bg-[#0077b6] text-white rounded-[10px] py-3 px-8 text-sm font-semibold"
        >
          Google 帳號登入
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center px-6">
        <p className="text-sm text-[#dc2626]">旅程不存在或連結已失效。</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
      <p className="text-sm text-[#8fa0b0]">加入旅程中...</p>
    </div>
  )
}
```

- [ ] **Step 2: Replace src/pages/SettingsPage.tsx**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTripName } from '../lib/firestore'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const tripId = localStorage.getItem(TRIP_ID_KEY)
  const { trip } = useTrip(tripId)
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim()) return
    await updateTripName(tripId, nameInput.trim())
  }

  const handleCopyInvite = async () => {
    if (!tripId) return
    const url = `${window.location.origin}/join/${tripId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-2">邀請同伴</p>
          <button
            onClick={handleCopyInvite}
            className="w-full bg-[#f0f4f8] text-[#0077b6] rounded-[8px] py-2.5 text-sm font-semibold active:opacity-70"
          >
            {copied ? '✓ 已複製連結' : '複製邀請連結'}
          </button>
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">帳號</p>
          <div className="flex items-center gap-3 mb-4">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-sm text-[#1a2530]">{user?.displayName}</p>
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

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Test the join flow:
1. From the Timeline page, go to Settings and copy the invite link
2. Open the link in a new browser tab
3. Sign in with a different Google account
4. Verify the page shows "加入旅程中..." then redirects to the timeline

Test settings:
- Edit trip name and blur/press Enter — verify the header updates
- Sign out — verify redirect to LoginPage

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/pages/JoinPage.tsx src/pages/SettingsPage.tsx
git commit -m "feat: implement JoinPage invite flow and SettingsPage"
```

---

### Task 13: PWA Install Prompt

**Files:**
- Create: `src/hooks/useInstallPrompt.ts`
- Replace: `src/components/InstallPrompt.tsx`

- [ ] **Step 1: Write src/hooks/useInstallPrompt.ts**

```ts
import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    setPrompt(null)
  }

  const dismiss = () => setPrompt(null)

  return { canInstall: !!prompt, install, dismiss }
}
```

- [ ] **Step 2: Replace src/components/InstallPrompt.tsx**

```tsx
import { useInstallPrompt } from '../hooks/useInstallPrompt'

export function InstallPrompt() {
  const { canInstall, install, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-white rounded-[12px] border border-[#e8edf2] shadow-lg px-4 py-3 flex items-center gap-3 z-40">
      <span className="text-2xl">🌺</span>
      <p className="flex-1 text-xs text-[#1a2530]">加入主畫面，隨時查看行程</p>
      <button onClick={dismiss} className="text-[#8fa0b0] text-xs shrink-0">
        略過
      </button>
      <button
        onClick={install}
        className="bg-[#0077b6] text-white text-xs font-semibold rounded-[8px] px-3 py-1.5 shrink-0"
      >
        安裝
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Build and verify PWA manifest**

```bash
npm run build && npm run preview
```

Open `http://localhost:4173` in Chrome.

Open DevTools → Application → Manifest — verify:
- Name: `沖繩旅遊`
- Theme color: `#0077b6`
- Display: `standalone`
- Icons listed

Open DevTools → Application → Service Workers — verify service worker is registered and activated.

Stop preview server.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useInstallPrompt.ts src/components/InstallPrompt.tsx
git commit -m "feat: implement PWA install prompt"
```

---

### Task 14: Firestore Security Rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Write firestore.rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isLoggedIn() {
      return request.auth != null;
    }

    function isTripMember(tripId) {
      return isLoggedIn()
        && request.auth.token.email in
           get(/databases/$(database)/documents/trips/$(tripId)).data.members;
    }

    match /trips/{tripId} {
      allow read: if isTripMember(tripId);
      allow create: if isLoggedIn()
        && request.auth.token.email in request.resource.data.members;
      allow update: if isTripMember(tripId);
      allow delete: if false;

      match /days/{dayId} {
        allow read, write: if isTripMember(tripId);

        match /events/{eventId} {
          allow read, write: if isTripMember(tripId);
        }
      }
    }
  }
}
```

- [ ] **Step 2: Install Firebase CLI if not already installed**

```bash
npx firebase-tools --version
```

If not installed or below v13:

```bash
npm install -g firebase-tools
firebase login
```

- [ ] **Step 3: Initialize Firebase project in this directory**

```bash
npx firebase-tools init firestore
```

When prompted:
- "What file should be used for Firestore Rules?" → accept default `firestore.rules`
- "What file should be used for Firestore indexes?" → accept default

- [ ] **Step 4: Deploy rules**

```bash
npx firebase-tools deploy --only firestore:rules
```

Expected output: `✔  Deploy complete!`

- [ ] **Step 5: Verify rules in Firebase Console**

Open Firebase Console → Firestore → Rules.

Use the **Rules Playground** tab to test:
- Auth: Provide (check "Authenticated") with email `sei@gmail.com`
- Simulate a `get` on `/trips/{tripId}` where `members` contains `sei@gmail.com`
- Expected: **Allow**

- Auth: Use an email NOT in `members`
- Simulate same `get`
- Expected: **Deny**

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firebase.json .firebaserc
git commit -m "feat: add Firestore security rules with member-based access control"
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Task |
|------------------|------|
| PWA (standalone, offline) | Task 1, 13 |
| Offline Firestore cache | Task 2 (`persistentLocalCache`) |
| Google Sign-In | Task 4 |
| Vertical timeline main view | Task 11 |
| Day dividers with labels | Task 9 |
| Shared event card | Task 7 |
| Fork event card (2-column) | Task 7 |
| Add event via ＋ | Task 8, 9 |
| Edit event (bottom sheet) | Task 8, 9 |
| Delete event | Task 8 |
| Toggle shared ↔ fork | Task 8 |
| Drag-to-reorder within day | Task 9 |
| Sync status indicator | Task 10, 11 |
| Trip creation flow | Task 11 |
| Join via invite link | Task 12 |
| Trip name edit | Task 12 |
| Copy invite link | Task 12 |
| Sign-out | Task 12 |
| PWA install prompt | Task 13 |
| Firestore security rules | Task 14 |
| Design tokens (blue #0077b6, etc.) | Task 1 |
