import type { TripEvent } from '../types'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

export function ForkCard({ event, onClick }: Props) {
  const [left, right] = event.fork_items ?? [
    { person: '', title: '', location: '', notes: '' },
    { person: '', title: '', location: '', notes: '' },
  ]

  return (
    <button
      onClick={() => onClick(event)}
      className="w-full bg-white rounded-[12px] border border-[#e8edf2] border-l-[3px] border-l-[#0077b6] text-left active:opacity-70 transition-opacity overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-[#0077b6] tracking-wide">
          ↕ 分岔行程 · {event.time_start}–{event.time_end}
        </p>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <div className="flex-1 bg-[#f0f7ff] border border-[#cce4f6] rounded-[8px] p-2">
          <p className="text-[10px] font-bold text-[#0077b6] mb-1">{left.person}</p>
          <p className="text-xs font-semibold text-[#1a2530]">{left.title}</p>
          {left.location && (
            <p className="text-[10px] text-[#5a7a8a] mt-0.5">{left.location}</p>
          )}
        </div>
        <div className="flex-1 bg-[#f8f9fa] border border-[#e8edf2] rounded-[8px] p-2">
          <p className="text-[10px] font-bold text-[#5a7a8a] mb-1">{right.person}</p>
          <p className="text-xs font-semibold text-[#1a2530]">{right.title}</p>
          {right.location && (
            <p className="text-[10px] text-[#5a7a8a] mt-0.5">{right.location}</p>
          )}
        </div>
      </div>
    </button>
  )
}
