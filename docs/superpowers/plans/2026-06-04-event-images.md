# Event Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cover image and location link to each trip event — shown as a right-side thumbnail in EventCard; tapping it opens a detail sheet with the full image, a link button, and an edit shortcut.

**Architecture:** `events` table gets two nullable columns (`image_url`, `link_url`). Images are stored in Supabase Storage bucket `event-images` at path `{tripId}/{eventId}.{ext}`. EventCard conditionally renders a thumbnail; tapping it opens the new EventDetailSheet, which provides the full image, an optional "前往官網" link, and a shortcut to EventSheet for editing.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Storage), Vitest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `supabase/migrations/007_event_images.sql` | DB columns + storage policies |
| MODIFY | `src/types.ts` | Add `image_url?`, `link_url?` to TripEvent |
| CREATE | `src/lib/storage.ts` | `uploadEventImage()` |
| MODIFY | `src/lib/db.ts` | `createEvent` accepts optional pre-generated id |
| MODIFY | `src/components/EventCard.tsx` | Thumbnail + `onImageClick` prop |
| CREATE | `src/components/EventDetailSheet.tsx` | Full image + link + edit |
| MODIFY | `src/components/EventSheet.tsx` | Image picker + link URL input |
| MODIFY | `src/components/DaySection.tsx` | Wire EventDetailSheet state |
| CREATE | `src/__tests__/lib/storage.test.ts` | Test uploadEventImage |
| MODIFY | `src/__tests__/components/EventCard.test.tsx` | Thumbnail tests |
| CREATE | `src/__tests__/components/EventDetailSheet.test.tsx` | New component tests |
| MODIFY | `src/__tests__/components/EventSheet.test.tsx` | Image/link field tests |

---

## Task 1: DB Migration + Types

**Files:**
- Create: `supabase/migrations/007_event_images.sql`
- Modify: `src/types.ts`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/007_event_images.sql
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
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to **SQL Editor** in your Supabase project and run the migration.
Then go to **Storage** and create bucket `event-images` with **Public: ON**.

- [ ] **Step 3: Update types.ts**

Replace the `TripEvent` interface in `src/types.ts`:

```ts
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
  image_url?: string | null
  link_url?: string | null
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_event_images.sql src/types.ts
git commit -m "feat(events): add image_url and link_url columns + storage policies"
```

---

## Task 2: Storage Helper + DB Change

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/__tests__/lib/storage.test.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Write failing test for uploadEventImage**

Create `src/__tests__/lib/storage.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockStorage } = vi.hoisted(() => {
  const mockUpload = vi.fn()
  const mockGetPublicUrl = vi.fn()
  const mockFrom = vi.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }))
  return { mockStorage: { from: mockFrom, _upload: mockUpload, _getPublicUrl: mockGetPublicUrl } }
})

vi.mock('../../supabase', () => ({
  supabase: { storage: mockStorage },
}))

import { uploadEventImage } from '../../lib/storage'

beforeEach(() => vi.clearAllMocks())

describe('uploadEventImage', () => {
  it('uploads to correct path and returns public URL', async () => {
    mockStorage._upload.mockResolvedValue({ error: null })
    mockStorage._getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/trip1/event1.jpg' } })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const url = await uploadEventImage('trip1', 'event1', file)

    expect(mockStorage.from).toHaveBeenCalledWith('event-images')
    expect(mockStorage._upload).toHaveBeenCalledWith(
      'trip1/event1.jpg',
      file,
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' })
    )
    expect(url).toBe('https://cdn.example.com/trip1/event1.jpg')
  })

  it('throws when upload fails', async () => {
    mockStorage._upload.mockResolvedValue({ error: { message: 'upload error' } })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(uploadEventImage('trip1', 'event1', file)).rejects.toThrow('upload error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/lib/storage.test.ts
```

Expected: FAIL — `uploadEventImage` not found.

- [ ] **Step 3: Create src/lib/storage.ts**

```ts
import { supabase } from '../supabase'

export async function uploadEventImage(
  tripId: string,
  eventId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${tripId}/${eventId}.${ext}`

  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('event-images').getPublicUrl(path)
  return data.publicUrl
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/storage.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Modify createEvent in src/lib/db.ts to accept optional id**

