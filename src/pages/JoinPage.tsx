import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { joinTrip } from '../lib/db'
import { supabase } from '../supabase'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function JoinPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'joining' | 'error'>('joining')

  useEffect(() => {
    if (!tripId || !user?.email) return
    const tid = tripId

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[JoinPage] session check:', {
        hasSession: !!session,
        sessionEmail: session?.user?.email,
        reactUserEmail: user.email,
        hasAccessToken: !!session?.access_token,
        tokenExpiry: session?.expires_at,
        role: session?.user?.role,
      })

      const displayName = (user.user_metadata?.full_name as string) ?? user.email ?? ''
      const avatarUrl = (user.user_metadata?.avatar_url as string) ?? ''
      joinTrip(tid, user.email, displayName, avatarUrl).then((success) => {
        if (success) {
          localStorage.setItem(TRIP_ID_KEY, tid)
          navigate('/', { replace: true })
        } else {
          setStatus('error')
        }
      })
    })
  }, [tripId, user, navigate])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-[#1a2530]">請先登入以加入旅程</p>
        <button
          onClick={() => {
            if (tripId) sessionStorage.setItem('pendingJoinTripId', tripId)
            signIn(window.location.origin)
          }}
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
