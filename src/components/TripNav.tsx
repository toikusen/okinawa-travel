interface Props {
  onToday: () => void
  onTop: () => void
  active: 'today' | 'itinerary'
  todayDisabled?: boolean
}

const TABS = [
  {
    key: 'today' as const,
    label: '今天',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    key: 'itinerary' as const,
    label: '行程',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
]

export function TripNav({ onToday, onTop, active, todayDisabled }: Props) {
  return (
    <nav className="bg-white border-t border-border flex sticky bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        const color = isActive ? 'var(--color-primary)' : 'var(--color-muted)'
        return (
          <button
            key={tab.key}
            onClick={tab.key === 'today' ? onToday : onTop}
            disabled={tab.key === 'today' && todayDisabled}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className={`text-[10px] ${isActive ? 'font-bold text-primary' : 'text-text-label'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
