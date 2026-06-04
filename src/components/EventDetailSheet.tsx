import type { TripEvent } from '../types'

interface Props {
  open: boolean
  event: TripEvent | null
  onClose: () => void
  onEdit: (event: TripEvent) => void
}

export function EventDetailSheet({ open, event, onClose, onEdit }: Props) {
  if (!open || !event) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="detail-backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] overflow-hidden max-h-[85vh] flex flex-col">
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mt-3 mb-0 shrink-0" />

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full object-cover"
            style={{ maxHeight: '220px' }}
          />
        )}

        <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-bold text-[#1a2530]">{event.title}</p>
            {event.location && (
              <p className="text-xs text-[#5a7a8a] mt-0.5">{event.location}</p>
            )}
          </div>

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
      </div>
    </div>
  )
}