Change only the signature and insert payload of `createEvent`:

```ts
export async function createEvent(
  tripId: string,
  dayId: string,
  event: Omit<TripEvent, 'id'> & { id?: string }
): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...event, trip_id: tripId, day_id: dayId })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'createEvent failed')
  return data.id
}
```

- [ ] **Step 6: Run existing db tests to verify nothing broke**

```bash
npx vitest run src/__tests__/lib/db.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/__tests__/lib/storage.test.ts src/lib/db.ts
git commit -m "feat(storage): add uploadEventImage helper; allow pre-generated id in createEvent"
```

---

## Task 3: EventCard — Thumbnail Support

**Files:**
- Modify: `src/components/EventCard.tsx`
- Modify: `src/__tests__/components/EventCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/components/EventCard.test.tsx` (keep existing tests, add below the closing `}`):

```ts
const eventWithImage: TripEvent = {
  ...sharedEvent,
  image_url: 'https://cdn.example.com/img.jpg',
  link_url: 'https://example.com',
}

describe('EventCard with image', () => {
  it('shows thumbnail img when image_url is present', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={() => {}} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/img.jpg')
  })

  it('calls onImageClick when thumbnail is tapped', () => {
    const onImageClick = vi.fn()
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={onImageClick} />)
    fireEvent.click(screen.getByRole('img'))
    expect(onImageClick).toHaveBeenCalledWith(eventWithImage)
  })

  it('shows edit button when no image_url', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByLabelText('編輯行程')).toBeInTheDocument()
  })

  it('hides edit button when image_url is present', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={() => {}} />)
    expect(screen.queryByLabelText('編輯行程')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/components/EventCard.test.tsx
```

Expected: 4 new tests FAIL.

- [ ] **Step 3: Rewrite src/components/EventCard.tsx**

```tsx
import { useState } from 'react'
import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
  onImageClick?: (event: TripEvent) => void
}

export function EventCard({ event, onClick, onImageClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const showThumbnail = !!event.image_url && !imgError

  return (
    <div className="w-full bg-white rounded-[12px] px-4 py-3 border border-[#e8edf2] text-left">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#8fa0b0] mb-1">
            {event.time_start} – {event.time_end}
          </p>
          <p className="text-sm font-semibold text-[#1a2530] truncate">{event.title}</p>
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
          )}
          {event.notes && (
            <p className="text-[11px] text-[#6b8898] mt-2 pt-2 border-t border-[#f0f4f8] pl-2 border-l-2 border-l-[#b8d4e8] leading-relaxed whitespace-pre-line">
              {event.notes}
            </p>
          )}
        </div>

        {showThumbnail ? (
          <button
            onClick={() => onImageClick?.(event)}
            className="ml-2 shrink-0 w-14 h-14 rounded-[8px] overflow-hidden"
            aria-label="查看圖片"
          >
            <img
              src={event.image_url!}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </button>
        ) : (
          <button
            onClick={() => onClick(event)}
            className="ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[#b0c4d0] hover:bg-[#f0f4f8] hover:text-[#0077b6] active:opacity-70 transition-colors"
            aria-label="編輯行程"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run all EventCard tests**

```bash
npx vitest run src/__tests__/components/EventCard.test.tsx
```

Expected: all pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/EventCard.tsx src/__tests__/components/EventCard.test.tsx
git commit -m "feat(EventCard): show thumbnail when image_url present"
```

---

## Task 4: EventDetailSheet — New Component

**Files:**
- Create: `src/components/EventDetailSheet.tsx`
- Create: `src/__tests__/components/EventDetailSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/components/EventDetailSheet.test.tsx`:

