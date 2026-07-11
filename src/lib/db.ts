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

export async function joinTrip(
  tripId: string,
  _email: string,
  _displayName: string,
  _avatarUrl: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('join_trip_rpc', { p_trip_id: tripId })
  if (error) console.error('[joinTrip] rpc failed:', error)
  return !error && data === true
}

export async function removeMember(tripId: string, email: string): Promise<void> {
  await supabase.from('trip_members').delete()
    .eq('trip_id', tripId)
    .eq('user_email', email)
}

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
  _tripId: string,
  dayId: string,
  label: string
): Promise<void> {
  await supabase.from('days').update({ label }).eq('id', dayId)
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

// Re-export TripMember so callers don't need to import from types directly
export type { TripMember }
