import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateMyDisplayName } from '../lib/db'
import { toast } from '../lib/toast'
import { BottomSheet } from './BottomSheet'
import { SavedBadge } from './SavedBadge'

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, signOut } = useAuth()
  const currentName = (user?.user_metadata?.full_name as string) ?? ''
  const [name, setName] = useState(currentName)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>()

  // useAuth resolves the user async — sync the input once the name arrives
  useEffect(() => {
    setName(currentName)
  }, [currentName])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!user?.email || !trimmed || trimmed === currentName) return
    const ok = await updateMyDisplayName(user.email, trimmed)
    if (ok) {
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } else {
      toast('名稱儲存失敗,請再試一次')
    }
  }

  return (
    <BottomSheet
      label="帳號設定"
      onClose={onClose}
      backdropTestId="account-sheet-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] max-w-lg mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center gap-3 mb-4">
        {user?.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url as string} alt="" className="w-10 h-10 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-strong">帳號設定</p>
          <p className="text-xs text-text-label truncate">{user?.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <label htmlFor="account-name" className="text-xs font-semibold text-text-label">顯示名稱</label>
        {saved && <SavedBadge />}
      </div>
      <div className="flex gap-2">
        <input
          id="account-name"
          className="flex-1 min-w-0 border border-border rounded-[8px] px-3 py-2 text-sm text-text-strong"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={!name.trim() || name.trim() === currentName}
          className="shrink-0 bg-primary text-white rounded-[8px] px-4 text-sm font-semibold disabled:opacity-40 active:opacity-80"
        >
          儲存
        </button>
      </div>
      <p className="text-[11px] text-text-label mt-1.5">旅伴會在成員列表看到這個名稱。</p>

      <button
        onClick={signOut}
        className="w-full border border-border bg-white text-text-secondary rounded-[8px] py-2.5 text-sm font-semibold active:opacity-70 mt-5"
      >
        登出
      </button>
    </BottomSheet>
  )
}