```ts
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventDetailSheet } from '../../components/EventDetailSheet'
import type { TripEvent } from '../../types'

const event: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '首里城',
  time_start: '09:00',
  time_end: '11:00',
  location: '那霸市',
  notes: '',
  sort_order: 0,
  image_url: 'https://cdn.example.com/shurijo.jpg',
  link_url: 'https://oki-park.jp/shurijo/',
}

describe('EventDetailSheet', () => {
  it('renders nothing when open=false', () => {
    render(<EventDetailSheet open={false} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows image with correct src', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/shurijo.jpg')
  })

  it('shows event title and location', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('首里城')).toBeInTheDocument()
    expect(screen.getByText('那霸市')).toBeInTheDocument()
  })

  it('shows link button when link_url present', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('前往官網')).toBeInTheDocument()
  })

  it('hides link button when no link_url', () => {
    const noLink = { ...event, link_url: null }
    render(<EventDetailSheet open={true} event={noLink} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByText('前往官網')).toBeNull()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('編輯行程'))
    expect(onEdit).toHaveBeenCalledWith(event)
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet open={true} event={event} onClose={onClose} onEdit={() => {}} />)
    fireEvent.click(screen.getByTestId('detail-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/components/EventDetailSheet.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create src/components/EventDetailSheet.tsx**

```tsx
import type { TripEvent } from '../types'

interface Props {
  open: boolean
  event: TripEvent | null
  onClose: () => void
  onEdit: (event: TripEvent) => void
}

export function EventDetailSheet({ open, event, onClose, onEdit }: Props) {
  if (!open || !event) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="detail-backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] overflow-hidden max-h-[85vh] flex flex-col">
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mt-3 mb-0 shrink-0" />

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full object-cover"
            style={{ maxHeight: '220px' }}
          />
        )}

        <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-bold text-[#1a2530]">{event.title}</p>
            {event.location && (
              <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
            )}
          </div>

          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full bg-[#f0f4f8] text-[#0077b6] rounded-[10px] py-2.5 text-sm font-semibold"
            >
              前往官網
            </a>
          )}

          <button
            onClick={() => onEdit(event)}
            className="w-full border border-[#e8edf2] text-[#1a2530] rounded-[10px] py-2.5 text-sm font-semibold"
          >
            編輯行程
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/components/EventDetailSheet.test.tsx
```

Expected: all 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventDetailSheet.tsx src/__tests__/components/EventDetailSheet.test.tsx
git commit -m "feat(EventDetailSheet): new component for image preview and location link"
```

---

## Task 5: EventSheet — Image Picker + Link URL

