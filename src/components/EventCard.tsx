import { useState } from 'react'
import type { TripEvent } from '../types'
import { mapsUrl } from '../lib/dates'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function EventCard({ event, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const showThumbnail = !!event.image_url && !imgError

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(event)
        }
      }}
      className="w-full bg-white rounded-[12px] py-3 pl-8 pr-3 border border-[#e8edf2] text-left active:opacity-70 transition-opacity"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          {(event.time_start || event.time_end) && (
            <p className="text-xs text-[#52707f] mb-1">
              {event.time_start && event.time_end
                ? `${event.time_start} – ${event.time_end}`
                : event.time_start || event.time_end}
            </p>
          )}
          <p className="text-sm font-semibold text-[#1a2530] truncate">{event.title}</p>
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{event.location}</span>
              <a
                href={mapsUrl(event.location)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`導航到 ${event.location}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[#0077b6] font-semibold"
              >
                導航
              </a>
            </p>
          )}
          {event.notes && (
            <p className="text-[11px] text-[#52707f] mt-2 pt-2 border-t border-[#f0f4f8] pl-2 border-l-2 border-l-[#b8d4e8] leading-relaxed whitespace-pre-line">
              {event.notes}
            </p>
          )}
        </div>

        {showThumbnail ? (
          <img
            src={event.image_url!}
            alt={event.title}
            className="ml-2 shrink-0 w-14 h-14 rounded-[8px] object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="ml-2 mt-4 shrink-0 text-[#b0c4d0]" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}
