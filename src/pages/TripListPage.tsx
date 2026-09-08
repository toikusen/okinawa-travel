import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listMyTrips, type TripSummary } from '../lib/db'
import { fmtRange, dayCount, tripStatus, daysUntil, sortTrips } from '../lib/dates'
import { AvatarStack } from '../components/AvatarStack'
import { AccountSheet } from '../components/AccountSheet'
import { InstallPrompt } from '../components/InstallPrompt'
import { Logo } from '../components/Logo'

const TRIPS_CACHE = 'sb_trips_list'

function readTripsCache(): TripSummary[] | null {
  try {
    const raw = localStorage.getItem(TRIPS_CACHE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TripSummary[]
    // Older cache entries lack the members field
    return parsed.map(t => ({ ...t, members: t.members ?? [] }))
  } catch {
    return null
  }
}

function TripCard({ trip, onClick }: { trip: TripSummary; onClick: () => void }) {
  const status = tripStatus(trip.start_date, trip.end_date)
  const ended = status === 'ended'

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-[12px] p-4 border border-[#e8edf2] text-left active:opacity-70 flex items-center gap-3 ${ended ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[#1a2530] truncate">{trip.name}</p>
          {status === 'upcoming' && (
            <span className="shrink-0 text-[10px] font-bold text-[#0077b6] bg-[#e3f1f9] rounded-full px-2 py-0.5">
              D-{daysUntil(trip.start_date)}
            </span>
          )}
          {status === 'ongoing' && (
            <span className="shrink-0 text-[10px] font-bold text-[#15803d] bg-[#dcfce7] rounded-full px-2 py-0.5">
              進行中
            </span>
          )}
        </div>
        <p className="text-xs text-[#52707f] mt-1">
          {fmtRange(trip.start_date, trip.end_date)} · {dayCount(trip.start_date, trip.end_date)} 天
        </p>
        {!ended && trip.members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AvatarStack members={trip.members} />
            <span className="text-[11px] text-[#52707f]">{trip.members.length} 位旅伴</span>
          </div>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0c4d0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

export function TripListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripSummary[] | null>(readTripsCache)
  const [loadError, setLoadError] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    listMyTrips()
      .then((t) => {
        setTrips(t)
        localStorage.setItem(TRIPS_CACHE, JSON.stringify(t))
      })
      .catch(() => {
        setLoadError(true)
        setTrips(prev => prev ?? [])
      })
  }, [])

  const { ongoing, upcoming, ended } = sortTrips(trips ?? [])
  const active = [...ongoing, ...upcoming]

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-base font-bold text-[#1a2530]">Tabi</span>
        </div>
        <button onClick={() => setAccountOpen(true)} aria-label="帳號設定" className="w-11 h-11 -my-1.5 -mr-2 flex items-center justify-center active:opacity-70">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-[#e3f1f9] text-[#0077b6] text-xs font-bold flex items-center justify-center">
              {(user?.user_metadata?.full_name as string || user?.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 flex flex-col gap-3">
        <h1 className="text-sm font-bold text-[#1a2530]">我的旅程</h1>
        {trips === null && <p className="text-sm text-[#52707f] text-center py-8">載入中...</p>}

        {loadError && (
          <p className="text-xs text-[#dc2626] text-center">無法載入旅程列表,請檢查網路連線</p>
        )}

        {trips?.length === 0 && !loadError && (
          <div className="flex flex-col items-center gap-2 py-12">
            <Logo size={44} />
            <p className="text-sm text-[#52707f]">還沒有旅程,建立第一個吧!</p>
          </div>
        )}

        {active.map((trip) => (
          <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
        ))}

        {ended.length > 0 && (
          <p className="text-[11px] font-bold text-[#52707f] tracking-wide mt-2">已結束</p>
        )}
        {ended.map((trip) => (
          <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
        ))}
      </main>

      {trips !== null && (
        <button
          onClick={() => navigate('/trips/new')}
          aria-label="新增旅程"
          className="fixed bottom-5 right-[max(1.25rem,calc(50vw-16rem+1.25rem))] w-[52px] h-[52px] rounded-full bg-[#0077b6] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,119,182,0.4)] active:opacity-80 z-20"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}

      <InstallPrompt />
    </div>
  )
}
