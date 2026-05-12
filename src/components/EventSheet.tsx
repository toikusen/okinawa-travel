import { useState, useEffect } from 'react'
import type { TripEvent, ForkItem, TripMember } from '../types'
import { createEvent, updateEvent, deleteEvent } from '../lib/db'

interface Props {
  open: boolean
  event: TripEvent | null
  dayId: string
  tripId: string
  eventCount: number
  members?: TripMember[]
  onClose: () => void
}

const emptyFork = (): ForkItem => ({ person: '', title: '', location: '', notes: '' })

export function EventSheet({ open, event, dayId, tripId, eventCount, members = [], onClose }: Props) {
  const isEdit = event !== null
  const [type, setType] = useState<'shared' | 'fork'>('shared')
  const [title, setTitle] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [forkA, setForkA] = useState<ForkItem>(emptyFork())
  const [forkB, setForkB] = useState<ForkItem>(emptyFork())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setType(event?.type ?? 'shared')
    setTitle(event?.title ?? '')
    setTimeStart(event?.time_start ?? '')
    setTimeEnd(event?.time_end ?? '')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    setForkA(event?.fork_items?.[0] ?? emptyFork())
    setForkB(event?.fork_items?.[1] ?? emptyFork())
  }, [event, open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    const base = {
      type,
      time_start: timeStart,
      time_end: timeEnd,
      sort_order: isEdit ? event.sort_order : eventCount,
    }
    const data: Omit<TripEvent, 'id'> = type === 'shared'
      ? { ...base, title, location, notes }
      : { ...base, title: '', location: '', notes: '', fork_items: [forkA, forkB] }

    if (isEdit) {
      await updateEvent(tripId, dayId, event.id, data)
    } else {
      await createEvent(tripId, dayId, data)
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!isEdit) return
    setSaving(true)
    await deleteEvent(tripId, dayId, event.id)
    setSaving(false)
    onClose()
  }

  const inputCls =
    'w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530] bg-white focus:outline-none focus:border-[#0077b6]'
  const labelCls = 'text-[11px] font-semibold text-[#8fa0b0] mb-1 block'

  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] px-4 pt-3 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mb-4" />
        <p className="text-[15px] font-bold text-[#1a2530] mb-4">
          {isEdit ? '編輯行程' : '新增行程'}
        </p>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          {(['shared', 'fork'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-[8px] py-1.5 text-xs font-semibold transition-colors ${
                type === t
                  ? 'bg-[#0077b6] text-white'
                  : 'bg-[#f0f4f8] text-[#5a7a8a]'
              }`}
            >
              {t === 'shared' ? '共同' : '分岔'}
            </button>
          ))}
        </div>

        {type === 'shared' ? (
          <>
            <div className="mb-3">
              <label className={labelCls}>名稱</label>
              <input
                className={inputCls}
                placeholder="行程名稱"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={labelCls}>開始</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>結束</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>地點</label>
              <input
                className={inputCls}
                placeholder="地點（選填）"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className={labelCls}>備註</label>
              <textarea
                className={`${inputCls} h-16 resize-none`}
                placeholder="備註（選填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className={labelCls}>開始</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>結束</label>
                <input
                  type="time"
                  className={inputCls}
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              {(
                [
                  { item: forkA, setItem: setForkA, label: 'A' },
                  { item: forkB, setItem: setForkB, label: 'B' },
                ] as const
              ).map(({ item, setItem, label }) => (
                <div key={label} className="flex-1 bg-[#f8f9fa] rounded-[8px] p-2 flex flex-col gap-1.5">
                  {members.length > 0 ? (
                    <select
                      className={`${inputCls} !bg-white`}
                      value={item.person}
                      onChange={(e) => setItem({ ...item, person: e.target.value })}
                      aria-label={`人名 ${label}`}
                    >
                      <option value="">選擇成員</option>
                      {members.map((m) => (
                        <option key={m.email} value={m.display_name || m.email}>
                          {m.display_name || m.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={`${inputCls} !bg-white`}
                      placeholder={`人名 ${label}`}
                      value={item.person}
                      onChange={(e) => setItem({ ...item, person: e.target.value })}
                    />
                  )}
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="活動"
                    value={item.title}
                    onChange={(e) => setItem({ ...item, title: e.target.value })}
                  />
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="地點"
                    value={item.location}
                    onChange={(e) => setItem({ ...item, location: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#0077b6] text-white rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            儲存
          </button>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="bg-[#fee2e2] text-[#dc2626] rounded-[10px] px-4 text-sm font-semibold disabled:opacity-60"
            >
              刪除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
