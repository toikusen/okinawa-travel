import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTrip } from '../hooks/useTrip'
import { updateTrip, removeMember } from '../lib/db'

const TRIP_ID_KEY = 'okinawa_trip_id'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const tripId = localStorage.getItem(TRIP_ID_KEY)
  const { trip } = useTrip(tripId)
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (trip?.name) setNameInput(trip.name)
  }, [trip?.name])

  const isOwner = trip?.owner_email === user?.email

  const handleSaveName = async () => {
    if (!tripId || !nameInput.trim()) return
    await updateTrip(tripId, { name: nameInput.trim() })
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
