import { Icon } from './Icon'

export function SavedBadge() {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
      <Icon name="check" size={12} />
      已儲存
    </span>
  )
}
