import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTrip, updateTripDates, deleteTrip, removeMember } from '../lib/db'
import { MembersSection } from '../components/MembersSection'
import { SavedBadge } from '../components/SavedBadge'

export function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip } = useTrip(tripId ?? null)
  const [nameInput, setNameInput] = useState('')
  const [dates, setDates] = useState({ start: '', end: '' })
  const [dateError, setDateError] = useState<string | null>(null)
  const [saved, setSaved] = useState<'name' | 'dates' | null>(null)
  const [busy, setBusy] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  useEffect(() => {
    if (trip) setDates({ start: trip.start_date, end: trip.end_date })
  }, [trip?.start_date, trip?.end_date])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const isOwner = trip?.owner_email === user?.email

  const flashSaved = (what: 'name' | 'dates') => {
    setSaved(what)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(null), 2000)
  }

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim() || nameInput.trim() === trip?.name) return
    const result = await updateTrip(tripId, { name: nameInput.trim() })
    if (result.ok) flashSaved('name')
    else window.alert('名稱儲存失敗,請再試一次。')
  }

  const handleSaveDates = async () => {
    if (!tripId || !dates.start || !dates.end || dates.start > dates.end) return
    if (trip && dates.start === trip.start_date && dates.end === trip.end_date) return
    try {
      const result = await updateTripDates(tripId, dates.start, dates.end)
      if (result.ok) {
        setDateError(null)
        flashSaved('dates')
      }
      else if (result.blockedDates) setDateError(`以下日期已有行程,請先清空:${result.blockedDates.join('、')}`)
      else setDateError('日期更新失敗,請再試一次')
    } catch {
      setDateError('日期更新失敗,請再試一次')
    }
  }

  const handleLeave = async () => {
    if (!tripId || !user?.email || !window.confirm('確定要退出這個旅程嗎?')) return
    setBusy(true)
    try {
      const ok = await removeMember(tripId, user.email)
      if (ok) navigate('/', { replace: true })
      else window.alert('退出失敗,請再試一次。')
    } catch {
      window.alert('退出失敗,請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!tripId || !trip) return
    const typed = window.prompt(`此動作無法復原,所有行程與圖片將一併刪除。\n請輸入旅程名稱「${trip.name}」以確認刪除:`)
    if (typed === null) return
    if (typed.trim() !== trip.name) {
      window.alert('名稱不符,已取消刪除。')
      return
    }
    setBusy(true)
    try {
      const ok = await deleteTrip(tripId)
      if (ok) navigate('/', { replace: true })
      else window.alert('刪除失敗,只有主揪可以刪除旅程。')
    } catch {
      window.alert('刪除失敗,請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-[#0077b6] -ml-2 w-11 h-11 -my-1.5 flex items-center justify-center" aria-label="返回">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-[#1a2530]">設定</h1>
      </header>

      <main className="px-4 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="trip-name" className="text-xs font-semibold text-[#52707f]">旅程名稱</label>
            {saved === 'name' && <SavedBadge />}
          </div>
          <input
            id="trip-name"
            className="w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-xs font-semibold text-[#52707f]">旅程日期</p>
            {saved === 'dates' && <SavedBadge />}
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="開始日期"
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.start}
              onChange={(e) => setDates(d => ({ ...d, start: e.target.value }))}
              onBlur={handleSaveDates}
            />
            <input
              type="date"
              aria-label="結束日期"
              min={dates.start || undefined}
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.end}
              onChange={(e) => setDates(d => ({ ...d, end: e.target.value }))}
              onBlur={handleSaveDates}
            />
          </div>
          {dateError && <p className="text-xs text-[#dc2626] mt-2">{dateError}</p>}
        </section>

        {trip && <MembersSection trip={trip} currentEmail={user?.email} />}

        <section className="bg-white rounded-[12px] p-4 border border-[#fecaca]">
          <p className="text-xs font-semibold text-[#dc2626] mb-3">危險區</p>
          {isOwner ? (
            <>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? '刪除中...' : '刪除旅程'}
              </button>
              <p className="text-[11px] text-[#52707f] mt-2">刪除前需輸入旅程名稱確認,所有行程與圖片將一併刪除。</p>
            </>
          ) : (
            <button
              onClick={handleLeave}
              disabled={busy}
              className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '退出中...' : '退出旅程'}
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
