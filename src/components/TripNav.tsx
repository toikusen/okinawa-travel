import { useNavigate } from 'react-router-dom'

interface Props {
  tripId: string
  active: 'timeline' | 'members' | 'settings'
}

const TABS = [
  {
    key: 'timeline' as const,
    label: '行程',
    path: (id: string) => `/trips/${id}`,
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
  {
    key: 'members' as const,
    label: '旅伴',
    path: (id: string) => `/trips/${id}/members`,
    icon: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M15.5 14.5c2.8.4 5 2.7 5 5.5" />
      </>
    ),
  },
  {
    key: 'settings' as const,
    label: '設定',
    path: (id: string) => `/trips/${id}/settings`,
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
]

export function TripNav({ tripId, active }: Props) {
  const navigate = useNavigate()

  return (
    <nav className="bg-white border-t border-[#e8edf2] flex sticky bottom-0 z-10">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        const color = isActive ? '#0077b6' : '#8fa0b0'
        return (
          <button
            key={tab.key}
            onClick={() => !isActive && navigate(tab.path(tripId))}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className={`text-[10px] ${isActive ? 'font-bold text-[#0077b6]' : 'text-[#52707f]'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
