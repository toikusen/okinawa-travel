import { useState, useEffect } from 'react'
import { subscribeToTrip, subscribeToDays } from '../lib/firestore'
import type { Trip, Day } from '../types'

export function useTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) { setLoading(false); return }

    const tripUnsub = subscribeToTrip(tripId, (t) => {
      setTrip(t)
      setLoading(false)
    })
    const daysUnsub = subscribeToDays(tripId, setDays)

    return () => {
      tripUnsub()
      daysUnsub()
    }
  }, [tripId])

  return { trip, days, loading }
}
