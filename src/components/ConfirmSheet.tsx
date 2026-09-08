import { useState } from 'react'
import { BottomSheet } from './BottomSheet'

interface Props {
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
  /** When set, the confirm button unlocks only once the user types this exactly. */
  requireTypedText?: string
}

export function ConfirmSheet({
  title, description, confirmLabel, onConfirm, onCancel, destructive, requireTypedText,
}: Props) {
  const [typed, setTyped] = useState('')
  const locked = requireTypedText !== undefined && typed.trim() !== requireTypedText

  return (
    <BottomSheet
      label={title}
      onClose={onCancel}
      backdropTestId="confirm-backdrop"
      panelClassName="absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] max-w-lg mx-auto px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <p className="text-[15px] font-bold text-[#1a2530]">{title}</p>
      {description && <p className="text-xs text-[#52707f] mt-2 leading-relaxed">{description}</p>}

      {requireTypedText !== undefined && (
        <input
          aria-label="請輸入旅程名稱以確認"
          className="w-full border border-[#e8edf2] rounded-[8px] px-3 py-2 text-sm text-[#1a2530] mt-3"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onCancel}
          className="flex-1 border border-[#e8edf2] text-[#5a7a8a] rounded-[10px] py-2.5 text-sm font-semibold active:opacity-70"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={locked}
          className={`flex-1 rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-40 active:opacity-80 ${
            destructive ? 'bg-[#dc2626] text-white' : 'bg-[#0077b6] text-white'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
