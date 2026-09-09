import { useState, useEffect } from 'react'
import { subscribeToTripData } from '../lib/db'
import type { Trip, Day, TripEvent } from '../types'

const TRIP_CACHE = (id: string) => `sb_trip_${id}`
const DAYS_CACHE = (id: string) => `sb_days_${id}`
const EVENTS_CACHE = (id: string) => `sb_events_${id}`

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function useTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(
    () => (tripId ? readCache<Trip>(TRIP_CACHE(tripId)) : null)
  )
  const [days, setDays] = useState<Day[]>(
    () => (tripId ? (readCache<Day[]>(DAYS_CACHE(tripId)) ?? []) : [])
  )
  const [eventsByDay, setEventsByDay] = useState<Record<string, TripEvent[]>>(
    () => (tripId ? (readCache<Record<string, TripEvent[]>>(EVENTS_CACHE(tripId)) ?? {}) : {})
  )
  const [loading, setLoading] = useState<boolean>(
    () => !tripId ? false : !readCache(TRIP_CACHE(tripId ?? ''))
  )

  useEffect(() => {
    if (!tripId) { setLoading(false); return }

    return subscribeToTripData(tripId, {
      onTrip: (t) => {
        setTrip(t)
        setLoading(false)
        if (t) localStorage.setItem(TRIP_CACHE(tripId), JSON.stringify(t))
      },
      onDays: (d) => {
        setDays(d)
        localStorage.setItem(DAYS_CACHE(tripId), JSON.stringify(d))
      },
      onEvents: (e) => {
        setEventsByDay(e)
        localStorage.setItem(EVENTS_CACHE(tripId), JSON.stringify(e))
      },
    })
  }, [tripId])

  return { trip, days, eventsByDay, loading }
}
