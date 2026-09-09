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
import { WishlistSection } from '../components/WishlistSection'
import { WISHLIST } from '../lib/db'
import { InstallPrompt } from '../components/InstallPrompt'
import { InviteCard } from '../components/InviteCard'
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
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-text-label">載入中...</p>
      </div>
    )
  }

  if (!trip) return <Navigate to="/" replace />

  const today = todayStr()
  const highlighted = activeDay ?? days.find(d => d.date === today)?.id ?? null
  const isOngoing = tripStatus(trip.start_date, trip.end_date) === 'ongoing'

  const scrollToDay = (dayId: string) => {
    setActiveDay(dayId)
    document.getElementById(`day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      {/* z-20 keeps the chrome above the cards' drag handles (z-10); at an
          equal z-index the later-in-DOM handle would paint over the chips. */}
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/')} className="text-primary shrink-0 -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="回旅程列表">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-text-strong truncate">{trip.name}</h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <SyncIndicator status={syncStatus} />
            <button onClick={() => navigate(`/trips/${trip.id}/settings`)} aria-label="旅伴" className="flex items-center">
              {trip.members.length > 0 ? (
                <AvatarStack members={trip.members} size={24} max={3} />
              ) : (
                user?.user_metadata?.avatar_url && (
                  <img src={user.user_metadata.avatar_url as string} alt="" className="w-7 h-7 rounded-full" />
                )
              )}
            </button>
            <button
              onClick={() => navigate(`/trips/${trip.id}/settings`)}
              aria-label="旅程設定"
              className="text-text-label w-8 h-8 flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
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
                      ? 'bg-primary text-white font-bold'
                      : 'bg-bg text-text-label font-semibold'
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
        {/* 航班、訂房代號、緊急聯絡:旅途中最常翻的一塊,放在最上面 */}
        {/* ?. — a trip cached in localStorage before 012 has no notes field */}
        {trip.notes?.trim() && (
          <details className="mb-4 bg-white border border-border rounded-[12px] px-4 py-3">
            <summary className="text-[13px] font-extrabold text-text-strong cursor-pointer marker:text-text-label">
              重要資訊
            </summary>
            <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed mt-2">
              {trip.notes}
            </p>
          </details>
        )}
        <InviteCard trip={trip} />
        {isOngoing && (
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
              days={days}
            />
          ))}
        </div>

        <WishlistSection
          tripId={trip.id}
          days={days}
          members={trip.members}
          events={eventsByDay[WISHLIST] ?? []}
        />
      </main>

      <TripNav
        active={isOngoing ? 'today' : 'itinerary'}
        todayDisabled={!isOngoing}
        onToday={() => document.getElementById('now-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

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
