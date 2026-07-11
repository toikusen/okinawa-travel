import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTrip, updateTripDates, deleteTrip, removeMember } from '../lib/db'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const { trip } = useTrip(tripId ?? null)
  const [nameInput, setNameInput] = useState('')
  const [dates, setDates] = useState({ start: '', end: '' })
  const [dateError, setDateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  useEffect(() => {
    if (trip) setDates({ start: trip.start_date, end: trip.end_date })
  }, [trip?.start_date, trip?.end_date])

  const isOwner = trip?.owner_email === user?.email

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim()) return
    await updateTrip(tripId, { name: nameInput.trim() })
  }

  const handleSaveDates = async () => {
    if (!tripId || !dates.start || !dates.end || dates.start > dates.end) return
    if (trip && dates.start === trip.start_date && dates.end === trip.end_date) return
    const result = await updateTripDates(tripId, dates.start, dates.end)
    if (result.ok) setDateError(null)
    else if (result.blockedDates) setDateError(`以下日期已有行程,請先清空:${result.blockedDates.join('、')}`)
    else setDateError('日期更新失敗,請再試一次')
  }

  const handleCopyInvite = async () => {
    if (!tripId) return
    const url = `${window.location.origin}/join/${tripId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRemoveMember = async (email: string) => {
    if (!tripId) return
    setRemoving(email)
    await removeMember(tripId, email)
    setRemoving(null)
  }

  const handleLeave = async () => {
    if (!tripId || !user?.email || !window.confirm('確定要退出這個旅程嗎?')) return
    setBusy(true)
    await removeMember(tripId, user.email)
    navigate('/', { replace: true })
  }

  const handleDelete = async () => {
    if (!tripId || !window.confirm('確定要刪除整個旅程嗎?所有行程與圖片將一併刪除,無法復原。')) return
    setBusy(true)
    const ok = await deleteTrip(tripId)
    setBusy(false)
    if (ok) navigate('/', { replace: true })
    else window.alert('刪除失敗,只有主揪可以刪除旅程。')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col max-w-lg mx-auto">
      <header className="bg-white border-b border-[#e8edf2] px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => navigate(-1)} className="text-[#0077b6] text-sm">
          ← 返回
        </button>
        <h1 className="text-base font-bold text-[#1a2530]">設定</h1>
      </header>

      <main className="px-4 py-6 flex flex-col gap-4">
        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-2">旅程名稱</p>
          <input
            className="w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <p className="text-xs font-semibold text-[#8fa0b0] mt-4 mb-2">旅程日期</p>
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.start}
              onChange={(e) => setDates(d => ({ ...d, start: e.target.value }))}
              onBlur={handleSaveDates}
            />
            <input
              type="date"
              className="flex-1 border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530]"
              value={dates.end}
              onChange={(e) => setDates(d => ({ ...d, end: e.target.value }))}
              onBlur={handleSaveDates}
            />
          </div>
          {dateError && <p className="text-xs text-[#dc2626] mt-2">{dateError}</p>}
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">
            旅伴 {trip ? `(${trip.members.length})` : ''}
          </p>
          <div className="flex flex-col gap-3 mb-3">
            {trip?.members.map((member) => (
              <div key={member.email} className="flex items-center gap-3">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#e8edf2] flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-[#5a7a8a]">
                      {(member.display_name || member.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a2530] truncate">
                    {member.display_name || member.email}
                  </p>
                  {member.display_name && (
                    <p className="text-[11px] text-[#8fa0b0] truncate">{member.email}</p>
                  )}
                  {trip.owner_email === member.email && (
                    <p className="text-[10px] text-[#0077b6] font-semibold">主揪</p>
                  )}
                </div>
                {isOwner && member.email !== user?.email && (
                  <button
                    onClick={() => handleRemoveMember(member.email)}
                    disabled={removing === member.email}
                    className="text-[#dc2626] text-xs font-semibold shrink-0 disabled:opacity-40"
                  >
                    {removing === member.email ? '移除中' : '移除'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleCopyInvite}
            className="w-full bg-[#f0f4f8] text-[#0077b6] rounded-[8px] py-2.5 text-sm font-semibold active:opacity-70"
          >
            {copied ? '✓ 已複製連結' : '複製邀請連結'}
          </button>
        </section>

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">危險區</p>
          {isOwner ? (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '刪除中...' : '刪除旅程'}
            </button>
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

        <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
          <p className="text-xs font-semibold text-[#8fa0b0] mb-3">帳號</p>
          <div className="flex items-center gap-3 mb-4">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url as string} alt="" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-sm text-[#1a2530]">{user?.user_metadata?.full_name as string}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full bg-[#fee2e2] text-[#dc2626] rounded-[8px] py-2.5 text-sm font-semibold"
          >
            登出
          </button>
        </section>
      </main>
    </div>
  )
}
