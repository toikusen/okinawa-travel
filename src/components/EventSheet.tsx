import { useState, useEffect, useRef } from 'react'
import type { TripEvent, ForkItem, TripMember } from '../types'
import { createEvent, updateEvent, deleteEvent, reorderEvents } from '../lib/db'
import { uploadEventImage } from '../lib/storage'
import { BottomSheet } from './BottomSheet'

interface Props {
  open: boolean
  event: TripEvent | null
  dayId: string
  tripId: string
  events: TripEvent[]
  members?: TripMember[]
  onClose: () => void
}

const emptyFork = (): ForkItem => ({ person: '', title: '', location: '', notes: '' })

const TIME_PRESETS = [
  { label: '早上', start: '09:00', end: '12:00' },
  { label: '中午', start: '12:00', end: '13:30' },
  { label: '下午', start: '13:30', end: '17:30' },
  { label: '晚上', start: '18:00', end: '21:00' },
  { label: '整天', start: '09:00', end: '21:00' },
]

function sanitizeLinkUrl(url: string): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}

export function EventSheet({ open, event, dayId, tripId, events, members = [], onClose }: Props) {
  const isEdit = event !== null
  const [type, setType] = useState<'shared' | 'fork'>('shared')
  const [title, setTitle] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [forks, setForks] = useState<ForkItem[]>([emptyFork(), emptyFork()])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setType(event?.type ?? 'shared')
    setTitle(event?.title ?? '')
    setTimeStart(event?.time_start ?? '')
    setTimeEnd(event?.time_end ?? '')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    const items = event?.fork_items ?? []
    setForks(items.length >= 2 ? items : [items[0] ?? emptyFork(), items[1] ?? emptyFork()])
    setImageFile(null)
    setImageUrl(event?.image_url ?? null)
    setLinkUrl(event?.link_url ?? '')
  }, [event, open])

  useEffect(() => {
    if (!imageFile) {
      setPreviewSrc(imageUrl)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile, imageUrl])

  if (!open) return null

  const titleMissing = type === 'shared' && !title.trim()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片不能超過 5MB')
      return
    }
    setImageFile(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (titleMissing) return
    setSaving(true)
    try {
      let resolvedImageUrl: string | null = imageUrl
      let preGeneratedId: string | undefined

      if (imageFile) {
        preGeneratedId = isEdit ? event!.id : crypto.randomUUID()
        try {
          resolvedImageUrl = await uploadEventImage(tripId, preGeneratedId, imageFile)
        } catch {
          alert('圖片上傳失敗，請重試')
          resolvedImageUrl = isEdit ? (event!.image_url ?? null) : null
        }
      }

      const base = {
        type,
        time_start: timeStart,
        time_end: timeEnd,
        sort_order: isEdit ? event!.sort_order : events.length,
      }
      const data: Omit<TripEvent, 'id'> = type === 'shared'
        ? { ...base, title, location, notes, image_url: resolvedImageUrl, link_url: sanitizeLinkUrl(linkUrl) }
        : { ...base, title: '', location: '', notes: '', fork_items: forks, image_url: resolvedImageUrl, link_url: sanitizeLinkUrl(linkUrl) }

      if (isEdit) {
        await updateEvent(tripId, dayId, event!.id, data)
      } else {
        const newId = await createEvent(tripId, dayId, { ...data, ...(preGeneratedId ? { id: preGeneratedId } : {}) })
        if (timeStart) {
          const allEvents: TripEvent[] = [...events, { ...data, id: newId }]
          const sorted = [...allEvents].sort((a, b) => {
            const ta = a.time_start || '\xff'
            const tb = b.time_start || '\xff'
            return ta.localeCompare(tb)
          })
          await reorderEvents(tripId, dayId, sorted.map((e) => e.id))
        }
      }

      onClose()
    } catch {
      alert('儲存失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit) return
    if (!window.confirm('確定刪除？此動作無法復原。')) return
    setSaving(true)
    try {
      await deleteEvent(tripId, dayId, event.id)
      onClose()
    } catch {
      alert('刪除失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530] bg-white focus:outline-none focus:border-[#0077b6]'
  const labelCls = 'text-[11px] font-semibold text-[#52707f] mb-1 block'

  const timeFields = (
    <>
      <div className="flex gap-2 mb-1.5">
        <div className="flex-1">
          <label htmlFor="ev-time-start" className={labelCls}>開始</label>
          <input
            id="ev-time-start"
            type="time"
            className={inputCls}
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="ev-time-end" className={labelCls}>結束</label>
          <input
            id="ev-time-end"
            type="time"
            className={inputCls}
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
        </div>
      </div>
      {/* 時段快選:多數行程不需要精確到分鐘 */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {TIME_PRESETS.map((p) => {
          const active = timeStart === p.start && timeEnd === p.end
          return (
            <button
              key={p.label}
              onClick={() => { setTimeStart(p.start); setTimeEnd(p.end) }}
              aria-pressed={active}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
                active ? 'bg-[#0077b6] text-white' : 'bg-[#e3f1f9] text-[#0077b6]'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <BottomSheet
      label={isEdit ? '編輯行程' : '新增行程'}
      onClose={onClose}
      backdropTestId="sheet-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] px-4 pt-3 pb-4 max-h-[90vh] overflow-y-auto"
    >
        <div className="w-9 h-1 bg-[#e8edf2] rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold text-[#1a2530]">
            {isEdit ? '編輯行程' : '新增行程'}
          </p>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#dc2626] bg-[#fef2f2] rounded-[8px] px-2.5 py-1.5 disabled:opacity-60"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
              刪除
            </button>
          )}
        </div>

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
              {t === 'shared' ? '共同行程' : '分頭行動'}
            </button>
          ))}
        </div>

        {type === 'shared' ? (
          <>
            <div className="mb-3">
              <label htmlFor="ev-title" className={labelCls}>名稱 <span className="text-[#dc2626]">*</span></label>
              <input
                id="ev-title"
                className={inputCls}
                placeholder="行程名稱"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {titleMissing && (
                <p className="text-[11px] text-[#dc2626] mt-1">請輸入行程名稱</p>
              )}
            </div>
            {timeFields}
            <div className="mb-3">
              <label htmlFor="ev-location" className={labelCls}>地點</label>
              <input
                id="ev-location"
                className={inputCls}
                placeholder="地點（選填）"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="ev-notes" className={labelCls}>備註</label>
              <textarea
                id="ev-notes"
                className={`${inputCls} h-16 resize-none`}
                placeholder="備註（選填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            {timeFields}
            <div className="flex flex-col gap-2 mb-2">
              {forks.map((item, i) => (
                <div key={i} className="bg-[#f8f9fa] rounded-[8px] p-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {members.length > 0 ? (
                      <select
                        className={`${inputCls} !bg-white`}
                        value={item.person}
                        onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, person: e.target.value } : f))}
                        aria-label={`第 ${i + 1} 組成員`}
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
                        placeholder={`第 ${i + 1} 組`}
                        value={item.person}
                        onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, person: e.target.value } : f))}
                      />
                    )}
                    {forks.length > 2 && (
                      <button
                        onClick={() => setForks(forks.filter((_, j) => j !== i))}
                        aria-label={`移除第 ${i + 1} 組`}
                        className="shrink-0 w-11 h-11 -my-1 -mr-1 flex items-center justify-center text-[#52707f]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="活動"
                    aria-label={`第 ${i + 1} 組活動`}
                    value={item.title}
                    onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, title: e.target.value } : f))}
                  />
                  <input
                    className={`${inputCls} !bg-white`}
                    placeholder="地點"
                    aria-label={`第 ${i + 1} 組地點`}
                    value={item.location}
                    onChange={(e) => setForks(forks.map((f, j) => j === i ? { ...f, location: e.target.value } : f))}
                  />
                </div>
              ))}
              <button
                onClick={() => setForks([...forks, emptyFork()])}
                className="w-full border border-dashed border-[#b0c4d0] rounded-[8px] py-2 text-xs font-semibold text-[#0077b6] mb-2"
              >
                ＋ 新增一組
              </button>
            </div>
          </>
        )}

        {/* Image picker */}
        <div className="mb-3">
          <p className={labelCls}>圖片（選填）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewSrc ? (
            <div className="flex items-center gap-3">
              <img src={previewSrc} alt="preview" className="w-16 h-16 rounded-[8px] object-cover border border-[#e8edf2]" />
              <button
                onClick={handleRemoveImage}
                className="text-xs text-[#dc2626] font-semibold"
              >
                移除
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-[#b0c4d0] rounded-[8px] py-3 text-sm text-[#52707f] flex items-center justify-center gap-1.5"
            >
              <span className="text-base">＋</span> 新增圖片
            </button>
          )}
        </div>

        {/* Link URL */}
        <div className="mb-4">
          <label htmlFor="ev-link" className={labelCls}>景點連結（選填）</label>
          <input
            id="ev-link"
            className={inputCls}
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>

        <div className="sticky bottom-0 bg-white pt-2 pb-4 -mb-4">
          <button
            onClick={handleSave}
            disabled={saving || titleMissing}
            className="w-full bg-[#0077b6] text-white rounded-[10px] py-3 text-sm font-semibold disabled:opacity-60"
          >
            儲存
          </button>
        </div>
    </BottomSheet>
  )
}
