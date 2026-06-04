import { useState } from 'react'
import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
  onImageClick?: (event: TripEvent) => void
}

export function EventCard({ event, onClick, onImageClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const showThumbnail = !!event.image_url && !imgError

  return (
    <div className="w-full bg-white rounded-[12px] px-4 py-3 border border-[#e8edf2] text-left">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#8fa0b0] mb-1">
            {event.time_start} – {event.time_end}
          </p>
          <p className="text-sm font-semibold text-[#1a2530] truncate">{event.title}</p>
          {event.location && (
            <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
          )}
          {event.notes && (
            <p className="text-[11px] text-[#6b8898] mt-2 pt-2 border-t border-[#f0f4f8] pl-2 border-l-2 border-l-[#b8d4e8] leading-relaxed whitespace-pre-line">
              {event.notes}
            </p>
          )}
        </div>

        {showThumbnail ? (
          <button
            onClick={() => onImageClick?.(event)}
            className="ml-2 shrink-0 w-14 h-14 rounded-[8px] overflow-hidden"
            aria-label="查看圖片"
          >
            <img
              src={event.image_url!}
              alt={event.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </button>
        ) : (
          <button
            onClick={() => onClick(event)}
            className="ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[#b0c4d0] hover:bg-[#f0f4f8] hover:text-[#0077b6] active:opacity-70 transition-colors"
            aria-label="編輯行程"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
