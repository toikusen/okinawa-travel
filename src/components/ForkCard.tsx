import type { TripEvent, ForkItem } from '../types'
import { mapsUrl } from '../lib/dates'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

const GROUP_STYLES = [
  'bg-[#f0f7ff] border-[#cce4f6]',
  'bg-[#f8f9fa] border-[#e8edf2]',
  'bg-[#f4f9f4] border-[#d4e8d4]',
  'bg-[#fdf6ef] border-[#f0dcc4]',
]
const NAME_COLORS = ['text-[#0077b6]', 'text-[#5a7a8a]', 'text-[#5b8a72]', 'text-[#b45309]']

export function ForkCard({ event, onClick }: Props) {
  const items: ForkItem[] = event.fork_items ?? []

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
      className="w-full bg-white rounded-[12px] border border-[#e8edf2] border-l-[3px] border-l-[#0077b6] text-left active:opacity-70 transition-opacity overflow-hidden"
    >
      <div className="pl-8 pr-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-[#0077b6] tracking-wide">
          分頭行動 · {event.time_start}–{event.time_end}
        </p>
      </div>
      <div className={`gap-2 pl-8 pr-3 pb-3 ${items.length > 2 ? 'flex flex-col' : 'flex'}`}>
        {items.map((item, i) => (
          <div key={i} className={`flex-1 border rounded-[8px] p-2 ${GROUP_STYLES[i % GROUP_STYLES.length]}`}>
            <p className={`text-[10px] font-bold mb-1 ${NAME_COLORS[i % NAME_COLORS.length]}`}>{item.person}</p>
            <p className="text-xs font-semibold text-[#1a2530]">{item.title}</p>
            {item.location && (
              <p className="text-[10px] text-[#5a7a8a] mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{item.location}</span>
                <a
                  href={mapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${item.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#0077b6] font-semibold"
                >
                  導航
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
