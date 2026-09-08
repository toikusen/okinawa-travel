import { useState } from 'react'
import { removeMember } from '../lib/db'
import { toast } from '../lib/toast'
import { useInviteLink } from '../hooks/useInviteLink'
import type { Trip } from '../types'

interface Props {
  trip: Trip
  currentEmail?: string
}

export function MembersSection({ trip, currentEmail }: Props) {
  const { copied, share: handleShare, copy: handleCopy } = useInviteLink(trip)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const isOwner = trip.owner_email === currentEmail

  const handleRemove = async (email: string) => {
    if (confirming !== email) {
      setConfirming(email)
      return
    }
    setConfirming(null)
    setRemoving(email)
    const ok = await removeMember(trip.id, email)
    setRemoving(null)
    if (!ok) toast('移除失敗,請再試一次')
  }

  return (
    <section className="bg-white rounded-[12px] p-4 border border-[#e8edf2]">
      <p className="text-xs font-semibold text-[#52707f] mb-3">旅伴 ({trip.members.length})</p>
      <div className="flex flex-col gap-3 mb-3">
        {trip.members.map((member) => (
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
                <p className="text-[11px] text-[#52707f] truncate">{member.email}</p>
              )}
              {trip.owner_email === member.email && (
                <p className="text-[10px] text-[#0077b6] font-semibold">主揪</p>
              )}
            </div>
            {isOwner && member.email !== currentEmail && (
              <button
                onClick={() => handleRemove(member.email)}
                disabled={removing === member.email}
                className={`text-xs font-semibold shrink-0 disabled:opacity-40 px-2 py-1 rounded-[6px] ${
                  confirming === member.email
                    ? 'text-white bg-[#dc2626]'
                    : 'text-[#52707f]'
                }`}
              >
                {removing === member.email ? '移除中' : confirming === member.email ? '確認移除?' : '移除'}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 bg-[#0077b6] text-white rounded-[8px] py-2.5 text-sm font-semibold active:opacity-80"
        >
          分享邀請連結
        </button>
        <button
          onClick={handleCopy}
          aria-label="複製邀請連結"
          className="w-11 bg-[#f0f4f8] text-[#0077b6] rounded-[8px] flex items-center justify-center active:opacity-70"
        >
          {copied ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </section>
  )
}
