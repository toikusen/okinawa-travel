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

/** Flights, booking codes, emergency contacts — the block you dig for mid-trip.
 *  Edited in place at the top of the timeline: an empty card still renders,
 *  otherwise nobody ever discovers the field exists. */
export function TripNotesCard({ trip }: { trip: Trip }) {
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
    <details className="mb-4 bg-white border border-border rounded-[12px] px-4 py-3">
      <summary className="text-[13px] font-extrabold text-text-strong cursor-pointer marker:text-text-label">
        重要資訊
        {isEmpty && (
          <span className="ml-2 text-[11px] font-semibold text-text-label">還沒填 · 點一下新增</span>
        )}
        {saved && <span className="ml-2 inline-flex align-middle"><SavedBadge /></span>}
      </summary>

      {showEditor ? (
        <>
          <textarea
            id="trip-notes"
            aria-label="重要資訊"
            autoFocus={editing}
            className="mt-2 w-full border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong h-28 resize-none"
            placeholder={PLACEHOLDER}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
          />
          <p className="text-[11px] text-text-label mt-1">所有旅伴都看得到,離開輸入框就會儲存。</p>
        </>
      ) : (
        <>
          <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed mt-2">{notes}</p>
          <button
            onClick={startEditing}
            className="mt-2 text-xs font-semibold text-primary active:opacity-80"
          >
            編輯
          </button>
        </>
      )}
    </details>
  )
}
