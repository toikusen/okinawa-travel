import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { joinTrip, getTripPreview, type TripPreview } from '../lib/db'
import { fmtRange, dayCount } from '../lib/dates'
import { AvatarStack } from '../components/AvatarStack'

export function JoinPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<TripPreview | null | 'loading'>('loading')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(false)

  useEffect(() => {
    if (!tripId || !user) return
    getTripPreview(tripId).then(setPreview)
  }, [tripId, user])

  const handleJoin = async () => {
    if (!tripId || !user?.email) return
    setJoining(true)
    setJoinError(false)
    const success = await joinTrip(tripId)
    setJoining(false)
    if (success) navigate(`/trips/${tripId}`, { replace: true })
    else setJoinError(true)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-text-strong">請先登入以加入旅程</p>
        <button
          onClick={() => {
            if (tripId) sessionStorage.setItem('pendingJoinTripId', tripId)
            signIn(window.location.origin)
          }}
          className="bg-primary text-white rounded-[10px] py-3 px-8 text-sm font-semibold"
        >
          Google 帳號登入
        </button>
      </div>
    )
  }

  if (preview === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-text-label">載入旅程資訊中...</p>
      </div>
    )
  }

  if (preview === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <p className="text-sm text-danger">旅程不存在或連結已失效。</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-5 px-6">
      <p className="text-sm text-text-label">你受邀加入這個旅程</p>
      <div className="w-full max-w-sm bg-white rounded-[14px] border border-border p-5 flex flex-col gap-3">
        <p className="text-lg font-bold text-text-strong">{preview.name}</p>
        <p className="text-xs text-text-label">
          {fmtRange(preview.start_date, preview.end_date)} · {dayCount(preview.start_date, preview.end_date)} 天
        </p>
        {preview.members.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AvatarStack members={preview.members} />
            <span className="text-[11px] text-text-label">{preview.members.length} 位旅伴</span>
          </div>
        )}
      </div>
      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full max-w-sm bg-primary text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
      >
        {joining ? '加入中...' : '加入旅程'}
      </button>
      {joinError && <p className="text-xs text-danger">加入失敗,請再試一次。</p>}
    </div>
  )
}
