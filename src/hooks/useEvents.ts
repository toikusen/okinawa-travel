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
