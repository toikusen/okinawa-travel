import { useEffect, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderEvents, updateDayLabel } from '../lib/db'
import { toast } from '../lib/toast'
import { fmtMD, todayStr, hhmm, nowLineIndex, dayRouteUrl } from '../lib/dates'
import { useNow } from '../hooks/useNow'
import { Icon } from './Icon'
import { EventCard } from './EventCard'
import { ForkCard } from './ForkCard'
import { EventSheet } from './EventSheet'
import { EventDetailSheet } from './EventDetailSheet'
import type { Day, TripEvent, TripMember } from '../types'

/** Move `activeId` to `overId`'s position. Returns the input untouched when
 *  either id is not in the list. */
export function applyReorder(events: TripEvent[], activeId: string, overId: string): TripEvent[] {
  const from = events.findIndex((e) => e.id === activeId)
  const to = events.findIndex((e) => e.id === overId)
  if (from < 0 || to < 0) return events
  return arrayMove(events, from, to)
}

/**
 * Optimistic drag-reorder state, extracted from DaySection so the
 * in-flight-write race can be exercised directly in tests (real dnd-kit
 * drags are unreliable in jsdom).
 *
 * `incomingEvents` is the server-derived list; it can get a new array
 * reference for reasons unrelated to this day's own reorder (e.g. a
 * realtime push triggered by another day's event changing — see
 * `subscribeToTripEvents` in `lib/db.ts`, which refetches the whole trip on
 * any change). `writingRef` guards against that: while this day's own
 * `reorderEvents` write is in flight, an incoming prop change must not wipe
 * out the optimistic order, or the list flickers back and then forward
 * again once the write's own realtime push lands.
 */
export function useReorderState(incomingEvents: TripEvent[], dayId: string) {
  const [pendingOrder, setPendingOrder] = useState<TripEvent[] | null>(null)
  const writingRef = useRef(false)
  const incomingRef = useRef(incomingEvents)
  const events = pendingOrder ?? incomingEvents

  useEffect(() => {
    incomingRef.current = incomingEvents
    // A write for this day is still in flight — its own realtime push may
    // land before the RPC promise resolves. Keep the optimistic order until
    // the write settles (see the success branch below).
    if (writingRef.current) return
    setPendingOrder(null)
  }, [incomingEvents])

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const reordered = applyReorder(events, String(active.id), String(over.id))
    if (reordered === events) return

    setPendingOrder(reordered)
    writingRef.current = true
    try {
      const result = await reorderEvents(dayId, reordered.map((e) => e.id))
      if (!result.ok) {
        setPendingOrder(null)
        toast('排序沒有存成功,已還原')
        return
      }
      // The realtime push for this write may already have landed while we
      // were waiting, in which case incomingEvents already matches — settle
      // instead of leaving the optimistic copy around indefinitely.
      const latest = incomingRef.current
      const matches =
        latest.length === reordered.length &&
        latest.every((e, i) => e.id === reordered[i].id)
      if (matches) setPendingOrder(null)
    } finally {
      writingRef.current = false
    }
  }

  return { events, handleDragEnd }
}

function SortableCard({
  event,
  onOpen,
}: {
  event: TripEvent
  onOpen: (e: TripEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      id={`event-${event.id}`}
      style={style}
      className="relative"
    >
      {/* 拖曳把手：立即可拖，卡片本體維持點擊 */}
      <span
        {...attributes}
        {...listeners}
        role="button"
        aria-label="拖曳排序"
        className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-start justify-center pt-3 touch-none cursor-grab active:cursor-grabbing"
      >
        <span className="w-5 h-8 rounded-[5px] bg-bg flex items-center justify-center text-muted">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" />
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" />
            <circle cx="3" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" />
          </svg>
        </span>
      </span>
      {event.type === 'fork' ? (
        <ForkCard event={event} onClick={onOpen} inset />
      ) : (
        <EventCard event={event} onClick={onOpen} inset />
      )}
    </div>
  )
}

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

export function DaySection({ day, tripId, members, events: incomingEvents, days = [] }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(day.label)
  const { events, handleDragEnd } = useReorderState(incomingEvents, day.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    // 鍵盤排序:focus 把手後空白鍵拿起、方向鍵移動、空白鍵放下
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

      {/* Sortable event list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {events.map((event, i) => (
              <span key={event.id} className="contents">
                {i === nowIndex && <NowLine time={nowTime} />}
                <SortableCard event={event} onOpen={openDetail} />
              </span>
            ))}
            {nowIndex === events.length && events.length > 0 && <NowLine time={nowTime} />}
          </div>
        </SortableContext>
      </DndContext>

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
