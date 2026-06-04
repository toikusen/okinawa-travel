# Event Images Design

**Date:** 2026-06-04  
**Status:** Approved

## Summary

Add image upload and location link to each trip event, making the timeline visually richer. Users can upload one cover photo per event and optionally attach a URL (e.g. official website). Tapping the thumbnail opens a detail sheet with the full image and a link button.

---

## Data Layer

### DB Migration (`007_event_images.sql`)

```sql
alter table events
  add column image_url text,
  add column link_url  text;
```

Both columns are optional (`null` by default). No RLS changes needed — existing `events_all` policy covers these columns.

### Supabase Storage

- **Bucket:** `event-images` (public read)
- **Upload path:** `{trip_id}/{event_id}.{ext}` — one file per event, new upload overwrites old
- **Storage policy:** only trip members (verified via `trip_members` table) can upload; public read

### `types.ts`

Add to `TripEvent`:

```ts
image_url?: string
link_url?: string
```

---

## Components

### `EventCard.tsx` (modified)

- If `image_url` exists: show 56×56px rounded thumbnail on the right, clickable (`onImageClick` callback); edit button is moved into `EventDetailSheet`
- If no `image_url`: show existing edit button as before
- On image load error: silently hide thumbnail, fall back to showing edit button

Layout (with image):
```
[time]
[title]           [thumbnail]
[location]
[notes]
```

Layout (without image):
```
[time]
[title]           [edit button]
[location]
[notes]
```

### `EventSheet.tsx` (modified)

Add two optional fields above the save button:

1. **Image picker**
   - Empty state: tap-to-upload area
   - Filled state: preview thumbnail + "移除" button
   - Local preview via `URL.createObjectURL` before upload
   - Accepts `image/*` only, max 5MB (enforced client-side)

2. **Link input**
   - Plain text input, placeholder `https://...`
   - Label: 景點連結（選填）

### `EventDetailSheet.tsx` (new)

Bottom sheet opened by tapping the thumbnail in EventCard:

```
[full-width image, ~200px tall]
[event title + location]
[「前往官網」button]   ← only shown when link_url exists
[「編輯行程」button]   ← opens EventSheet (replaces edit button removed from EventCard)
[close / drag to dismiss]
```

### `lib/storage.ts` (new)

```ts
uploadEventImage(tripId: string, eventId: string, file: File): Promise<string>
```

Uploads to `event-images/{tripId}/{eventId}.{ext}`, returns public URL.

---

## Data Flow

### Upload

**New event:**
1. On save: generate `id = crypto.randomUUID()` client-side
2. If image selected: `uploadEventImage(tripId, id, file)` → returns public URL
3. `createEvent(..., { id, image_url, link_url })` — uses the same pre-generated id

**Existing event:**
1. User picks image in EventSheet → local preview shown immediately
2. On save: `uploadEventImage(tripId, event.id, file)` → overwrites existing file at same path
3. `updateEvent` called with new `image_url` + `link_url`

Save button shows loading state throughout; disabled to prevent duplicate submissions.

### Remove image

- Tap "移除" → clears image from form state
- On save: `image_url` stored as `null`
- Storage file is **not** deleted (orphan cleanup deferred; volume is negligible)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Upload fails | Alert "圖片上傳失敗，請重試"；other fields still save normally |
| Image URL broken | Thumbnail silently hidden in EventCard |
| File > 5MB | File picker rejects before upload |
| Non-image file | File picker accepts `image/*` only |

---

## Out of Scope

- Multiple images per event
- Day-level or trip-level cover photos
- Server-side image resizing / CDN transforms
- Deleting orphaned Storage files on event delete
