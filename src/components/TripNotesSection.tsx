import { useEffect, useRef, useState } from 'react'
import { updateTrip } from '../lib/db'
import { toast } from '../lib/toast'
import { SavedBadge } from './SavedBadge'
import type { Trip } from '../types'

/** A worked example, not a list of field names: seeing the shape is what tells
 *  people what belongs here. */
const PLACEHOLDER = `BR116 桃園 07:35 → 那霸 10:05
Hyatt Naha 訂房代號 X7K92
緊急聯絡 +81-98-123-4567`

/** Flights, booking codes, emergency contacts — dug for a few times a trip,
 *  not every time the app opens, so it sits in settings beside the other
 *  trip-level fields instead of on top of the timeline. Read mode always
 *  renders `trip.notes`, so a co-traveller's edit lands without clobbering a
 *  draft in progress. */
export function TripNotesSection({ trip }: { trip: Trip }) {
  // ?? '' — a trip cached in localStorage before 012 has no notes field
  const notes = trip.notes ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const isEmpty = !notes.trim()
  const showEditor = editing || isEmpty

  const startEditing = () => {
    setDraft(notes)
    setEditing(true)
  }

  const save = async () => {
    setEditing(false)
    if (draft === notes) return
    const result = await updateTrip(trip.id, { notes: draft })
    if (!result.ok) return toast('重要資訊儲存失敗,請再試一次')
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="bg-white rounded-[12px] p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="trip-notes" className="text-xs font-semibold text-text-label">重要資訊</label>
        {saved && <SavedBadge />}
      </div>

      {showEditor ? (
        <>
          <textarea
            id="trip-notes"
            aria-label="重要資訊"
            autoFocus={editing}
            className="w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong h-28 resize-none"
            placeholder={PLACEHOLDER}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
          />
          <p className="text-[11px] text-text-label mt-1">所有旅伴都看得到,離開輸入框就會儲存。</p>
        </>
      ) : (
        <>
          <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">{notes}</p>
          <button
            onClick={startEditing}
            className="mt-2 text-xs font-semibold text-primary active:opacity-80"
          >
            編輯
          </button>
        </>
      )}
    </section>
  )
}
