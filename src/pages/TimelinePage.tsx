import { useEffect } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { SyncIndicator } from '../components/SyncIndicator'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()

  useEffect(() => {
    if (!days.length) return

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const tryScroll = () => {
      const todayEvents = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-date="${todayStr}"]`)
      ).sort((a, b) => toMinutes(a.dataset.timeStart ?? '') - toMinutes(b.dataset.timeStart ?? ''))

      if (!todayEvents.length) {
        if (attempts < 10) {
          attempts++
          timer = setTimeout(tryScroll, 300)
        }
        return
      }

      let target: HTMLElement | null = null
      let lastPast: HTMLElement | null = null

      for (const el of todayEvents) {
        const minutes = toMinutes(el.dataset.timeStart ?? '')
        if (minutes <= currentMinutes) {
          lastPast = el
        } else {
          target = el
          break
        }
      }

      // 優先顯示目前正在進行的行程；若還沒開始，顯示下一個
      const scrollTarget = lastPast ?? target ?? todayEvents[0]
      if (scrollTarget) {
        const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 56
        scrollTarget.style.scrollMarginTop = `${headerHeight + 8}px`
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    timer = setTimeout(tryScroll, 300)

    return () => clearTimeout(timer)
  }, [days.length])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <p className="text-sm text-[#8fa0b0]">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate('/')} className="text-[#0077b6] text-sm shrink-0" aria-label="回旅程列表">←</button>
          <h1 className="text-base font-bold text-[#1a2530] truncate">{trip.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator status={syncStatus} />
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection key={day.id} day={day} tripId={trip.id} members={trip.members} />
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
          onClick={() => navigate(`/trips/${tripId}/settings`)}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] text-[#8fa0b0]">設定</span>
        </button>
      </nav>

      <InstallPrompt />
    </div>
  )
}
