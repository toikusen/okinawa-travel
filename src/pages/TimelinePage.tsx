import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { fmtChip, scrollTargetEventId, todayStr, tripStatus } from '../lib/dates'
import { SyncIndicator } from '../components/SyncIndicator'
import { AvatarStack } from '../components/AvatarStack'
import { TripNav } from '../components/TripNav'
import { DaySection } from '../components/DaySection'
import { InstallPrompt } from '../components/InstallPrompt'
import { NowSection } from '../components/NowSection'
import { EventDetailSheet } from '../components/EventDetailSheet'
import type { TripEvent } from '../types'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)

  const scrolledRef = useRef(false)

  useEffect(() => {
    if (scrolledRef.current || !days.length) return

    const targetId = scrollTargetEventId({ days, eventsByDay, now: new Date() })
    if (!targetId) return

    const el = document.getElementById(`event-${targetId}`)
    if (!el) return

    scrolledRef.current = true
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 96
    el.style.scrollMarginTop = `${headerHeight + 8}px`
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [days, eventsByDay])

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
        {tripStatus(trip.start_date, trip.end_date) === 'ongoing' && (
          <div id="now-section">
            <NowSection days={days} eventsByDay={eventsByDay} onOpen={setDetailEvent} />
          </div>
        )}
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <DaySection
              key={day.id}
              day={day}
              tripId={trip.id}
              members={trip.members}
              events={eventsByDay[day.id] ?? []}
            />
          ))}
        </div>
      </main>

      <TripNav tripId={trip.id} active="timeline" />

      <InstallPrompt />

      <EventDetailSheet
        open={detailEvent !== null}
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onEdit={() => setDetailEvent(null)}
        hideEdit
      />
    </div>
  )
}
