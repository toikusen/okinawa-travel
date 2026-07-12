import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { fmtChip, todayStr } from '../lib/dates'
import { SyncIndicator } from '../components/SyncIndicator'
import { AvatarStack } from '../components/AvatarStack'
import { TripNav } from '../components/TripNav'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()
  const [activeDay, setActiveDay] = useState<string | null>(null)

  useEffect(() => {
    if (!days.length) return

    const now = new Date()
    const today = todayStr(now)

    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const tryScroll = () => {
      const todayEvents = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-date="${today}"]`)
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
        const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 96
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
        <p className="text-sm text-[#52707f]">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  const today = todayStr()
  const highlighted = activeDay ?? days.find(d => d.date === today)?.id ?? null

  const scrollToDay = (dayId: string) => {
    setActiveDay(dayId)
    document.getElementById(`day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] sticky top-0 z-10">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/')} className="text-[#0077b6] shrink-0 -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="回旅程列表">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-[#1a2530] truncate">{trip.name}</h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <SyncIndicator status={syncStatus} />
            {trip.members.length > 0 ? (
              <AvatarStack members={trip.members} size={24} max={3} />
            ) : (
              user?.user_metadata?.avatar_url && (
                <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
              )
            )}
          </div>
        </div>
        {/* 日期膠囊列:點一下直達該天 */}
        {days.length > 1 && (
          <div className="flex gap-1.5 px-4 pb-2.5 pt-1 overflow-x-auto [scrollbar-width:none]">
            {days.map((day) => {
              const isActive = day.id === highlighted
              return (
                <button
                  key={day.id}
                  onClick={() => scrollToDay(day.id)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0077b6] text-white font-bold'
                      : 'bg-[#f0f4f8] text-[#52707f] font-semibold'
                  }`}
                >
                  {fmtChip(day.date)}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection key={day.id} day={day} tripId={trip.id} members={trip.members} />
          ))}
        </div>
      </main>

      <TripNav tripId={trip.id} active="timeline" />

      <InstallPrompt />
    </div>
  )
}
