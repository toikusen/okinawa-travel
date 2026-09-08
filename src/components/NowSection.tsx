import { useNow } from '../hooks/useNow'
import { pickNow, mapsUrl } from '../lib/dates'
import { EventCard } from './EventCard'
import type { Day, TripEvent } from '../types'

interface Props {
  days: Day[]
  eventsByDay: Record<string, TripEvent[]>
  onOpen: (event: TripEvent) => void
}

export function NowSection({ days, eventsByDay, onOpen }: Props) {
  const now = useNow()
  const { current, next, nextLabel } = pickNow({ days, eventsByDay, now })

  if (!current.length && !next.length) return null

  return (
    <section className="mb-6 flex flex-col gap-3" aria-label="現在">
      {current.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold text-[#dc2626] tracking-wide">現在進行中</p>
          {current.map(event => (
            <EventCard key={event.id} event={event} onClick={onOpen} />
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-[#52707f] tracking-wide">{nextLabel}</p>
          {next.map(event => (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(event)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(event) }
              }}
              className="bg-white rounded-[10px] border border-[#e8edf2] px-3 py-2 flex items-center gap-2 text-left active:opacity-70"
            >
              <span className="text-xs font-semibold text-[#52707f] shrink-0 w-11">{event.time_start}</span>
              <span className="text-sm text-[#1a2530] truncate flex-1">{event.title}</span>
              {event.location && (
                <a
                  href={mapsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${event.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-semibold text-[#0077b6] shrink-0"
                >
                  導航
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