**Files:**
- Modify: `src/components/EventSheet.tsx`
- Modify: `src/__tests__/components/EventSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Add the following describe block to `src/__tests__/components/EventSheet.test.tsx`:

```ts
vi.mock('../../lib/storage', () => ({
  uploadEventImage: vi.fn().mockResolvedValue('https://cdn.example.com/new.jpg'),
}))
```

Add this import at the top of the test file (alongside existing imports):

```ts
import { uploadEventImage } from '../../lib/storage'
```

Add these tests inside the existing `describe('EventSheet', ...)` block:

```ts
  it('shows image picker area', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('新增圖片')).toBeInTheDocument()
  })

  it('shows link URL input', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()
  })

  it('pre-fills link_url from existing event', () => {
    const eventWithLink = {
      ...sharedEvent,
      link_url: 'https://oki-park.jp',
    }
    render(
      <EventSheet open={true} event={eventWithLink} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByDisplayValue('https://oki-park.jp')).toBeInTheDocument()
  })

  it('shows existing image preview thumbnail', () => {
    const eventWithImage = {
      ...sharedEvent,
      image_url: 'https://cdn.example.com/existing.jpg',
    }
    render(
      <EventSheet open={true} event={eventWithImage} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/existing.jpg')
  })
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
npx vitest run src/__tests__/components/EventSheet.test.tsx
```

Expected: new tests FAIL.

- [ ] **Step 3: Rewrite src/components/EventSheet.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import type { TripEvent, ForkItem, TripMember } from '../types'
import { createEvent, updateEvent, deleteEvent, reorderEvents } from '../lib/db'
import { uploadEventImage } from '../lib/storage'

interface Props {
  open: boolean
  event: TripEvent | null
  dayId: string
  tripId: string
  events: TripEvent[]
  members?: TripMember[]
  onClose: () => void
}

const emptyFork = (): ForkItem => ({ person: '', title: '', location: '', notes: '' })

export function EventSheet({ open, event, dayId, tripId, events, members = [], onClose }: Props) {
  const isEdit = event !== null
  const [type, setType] = useState<'shared' | 'fork'>('shared')
  const [title, setTitle] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [forkA, setForkA] = useState<ForkItem>(emptyFork())
  const [forkB, setForkB] = useState<ForkItem>(emptyFork())
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setType(event?.type ?? 'shared')
    setTitle(event?.title ?? '')
    setTimeStart(event?.time_start ?? '')
    setTimeEnd(event?.time_end ?? '')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    setForkA(event?.fork_items?.[0] ?? emptyFork())
    setForkB(event?.fork_items?.[1] ?? emptyFork())
    setImageFile(null)
    setImageUrl(event?.image_url ?? null)
    setLinkUrl(event?.link_url ?? '')
  }, [event, open])

  if (!open) return null

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : imageUrl

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片不能超過 5MB')
      return
    }
    setImageFile(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setSaving(true)

    let resolvedImageUrl: string | null = imageUrl

    if (imageFile) {
      const uploadId = isEdit ? event.id : crypto.randomUUID()
      try {
        resolvedImageUrl = await uploadEventImage(tripId, uploadId, imageFile)
      } catch {
        alert('圖片上傳失敗，請重試')
        resolvedImageUrl = isEdit ? (event.image_url ?? null) : null
      }

      if (!isEdit) {
        const base = {
          id: uploadId,
          type,
          time_start: timeStart,
          time_end: timeEnd,
          sort_order: events.length,
        }
        const data: Omit<TripEvent, 'id'> & { id: string } = type === 'shared'
          ? { ...base, title, location, notes, image_url: resolvedImageUrl, link_url: linkUrl || null }
          : { ...base, title: '', location: '', notes: '', fork_items: [forkA, forkB], image_url: resolvedImageUrl, link_url: linkUrl || null }

        await createEvent(tripId, dayId, data)

        if (timeStart) {
          const allEvents: TripEvent[] = [...events, { ...data }]
          const sorted = [...allEvents].sort((a, b) => {
            const ta = a.time_start || '\xff'
            const tb = b.time_start || '\xff'
            return ta.localeCompare(tb)
          })
          await reorderEvents(tripId, dayId, sorted.map((e) => e.id))
        }

        setSaving(false)
        onClose()
        return
      }
    }

    const base = {
      type,
      time_start: timeStart,
      time_end: timeEnd,
      sort_order: isEdit ? event.sort_order : events.length,
    }
    const data: Omit<TripEvent, 'id'> = type === 'shared'
      ? { ...base, title, location, notes, image_url: resolvedImageUrl, link_url: linkUrl || null }
      : { ...base, title: '', location: '', notes: '', fork_items: [forkA, forkB], image_url: resolvedImageUrl, link_url: linkUrl || null }

    if (isEdit) {
      await updateEvent(tripId, dayId, event.id, data)
    } else {
      const newId = await createEvent(tripId, dayId, data)
      if (timeStart) {
        const allEvents: TripEvent[] = [...events, { ...data, id: newId }]
        const sorted = [...allEvents].sort((a, b) => {
          const ta = a.time_start || '\xff'
          const tb = b.time_start || '\xff'
          return ta.localeCompare(tb)
        })
        await reorderEvents(tripId, dayId, sorted.map((e) => e.id))
      }
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
                  {members.length > 0 ? (
                    <select
                      className={`${inputCls} !bg-white`}
                      value={item.person}
                      onChange={(e) => setItem({ ...item, person: e.target.value })}
                      aria-label={`人名 ${label}`}
                    >
                      <option value="">選擇成員</option>
                      {members.map((m) => (
                        <option key={m.email} value={m.display_name || m.email}>
                          {m.display_name || m.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={`${inputCls} !bg-white`}
                      placeholder={`人名 ${label}`}
                      value={item.person}
                      onChange={(e) => setItem({ ...item, person: e.target.value })}
                    />
                  )}
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

        {/* Image picker */}
        <div className="mb-3">
          <label className={labelCls}>圖片（選填）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewSrc ? (
            <div className="flex items-center gap-3">
              <img src={previewSrc} alt="" className="w-16 h-16 rounded-[8px] object-cover border border-[#e8edf2]" />
              <button
                onClick={handleRemoveImage}
                className="text-xs text-[#dc2626] font-semibold"
              >
                移除
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-[#b0c4d0] rounded-[8px] py-3 text-sm text-[#8fa0b0] flex items-center justify-center gap-1.5"
            >
              <span className="text-base">＋</span> 新增圖片
            </button>
          )}
        </div>

        {/* Link URL */}
        <div className="mb-4">
          <label className={labelCls}>景點連結（選填）</label>
          <input
            className={inputCls}
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>

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

- [ ] **Step 4: Run all EventSheet tests**

```bash
npx vitest run src/__tests__/components/EventSheet.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventSheet.tsx src/__tests__/components/EventSheet.test.tsx
git commit -m "feat(EventSheet): add image picker and location link URL fields"
```

---

## Task 6: DaySection — Wire EventDetailSheet

**Files:**
- Modify: `src/components/DaySection.tsx`

- [ ] **Step 1: Update SortableCard to accept and forward onImageClick**

Replace the `SortableCard` component in `src/components/DaySection.tsx`:

```tsx
function SortableCard({
  event,
  onEdit,
  onImageClick,
  dayDate,
}: {
  event: TripEvent
  onEdit: (e: TripEvent) => void
  onImageClick: (e: TripEvent) => void
  dayDate: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-date={dayDate}
      data-time-start={event.time_start}
    >
      {event.type === 'fork' ? (
        <ForkCard event={event} onClick={onEdit} />
      ) : (
        <EventCard event={event} onClick={onEdit} onImageClick={onImageClick} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add EventDetailSheet import and state to DaySection**

At the top of the file, add the import:

```tsx
import { EventDetailSheet } from './EventDetailSheet'
```

Inside `DaySection`, add new state after the existing `sheetOpen`/`selectedEvent` state:

```tsx
const [detailOpen, setDetailOpen] = useState(false)
const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)
```

Add a handler below `openEdit`:

```tsx
const openDetail = (e: TripEvent) => {
  setDetailEvent(e)
  setDetailOpen(true)
}

const handleDetailEdit = (e: TripEvent) => {
  setDetailOpen(false)
  setDetailEvent(null)
  setSelectedEvent(e)
  setSheetOpen(true)
}
```

- [ ] **Step 3: Pass onImageClick to SortableCard and add EventDetailSheet to JSX**

Replace the `<SortableCard ... />` line:

```tsx
<SortableCard key={event.id} event={event} onEdit={openEdit} onImageClick={openDetail} dayDate={day.date} />
```

Add `<EventDetailSheet>` after `<EventSheet>`:

```tsx
<EventDetailSheet
  open={detailOpen}
  event={detailEvent}
  onClose={() => { setDetailOpen(false); setDetailEvent(null) }}
  onEdit={handleDetailEdit}
/>
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/DaySection.tsx
git commit -m "feat(DaySection): wire EventDetailSheet for image tap flow"
```

---

## Task 7: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:4200`.

- [ ] **Step 2: Smoke test — create event with image**

1. Open an existing trip's timeline
2. Tap **＋** to create a new event
3. Fill in a title and time
4. Tap **新增圖片** → select a photo from your device
5. Fill in a URL in the **景點連結** field
6. Tap **儲存**
7. Verify: EventCard shows a thumbnail on the right; edit button is gone

- [ ] **Step 3: Smoke test — tap thumbnail**

1. Tap the thumbnail on the EventCard
2. Verify: EventDetailSheet slides up, shows full image, shows "前往官網" button, shows "編輯行程" button

- [ ] **Step 4: Smoke test — edit from detail sheet**

1. In EventDetailSheet, tap **編輯行程**
2. Verify: EventDetailSheet closes, EventSheet opens with all fields pre-filled including the image preview and link URL

- [ ] **Step 5: Smoke test — remove image**

1. Open EventSheet for the event from step 4
2. Tap **移除** next to the image preview
3. Tap **儲存**
4. Verify: EventCard no longer shows thumbnail; edit button returns
