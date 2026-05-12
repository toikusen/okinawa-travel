import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function EventCard({ event, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(event)}
      className="w-full bg-white rounded-[12px] px-4 py-3 border border-[#e8edf2] text-left active:opacity-70 transition-opacity"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#8fa0b0] mb-1">
            {event.time_start} – {event.time_end}
          </p>
          <p className="text-sm font-semibold text-[#1a2530] truncate">{event.title}</p>
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
          )}
        </div>
        <span className="text-[#e8edf2] text-lg ml-2 shrink-0">›</span>
      </div>
    </button>
  )
}
