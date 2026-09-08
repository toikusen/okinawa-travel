import type { TripEvent, ForkItem } from '../types'
import { mapsUrl } from '../lib/dates'

interface Props {
  event: TripEvent
  onClick: (event: TripEvent) => void
}

const GROUP_STYLES = [
  'bg-fork-bg-1 border-fork-border-1 border-l-fork-border-1',
  'bg-surface-subtle border-border border-l-border',
  'bg-fork-bg-3 border-fork-border-3 border-l-fork-border-3',
  'bg-fork-bg-4 border-fork-border-4 border-l-fork-border-4',
]
const NAME_COLORS = ['text-primary', 'text-text-secondary', 'text-identity-2', 'text-identity-5']

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
      className="w-full bg-white rounded-[12px] border border-border border-l-[3px] border-l-primary text-left active:opacity-70 transition-opacity overflow-hidden"
    >
      <div className="pl-8 pr-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-primary tracking-wide">
          分頭行動
          {(event.time_start || event.time_end) && (
            <>
              {' · '}
              {event.time_start && event.time_end
                ? `${event.time_start}–${event.time_end}`
                : event.time_start || event.time_end}
            </>
          )}
        </p>
      </div>
      <div data-testid="fork-groups" className="flex flex-col gap-2 pl-8 pr-3 pb-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`border-l-[3px] border rounded-[8px] p-2 ${GROUP_STYLES[i % GROUP_STYLES.length]}`}
          >
            <span className={`inline-block text-[10px] font-bold mb-1 ${NAME_COLORS[i % NAME_COLORS.length]}`}>
              {item.person}
            </span>
            <p className="text-xs font-semibold text-text-strong">{item.title}</p>
            {item.location && (
              <p className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{item.location}</span>
                <a
                  href={mapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`導航到 ${item.location}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary font-semibold"
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
