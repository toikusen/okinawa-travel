import type { TripEvent } from '../types'
import { BottomSheet } from './BottomSheet'

interface Props {
  open: boolean
  event: TripEvent | null
  onClose: () => void
  onEdit: (event: TripEvent) => void
}

export function EventDetailSheet({ open, event, onClose, onEdit }: Props) {
  if (!open || !event) return null

  const isFork = event.type === 'fork'

  return (
    <BottomSheet
      label="行程詳情"
      onClose={onClose}
      backdropTestId="detail-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] overflow-hidden max-h-[85vh] flex flex-col"
    >
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mt-3 mb-0 shrink-0" />

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full object-cover"
            style={{ maxHeight: '220px' }}
          />
        )}

        <div className="px-4 pt-3 pb-6 flex flex-col gap-3 overflow-y-auto">
          <div>
            {(event.time_start || event.time_end) && (
              <p className="text-xs text-[#52707f] mb-1">
                {event.time_start} – {event.time_end}
              </p>
            )}
            <p className="text-[15px] font-bold text-[#1a2530]">
              {isFork ? '分頭行動' : event.title}
            </p>
            {event.location && (
              <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
            )}
          </div>

          {isFork && (
            <div className="flex flex-col gap-2">
              {(event.fork_items ?? []).map((item, i) => (
                <div key={i} className="bg-[#f8f9fa] border border-[#e8edf2] rounded-[8px] p-3">
                  <p className="text-[11px] font-bold text-[#0077b6] mb-1">{item.person}</p>
                  <p className="text-sm font-semibold text-[#1a2530]">{item.title}</p>
                  {item.location && (
                    <p className="text-xs text-[#5a7a8a] mt-0.5">{item.location}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-[#52707f] mt-1 whitespace-pre-line">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {event.notes && (
            <p className="text-xs text-[#52707f] leading-relaxed whitespace-pre-line bg-[#f8f9fa] rounded-[8px] p-3">
              {event.notes}
            </p>
          )}

          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full bg-[#f0f4f8] text-[#0077b6] rounded-[10px] py-2.5 text-sm font-semibold"
            >
              前往官網
            </a>
          )}

          <button
            onClick={() => onEdit(event)}
            className="w-full border border-[#e8edf2] text-[#1a2530] rounded-[10px] py-2.5 text-sm font-semibold"
          >
            編輯行程
          </button>
        </div>
    </BottomSheet>
  )
}
