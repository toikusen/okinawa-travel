import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEvents } from '../hooks/useEvents'
import { reorderEvents, updateDayLabel } from '../lib/db'
import { EventCard } from './EventCard'
import { ForkCard } from './ForkCard'
import { EventSheet } from './EventSheet'
import type { Day, TripEvent, TripMember } from '../types'

function SortableCard({
  event,
  onEdit,
}: {
  event: TripEvent
  onEdit: (e: TripEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {event.type === 'fork' ? (
        <ForkCard event={event} onClick={onEdit} />
      ) : (
        <EventCard event={event} onClick={onEdit} />
      )}
    </div>
  )
}

interface Props {
  day: Day
  tripId: string
  members: TripMember[]
}

export function DaySection({ day, tripId, members }: Props) {
  const events = useEvents(tripId, day.id)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(day.label)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  )

  const dateObj = new Date(day.date + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay()]})`

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = events.findIndex((e) => e.id === active.id)
    const newIndex = events.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(events, oldIndex, newIndex)
    await reorderEvents(tripId, day.id, reordered.map((e) => e.id))
  }

  const handleLabelBlur = async () => {
    setEditingLabel(false)
    if (labelDraft !== day.label) {
      await updateDayLabel(tripId, day.id, labelDraft)
    }
  }

  const openCreate = () => {
    setSelectedEvent(null)
    setSheetOpen(true)
  }

  const openEdit = (e: TripEvent) => {
    setSelectedEvent(e)
    setSheetOpen(true)
  }

  return (
    <section>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-[#0077b6] whitespace-nowrap">{dateLabel}</span>
        {editingLabel ? (
          <input
            autoFocus
            className="text-xs text-[#5a7a8a] bg-transparent border-b border-[#0077b6] outline-none flex-1 min-w-0"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-xs text-[#8fa0b0] flex-1 min-w-0 text-left truncate"
          >
            {day.label || '點擊新增標籤'}
          </button>
        )}
        <div className="h-px flex-1 bg-[#e8edf2] shrink-0" />
        <button
          onClick={openCreate}
          className="text-[#0077b6] text-xl leading-none w-7 h-7 flex items-center justify-center shrink-0"
        >
          ＋
        </button>
      </div>

      {/* Sortable event list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={events.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <SortableCard key={event.id} event={event} onEdit={openEdit} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <EventSheet
        open={sheetOpen}
        event={selectedEvent}
        dayId={day.id}
        tripId={tripId}
        eventCount={events.length}
        members={members}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  )
}
