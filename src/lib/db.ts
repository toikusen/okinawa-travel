import { supabase } from '../supabase'
import type { Trip, TripMember, Day, TripEvent } from '../types'

// --- Helpers ---

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

// --- Trip ---

export function subscribeToTrip(
  tripId: string,
  onTrip: (trip: Trip | null) => void
): () => void {
  const fetch = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_members(user_email, display_name, avatar_url)')
      .eq('id', tripId)
      .single()
    if (error || !data) { onTrip(null); return }
    onTrip({
      id: data.id,
      name: data.name,
      owner_email: data.owner_email ?? '',
      start_date: data.start_date,
      end_date: data.end_date,
      members: (data.trip_members as { user_email: string; display_name: string; avatar_url: string }[]).map(m => ({
        email: m.user_email,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
      })),
    })
  }
  fetch()

  const channel = supabase
    .channel(`trip-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, fetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` }, fetch)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function createTrip(
  name: string,
  ownerEmail: string,
  ownerDisplayName: string,
  ownerAvatarUrl: string,
  startDate: string,
  endDate: string
): Promise<string> {
  // Generate UUID client-side to avoid the RLS chicken-and-egg problem:
  // INSERT...RETURNING triggers trips_read policy before trip_members row exists.
  const tripId = crypto.randomUUID()

  const { error } = await supabase
    .from('trips')
    .insert({ id: tripId, name, start_date: startDate, end_date: endDate, owner_email: ownerEmail })
  if (error) throw new Error(error.message)

  await supabase.from('trip_members').insert({
    trip_id: tripId,
    user_email: ownerEmail,
    display_name: ownerDisplayName,
    avatar_url: ownerAvatarUrl,
  })

  const days = dateRange(startDate, endDate).map((date, i) => ({
    trip_id: tripId, date, label: '', sort_order: i,
  }))
  await supabase.from('days').insert(days)

  return tripId
}

export async function joinTrip(tripId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('join_trip_rpc', { p_trip_id: tripId })
  if (error) console.error('[joinTrip] rpc failed:', error)
  return !error && data === true
}

export async function updateMyDisplayName(email: string, name: string): Promise<boolean> {
  // Two writes: trip_members is what other members see; auth metadata seeds
  // display_name when creating/joining future trips.
  const { error: memberError } = await supabase.from('trip_members')
    .update({ display_name: name })
    .eq('user_email', email)
  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: name } })
  return !memberError && !authError
}

export async function removeMember(tripId: string, email: string): Promise<boolean> {
  const { error, count } = await supabase.from('trip_members')
    .delete({ count: 'exact' })
    .eq('trip_id', tripId)
    .eq('user_email', email)
  return !error && (count ?? 0) > 0
}

export type TripSummary = Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date' | 'owner_email'> & {
  members: TripMember[]
}

export async function listMyTrips(): Promise<TripSummary[]> {
  // RLS (trips_read) already restricts rows to trips the caller is a member of
  const { data, error } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, owner_email, trip_members(user_email, display_name, avatar_url)')
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    start_date: t.start_date as string,
    end_date: t.end_date as string,
    owner_email: (t.owner_email as string) ?? '',
    members: ((t.trip_members ?? []) as { user_email: string; display_name: string; avatar_url: string }[]).map(m => ({
      email: m.user_email,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
    })),
  }))
}

export interface TripPreview {
  name: string
  start_date: string
  end_date: string
  members: Pick<TripMember, 'display_name' | 'avatar_url'>[]
}

export async function getTripPreview(tripId: string): Promise<TripPreview | null> {
  const { data, error } = await supabase.rpc('trip_preview_rpc', { p_trip_id: tripId })
  if (error || !data) return null
  return data as TripPreview
}

export type WriteResult = { ok: boolean; error?: string }

export async function updateTrip(
  tripId: string,
  data: Partial<Pick<Trip, 'name' | 'start_date' | 'end_date'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('trips').update(data).eq('id', tripId)
  return error ? { ok: false, error: error.message } : { ok: true }
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

export async function updateTripDates(
  tripId: string,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; blockedDates?: string[]; error?: string }> {
  if (!startDate || !endDate || startDate > endDate) return { ok: false, error: 'INVALID_RANGE' }

  const { data: existing, error: fetchError } = await supabase
    .from('days').select('id, date').eq('trip_id', tripId)
  if (fetchError) return { ok: false, error: fetchError.message }
  const days = (existing ?? []) as { id: string; date: string }[]

  const wanted = dateRange(startDate, endDate)
  const wantedSet = new Set(wanted)
  const toRemove = days.filter(d => !wantedSet.has(d.date))

  if (toRemove.length) {
    const { data: evts, error: evtsError } = await supabase
      .from('events').select('day_id')
      .in('day_id', toRemove.map(d => d.id))
    if (evtsError) return { ok: false, error: evtsError.message }
    if (evts?.length) {
      const blockedIds = new Set((evts as { day_id: string }[]).map(e => e.day_id))
      return {
        ok: false,
        blockedDates: toRemove.filter(d => blockedIds.has(d.id)).map(d => d.date).sort(),
      }
    }
    const { error: deleteError } = await supabase.from('days').delete().in('id', toRemove.map(d => d.id))
    if (deleteError) return { ok: false, error: deleteError.message }
  }

  const existingSet = new Set(days.map(d => d.date))
  const toAdd = wanted.filter(date => !existingSet.has(date))
  if (toAdd.length) {
    const { error: insertError } = await supabase.from('days').insert(
      toAdd.map(date => ({ trip_id: tripId, date, label: '', sort_order: wanted.indexOf(date) }))
    )
    if (insertError) return { ok: false, error: insertError.message }
  }

  // Renumber kept days so sort_order follows date order
  const kept = days.filter(d => wantedSet.has(d.date))
  const renumberResults = await Promise.all(kept.map(d =>
    supabase.from('days').update({ sort_order: wanted.indexOf(d.date) }).eq('id', d.id)
  ))
  const renumberError = renumberResults.find(r => r.error)?.error
  if (renumberError) return { ok: false, error: renumberError.message }

  const { error: tripError } = await supabase
    .from('trips').update({ start_date: startDate, end_date: endDate }).eq('id', tripId)
  if (tripError) return { ok: false, error: tripError.message }
  return { ok: true }
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

export async function updateDayLabel(dayId: string, label: string): Promise<WriteResult> {
  const { error } = await supabase.from('days').update({ label }).eq('id', dayId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// --- Events ---

export function subscribeToEvents(
  _tripId: string,
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

export async function updateEvent(
  eventId: string,
  data: Partial<Omit<TripEvent, 'id'>>
): Promise<WriteResult> {
  const { error } = await supabase.from('events').update(data).eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteEvent(eventId: string): Promise<WriteResult> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function reorderEvents(_dayId: string, orderedIds: string[]): Promise<WriteResult> {
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('events').update({ sort_order: i }).eq('id', id)
    )
  )
  const failed = results.find(r => r.error)
  return failed?.error ? { ok: false, error: failed.error.message } : { ok: true }
}

// Re-export TripMember so callers don't need to import from types directly
export type { TripMember }
