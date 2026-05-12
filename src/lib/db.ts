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
