import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createTrip } from '../lib/db'

export function NewTripPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateTrip = async () => {
    if (!user?.email || !tripName.trim() || !startDate || !endDate || startDate > endDate) return
    setCreating(true)
    try {
      const displayName = (user.user_metadata?.full_name as string) ?? user.email ?? ''
      const avatarUrl = (user.user_metadata?.avatar_url as string) ?? ''
      const id = await createTrip(tripName.trim(), user.email, displayName, avatarUrl, startDate, endDate)
      navigate(`/trips/${id}`, { replace: true })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => navigate('/')} className="text-[#0077b6] text-sm">← 返回</button>
        <h1 className="text-base font-bold text-[#1a2530]">新增旅程</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-4xl">🌺</div>
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
            disabled={creating || !tripName.trim() || !startDate || !endDate || startDate > endDate}
            className="bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? '建立中...' : '建立旅程'}
          </button>
        </div>
      </main>
    </div>
  )
}
