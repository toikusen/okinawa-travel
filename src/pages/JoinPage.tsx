import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { joinTrip } from '../lib/firestore'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function JoinPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'joining' | 'error'>('joining')

  useEffect(() => {
    if (!tripId || !user?.email) return

    joinTrip(tripId, user.email).then((success) => {
      if (success) {
        localStorage.setItem(TRIP_ID_KEY, tripId)
        navigate('/', { replace: true })
      } else {
        setStatus('error')
      }
    })
  }, [tripId, user, navigate])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-[#1a2530]">請先登入以加入旅程</p>
        <button
          onClick={signIn}
          className="bg-[#0077b6] text-white rounded-[10px] py-3 px-8 text-sm font-semibold"
        >
          Google 帳號登入
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center px-6">
        <p className="text-sm text-[#dc2626]">旅程不存在或連結已失效。</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
      <p className="text-sm text-[#8fa0b0]">加入旅程中...</p>
    </div>
  )
}
