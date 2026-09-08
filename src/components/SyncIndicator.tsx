import type { SyncStatus } from '../hooks/useSyncStatus'

// Only speak up when something is wrong. A green "已同步" badge that is really
// just navigator.onLine was lying whenever the socket dropped.
const WARNINGS: Partial<Record<SyncStatus, string>> = {
  offline: '離線,只能檢視',
  error: '連線中斷,重新整理',
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  const text = WARNINGS[status]
  if (!text) return null

  return (
    <div className="flex items-center gap-1.5" role="status">
      <span className="w-2 h-2 rounded-full bg-[#dc2626] shrink-0" />
      <span className="text-[11px] text-[#dc2626] whitespace-nowrap">{text}</span>
    </div>
  )
}
