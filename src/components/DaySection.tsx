import { useEffect, useState } from 'react'
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
import { fmtMD, todayStr, hhmm, nowLineIndex } from '../lib/dates'
import { useNow } from '../hooks/useNow'
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
        className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
      >
        <span className="w-5 h-7 rounded-[5px] bg-[#f0f4f8] flex items-center justify-center text-[#8fa0b0]">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" />
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" />
            <circle cx="3" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" />
          </svg>
        </span>
      </span>
      {event.type === 'fork' ? (
        <ForkCard event={event} onClick={onOpen} />
      ) : (
        <EventCard event={event} onClick={onOpen} />
      )}
    </div>
  )
}

function NowLine({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="now-line">
      <span className="shrink-0 w-2 h-2 rounded-full bg-[#dc2626]" />
      <span className="h-0.5 flex-1 bg-[#dc2626] rounded-full" />
      <span className="shrink-0 text-[10.5px] font-bold text-[#dc2626]">現在 {time}</span>
    </div>
  )
}

interface Props {
  day: Day
  tripId: string
  members: TripMember[]
  events: TripEvent[]
}

export function DaySection({ day, tripId, members, events: incomingEvents }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<TripEvent | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(day.label)
  const [pendingOrder, setPendingOrder] = useState<TripEvent[] | null>(null)
  const events = pendingOrder ?? incomingEvents

  // A realtime refetch is the authoritative answer; drop the local guess.
  useEffect(() => { setPendingOrder(null) }, [incomingEvents])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    // 鍵盤排序:focus 把手後空白鍵拿起、方向鍵移動、空白鍵放下
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const now = useNow()
  const isToday = day.date === todayStr(now)
  const nowTime = hhmm(now)
  const nowIndex = isToday ? nowLineIndex(events, nowTime) : -1

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const reordered = applyReorder(events, String(active.id), String(over.id))
    if (reordered === events) return

    setPendingOrder(reordered)
    const result = await reorderEvents(day.id, reordered.map((e) => e.id))
    if (!result.ok) {
      setPendingOrder(null)
      toast('排序沒有存成功,已還原')
    }
  }

  const handleLabelBlur = async () => {
    setEditingLabel(false)
    if (labelDraft !== day.label) {
      await updateDayLabel(day.id, labelDraft)
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
        <span className="text-[13px] font-extrabold text-[#1a2530] whitespace-nowrap">{fmtMD(day.date)}</span>
        {editingLabel ? (
          <input
            autoFocus
            aria-label="日期標籤"
            className="text-xs text-[#5a7a8a] bg-transparent border-b border-[#0077b6] outline-none flex-1 min-w-0"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-xs text-[#52707f] flex-1 min-w-0 text-left truncate"
          >
            {day.label || '點擊新增標籤'}
          </button>
        )}
        <div className="h-px flex-1 bg-[#e8edf2] shrink-0" />
        <button
          onClick={openCreate}
          aria-label="新增行程"
          className="w-11 h-11 -my-2 -mr-1.5 flex items-center justify-center shrink-0"
        >
          <span className="w-8 h-8 rounded-[10px] bg-[#e3f1f9] text-[#0077b6] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
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
