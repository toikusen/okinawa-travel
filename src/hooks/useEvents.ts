import { useState, useEffect } from 'react'
import { subscribeToEvents } from '../lib/db'
import type { TripEvent } from '../types'

const EVENTS_CACHE = (tripId: string, dayId: string) => `sb_events_${tripId}_${dayId}`

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function useEvents(tripId: string | null, dayId: string) {
  const [events, setEvents] = useState<TripEvent[]>(
    () => (tripId ? (readCache<TripEvent[]>(EVENTS_CACHE(tripId, dayId)) ?? []) : [])
  )

  useEffect(() => {
    if (!tripId) return
    return subscribeToEvents(tripId, dayId, (e) => {
      setEvents(e)
      localStorage.setItem(EVENTS_CACHE(tripId, dayId), JSON.stringify(e))
    })
  }, [tripId, dayId])

  return events
}
