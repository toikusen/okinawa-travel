import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { Logo } from './Logo'

export function InstallPrompt() {
  const { canInstall, install, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-4 right-4 max-w-lg mx-auto bg-white rounded-[12px] border border-border shadow-lg px-4 py-3 flex items-center gap-3 z-40">
      <Logo size={32} />
      <p className="flex-1 text-xs text-text-strong">加入主畫面，隨時查看行程</p>
      <button onClick={dismiss} className="text-text-label text-xs shrink-0">
        略過
      </button>
      <button
        onClick={install}
        className="bg-primary text-white text-xs font-semibold rounded-[8px] px-3 py-1.5 shrink-0"
      >
        安裝
      </button>
    </div>
  )
}
