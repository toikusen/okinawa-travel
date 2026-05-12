import { useInstallPrompt } from '../hooks/useInstallPrompt'

export function InstallPrompt() {
  const { canInstall, install, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-white rounded-[12px] border border-[#e8edf2] shadow-lg px-4 py-3 flex items-center gap-3 z-40">
      <span className="text-2xl">🌺</span>
      <p className="flex-1 text-xs text-[#1a2530]">加入主畫面，隨時查看行程</p>
      <button onClick={dismiss} className="text-[#8fa0b0] text-xs shrink-0">
        略過
      </button>
      <button
        onClick={install}
        className="bg-[#0077b6] text-white text-xs font-semibold rounded-[8px] px-3 py-1.5 shrink-0"
      >
        安裝
      </button>
    </div>
  )
}
