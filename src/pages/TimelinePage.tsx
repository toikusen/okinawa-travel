import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { fmtChip, scrollTargetEventId, todayStr, tripStatus } from '../lib/dates'
import { Icon } from '../components/Icon'
import { SyncIndicator } from '../components/SyncIndicator'
import { AvatarStack } from '../components/AvatarStack'
import { TripNav } from '../components/TripNav'
import { DaySection } from '../components/DaySection'
import { WishlistSection } from '../components/WishlistSection'
import { WISHLIST } from '../lib/db'
import { InstallPrompt } from '../components/InstallPrompt'
import { InviteCard } from '../components/InviteCard'

export function TimelinePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip, days, eventsByDay, loading } = useTrip(tripId ?? null)
  const syncStatus = useSyncStatus()
  const [activeDay, setActiveDay] = useState<string | null>(null)

  const scrolledRef = useRef(false)

  /** Brings the first event that has not ended into view under the sticky header.
   *  Returns false when there is nothing to scroll to, so the initial scroll can
   *  retry on the next data update. Shared by that initial scroll and the 今天 tab. */
  const scrollToNow = useCallback(() => {
    const targetId = scrollTargetEventId({ days, eventsByDay, now: new Date() })
    if (!targetId) return false

    const el = document.getElementById(`event-${targetId}`)
    if (!el) return false

    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 96
    el.style.scrollMarginTop = `${headerHeight + 8}px`
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return true
  }, [days, eventsByDay])

  useEffect(() => {
    if (scrolledRef.current || !days.length) return
    scrolledRef.current = scrollToNow()
  }, [days.length, scrollToNow])

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
              <Icon name="chevronLeft" />
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
              <Icon name="settings" />
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
        <InviteCard trip={trip} />
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
        onToday={scrollToNow}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <InstallPrompt />
    </div>
  )
}
