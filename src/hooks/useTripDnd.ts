import { useEffect, useRef, useState } from 'react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { WISHLIST, moveEvent, reorderEvents } from '../lib/db'
import { applyMove, containerOf, sameOrder, type EventsByDay } from '../lib/dnd'
import { toast } from '../lib/toast'

/** `reorderEvents` keys on day_id, which is null for wishlist rows — so the
 *  wishlist takes drops but keeps server order. ponytail: nobody sorts a
 *  wish list; the day it lands on is the only order that matters. */
async function persist(
  tripId: string,
  eventId: string,
  from: string,
  to: string,
  byDay: EventsByDay
): Promise<boolean> {
  if (from === to) return (await reorderEvents(to, byDay[to].map((e) => e.id))).ok

  const moved = await moveEvent(tripId, eventId, to === WISHLIST ? null : to)
  if (!moved.ok) return false
  // moveEvent appends; a second write puts the card where it was dropped.
  // The gap it leaves behind in the source day is harmless — order is read
  // from sort_order, which only has to be increasing.
  if (to === WISHLIST) return true
  return (await reorderEvents(to, byDay[to].map((e) => e.id))).ok
}

/**
 * Trip-wide drag state: one DndContext for every day plus the wishlist, so a
 * card can be dragged between days instead of only within one.
 *
 * `incoming` is the server-derived map. It gets a new reference on any event
 * change anywhere in the trip, including the realtime push caused by this
 * drag's own write — `writingRef` keeps the optimistic order until the write
 * settles, or the list snaps back and then forward again.
 */
export function useTripDnd(incoming: EventsByDay, tripId: string) {
  const [pending, setPending] = useState<EventsByDay | null>(null)
  const writingRef = useRef(false)
  const incomingRef = useRef(incoming)
  const fromRef = useRef<string | null>(null)
  const byDay = pending ?? incoming

  useEffect(() => {
    incomingRef.current = incoming
    // Mid-drag (fromRef set) or mid-write: dropping the optimistic copy here
    // would yank the card back out from under the finger, or flicker the list
    // back and then forward again once our own write's push lands.
    if (writingRef.current || fromRef.current) return
    setPending(null)
  }, [incoming])

  const handleDragStart = ({ active }: DragStartEvent) => {
    fromRef.current = containerOf(byDay, String(active.id))
  }

  /** Cross-list preview only. Within one list dnd-kit already animates the
   *  gap, and re-keying the list mid-drag there would fight its transforms. */
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (containerOf(byDay, activeId) === containerOf(byDay, overId)) return
    const moved = applyMove(byDay, activeId, overId)
    if (moved) setPending(moved.byDay)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const from = fromRef.current
    fromRef.current = null
    if (!over || !from) return

    const activeId = String(active.id)
    const moved = applyMove(byDay, activeId, String(over.id))
    const next = moved?.byDay ?? byDay
    const to = containerOf(next, activeId)
    // Nothing moved: same list, same slot.
    if (!to || (to === from && !moved)) return
    // Sorting inside the wishlist has nowhere to be saved (see persist), so
    // showing a new order would be a promise we cannot keep.
    if (to === from && to === WISHLIST) return

    setPending(next)
    writingRef.current = true
    try {
      if (!(await persist(tripId, activeId, from, to, next))) {
        setPending(null)
        toast('排序沒有存成功,已還原')
        return
      }
      if (sameOrder(incomingRef.current, next)) setPending(null)
    } finally {
      writingRef.current = false
    }
  }

  return { byDay, handleDragStart, handleDragOver, handleDragEnd }
}
