import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { createTrip } from '../lib/db'
import { SyncIndicator } from '../components/SyncIndicator'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tripId, setTripId] = useState<string | null>(() => localStorage.getItem(TRIP_ID_KEY))
  const { trip, days, loading } = useTrip(tripId)
  const syncStatus = useSyncStatus()

  const [tripName, setTripName] = useState('沖繩旅遊')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateTrip = async () => {
    if (!user?.email || !startDate || !endDate) return
    setCreating(true)
    const id = await createTrip(tripName, user.email, startDate, endDate)
    localStorage.setItem(TRIP_ID_KEY, id)
    setTripId(id)
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <p className="text-sm text-[#8fa0b0]">載入中...</p>
      </div>
    )
  }

  if (!tripId || !trip) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-4xl">🌺</div>
        <h2 className="text-lg font-bold text-[#1a2530]">建立你的旅程</h2>
        <div className="w-full max-w-sm flex flex-col gap-3">
          <input
            className="border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
            placeholder="旅程名稱"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[10px] px-3 py-2.5 text-sm bg-white text-[#1a2530]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreateTrip}
            disabled={creating || !startDate || !endDate}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? '建立中...' : '建立旅程'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-[#1a2530]">{trip.name}</h1>
        <div className="flex items-center gap-3">
          <SyncIndicator status={syncStatus} />
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection key={day.id} day={day} tripId={trip.id} />
          ))}
        </div>
      </main>

      <nav className="bg-white border-t border-[#e8edf2] flex sticky bottom-0">
        <button className="flex-1 py-3 flex flex-col items-center gap-0.5">
          <span className="text-xl">🗓</span>
          <span className="text-[10px] font-semibold text-[#0077b6]">行程</span>
        </button>
        <button
          className="flex-1 py-3 flex flex-col items-center gap-0.5"
          onClick={() => navigate('/settings')}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] text-[#8fa0b0]">設定</span>
        </button>
      </nav>

      <InstallPrompt />
    </div>
  )
}
