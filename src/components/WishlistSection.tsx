import { useState } from 'react'
import { EventCard } from './EventCard'
import { ForkCard } from './ForkCard'
import { EventSheet } from './EventSheet'
import type { Day, TripEvent, TripMember } from '../types'

interface Props {
  tripId: string
  days: Day[]
  members: TripMember[]
  events: TripEvent[]
}

/**
 * Places collected before they have a date. Same event rows as the timeline,
 * just with no day attached (migration 013) — so a card is scheduled by
 * picking a date in the edit sheet, and unscheduled the same way.
 *
 * ponytail: a native <details>, closed by default. Drag-into-a-day would be
 * nicer but needs cross-container dnd; the date picker already does the job.
 */
export function WishlistSection({ tripId, days, members, events }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<TripEvent | null>(null)

  const open = (event: TripEvent | null) => {
    setSelected(event)
    setSheetOpen(true)
  }

  return (
    <details className="mt-6 bg-white border border-border rounded-[12px] px-4 py-3">
      <summary className="text-[13px] font-extrabold text-text-strong cursor-pointer marker:text-text-label">
        想去清單
        {events.length > 0 && (
          <span className="ml-1.5 text-xs font-semibold text-text-label">{events.length}</span>
        )}
      </summary>

      <div className="flex flex-col gap-2 mt-3">
        {events.map((event) =>
          event.type === 'fork' ? (
            <ForkCard key={event.id} event={event} onClick={open} />
          ) : (
            <EventCard key={event.id} event={event} onClick={open} />
          )
        )}

        {events.length === 0 && (
          <p className="text-xs text-text-label">還沒排進哪一天的地方,先丟這裡。</p>
        )}

        <button
          onClick={() => open(null)}
          className="w-full border border-dashed border-icon-muted rounded-[8px] py-2.5 text-xs font-semibold text-primary"
        >
          ＋ 新增想去的地方
        </button>
      </div>

      <EventSheet
        open={sheetOpen}
        event={selected}
        dayId={null}
        tripId={tripId}
        events={events}
        members={members}
        days={days}
        onClose={() => setSheetOpen(false)}
      />
    </details>
  )
}
