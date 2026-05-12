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
