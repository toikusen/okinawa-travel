import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { updateDayLabel } from '../lib/db'
import { toast } from '../lib/toast'
import { fmtMD, todayStr, hhmm, nowLineIndex, dayRouteUrl } from '../lib/dates'
import { useNow } from '../hooks/useNow'
import { Icon } from './Icon'
import { SortableCard } from './SortableCard'
import { EventSheet } from './EventSheet'
import { EventDetailSheet } from './EventDetailSheet'
import type { Day, TripEvent, TripMember } from '../types'

function NowLine({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="now-line">
      <span className="shrink-0 w-2 h-2 rounded-full bg-danger" />
      <span className="h-0.5 flex-1 bg-danger rounded-full" />
      <span className="shrink-0 text-[10.5px] font-bold text-danger">現在 {time}</span>
    </div>
  )
}

interface Props {
  day: Day
  tripId: string
  members: TripMember[]
  events: TripEvent[]
  /** All days of the trip — lets the edit sheet move an event elsewhere. */
  days?: Day[]
}

/** One day of the timeline. A drop target for the trip's DndContext, which
 *  lives in TimelinePage so a card can cross between days. */
export function DaySection({ day, tripId, members, events, days = [] }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(day.label)
  const { setNodeRef, isOver } = useDroppable({ id: day.id })

  const now = useNow()
  const isToday = day.date === todayStr(now)
  const nowTime = hhmm(now)
  const nowIndex = isToday ? nowLineIndex(events, nowTime) : -1
  const routeUrl = dayRouteUrl(events.map((e) => e.location))

  const handleLabelBlur = async () => {
    setEditingLabel(false)
    if (labelDraft !== day.label) {
      const previous = day.label
      const result = await updateDayLabel(day.id, labelDraft)
      if (!result.ok) {
        setLabelDraft(previous)
        toast('標籤儲存失敗,請再試一次')
      }
    }
  }

  const openCreate = () => {
    setSelectedEvent(null)
    setSheetOpen(true)
  }

  const openDetail = (e: TripEvent) => {
    setDetailEvent(e)
    setDetailOpen(true)
  }

  const handleDetailEdit = (e: TripEvent) => {
    setDetailOpen(false)
    setDetailEvent(null)
    setSelectedEvent(e)
    setSheetOpen(true)
  }

  return (
    <section id={`day-${day.id}`} style={{ scrollMarginTop: 104 }}>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-extrabold text-text-strong whitespace-nowrap">{fmtMD(day.date)}</span>
        {editingLabel ? (
          <input
            autoFocus
            aria-label="日期標籤"
            className="text-xs text-text-secondary bg-transparent border-b border-primary outline-none flex-1 min-w-0"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-xs text-text-label flex-1 min-w-0 text-left truncate"
          >
            {day.label || '點擊新增標籤'}
          </button>
        )}
        <div className="h-px flex-1 bg-border shrink-0" />
        {/* 一天的地點串成一條 Google Maps 路線,省下逐點導航 */}
        {routeUrl && (
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${fmtMD(day.date)} 當日路線`}
            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary bg-bg-accent rounded-full px-2.5 py-2 -my-1"
          >
            <Icon name="navigation" size={12} />
            路線
          </a>
        )}
        <button
          onClick={openCreate}
          aria-label="新增行程"
          className="w-11 h-11 -my-2 -mr-1.5 flex items-center justify-center shrink-0"
        >
          <span className="w-8 h-8 rounded-[10px] bg-bg-accent text-primary flex items-center justify-center">
            <Icon name="plus" size={16} />
          </span>
        </button>
      </div>

      <SortableContext id={day.id} items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2">
          {events.map((event, i) => (
            <span key={event.id} className="contents">
              {i === nowIndex && <NowLine time={nowTime} />}
              <SortableCard event={event} onOpen={openDetail} />
            </span>
          ))}
          {nowIndex === events.length && events.length > 0 && <NowLine time={nowTime} />}
          {/* An empty day needs a body to be a drop target at all, and the
              hint is what tells you dragging here is a thing. */}
          {events.length === 0 && (
            <p
              className={`rounded-[12px] border border-dashed py-4 text-center text-xs ${
                isOver ? 'border-primary bg-bg-accent text-primary' : 'border-icon-muted text-text-label'
              }`}
            >
              還沒安排,把卡片拖來這裡
            </p>
          )}
        </div>
      </SortableContext>

      <EventSheet
        open={sheetOpen}
        event={selectedEvent}
        dayId={day.id}
        tripId={tripId}
        events={events}
        members={members}
        days={days}
        onClose={() => setSheetOpen(false)}
      />

      <EventDetailSheet
        open={detailOpen}
        event={detailEvent}
        onClose={() => { setDetailOpen(false); setDetailEvent(null) }}
        onEdit={handleDetailEdit}
      />
    </section>
  )
}
