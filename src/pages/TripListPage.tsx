import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listMyTrips, type TripSummary } from '../lib/db'
import { InstallPrompt } from '../components/InstallPrompt'

const TRIPS_CACHE = 'sb_trips_list'

function readTripsCache(): TripSummary[] | null {
  try {
    const raw = localStorage.getItem(TRIPS_CACHE)
    return raw ? (JSON.parse(raw) as TripSummary[]) : null
  } catch {
    return null
  }
}

export function TripListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripSummary[] | null>(readTripsCache)
  const [loadError, setLoadError] = useState(false)

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

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-[#1a2530]">我的旅程</h1>
        {user?.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
        )}
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {trips === null && <p className="text-sm text-[#8fa0b0] text-center py-8">載入中...</p>}

        {loadError && (
          <p className="text-xs text-[#dc2626] text-center">無法載入旅程列表,請檢查網路連線</p>
        )}

        {trips?.length === 0 && !loadError && (
          <div className="flex flex-col items-center gap-2 py-12">
            <div className="text-4xl">🌺</div>
            <p className="text-sm text-[#8fa0b0]">還沒有旅程,建立第一個吧!</p>
          </div>
        )}

        {trips?.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trips/${trip.id}`)}
            className="bg-white rounded-[12px] p-4 border border-[#e8edf2] text-left active:opacity-70"
          >
            <p className="text-sm font-bold text-[#1a2530]">{trip.name}</p>
            <p className="text-xs text-[#8fa0b0] mt-1">{trip.start_date} ~ {trip.end_date}</p>
          </button>
        ))}

        {trips !== null && (
          <button
            onClick={() => navigate('/trips/new')}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold active:opacity-80"
          >
            + 新增旅程
          </button>
        )}
      </main>

      <InstallPrompt />
    </div>
  )
}
