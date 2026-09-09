import { useNow } from '../hooks/useNow'
import { pickNow, mapsUrl } from '../lib/dates'
import { Icon } from './Icon'
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
          <p className="text-[11px] font-bold text-danger tracking-wide">現在進行中</p>
          {current.map(event => (
            <EventCard key={event.id} event={event} onClick={onOpen} />
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-text-label tracking-wide">{nextLabel}</p>
          {next.map(event => (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(event)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(event) }
              }}
              className="bg-white rounded-[10px] shadow-card px-3 py-2 flex items-center gap-2 text-left active:opacity-70"
            >
              <span className="text-xs font-mono tabular-nums text-text-label shrink-0 w-11">{event.time_start}</span>
              <span className="text-sm text-text-strong truncate flex-1">{event.title}</span>
              {event.location && (
                <a
                  href={mapsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${event.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 -my-1.5 -ml-1 w-6 h-6 flex items-center justify-center text-primary"
                >
                  <Icon name="navigation" size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
