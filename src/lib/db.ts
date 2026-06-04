import { supabase } from '../supabase'
import type { Trip, TripMember, Day, TripEvent } from '../types'

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
    days.push({ trip_id: tripId, date: `${y}-${mo}-${d}`, label: '', sort_order: sortOrder++ })
    current.setDate(current.getDate() + 1)
  }
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
