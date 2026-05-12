import type { SyncStatus } from '../hooks/useSyncStatus'

const config: Record<SyncStatus, { dot: string; text: string; pulse: boolean }> = {
  synced:  { dot: 'bg-green-500',  text: '已同步',    pulse: false },
  syncing: { dot: 'bg-yellow-400', text: '同步中...', pulse: true  },
  offline: { dot: 'bg-red-500',    text: '離線模式',  pulse: false },
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  const { dot, text, pulse } = config[status]
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-[11px] text-[#5a7a8a]">{text}</span>
    </div>
  )
}
