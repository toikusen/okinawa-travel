const FALLBACK_COLORS = [
  'var(--color-identity-1)',
  'var(--color-identity-2)',
  'var(--color-identity-3)',
  'var(--color-identity-4)',
  'var(--color-text-secondary)',
]

interface Props {
  members: { display_name: string; avatar_url: string }[]
  size?: number
  max?: number
}

export function AvatarStack({ members, size = 22, max = 4 }: Props) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length

  return (
    <div className="flex items-center" aria-label={`${members.length} 位旅伴`}>
      {shown.map((m, i) => {
        const style = {
          width: size,
          height: size,
          marginLeft: i === 0 ? 0 : -size * 0.28,
          fontSize: size * 0.45,
        }
        return m.avatar_url ? (
          <img
            key={i}
            src={m.avatar_url}
            alt={m.display_name}
            style={style}
            className="rounded-full border-2 border-white object-cover shrink-0"
          />
        ) : (
          <span
            key={i}
            style={{ ...style, background: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
            className="rounded-full border-2 border-white text-white font-bold flex items-center justify-center shrink-0"
          >
            {(m.display_name || '?').charAt(0).toUpperCase()}
          </span>
        )
      })}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -size * 0.28, fontSize: size * 0.4 }}
          className="rounded-full border-2 border-white bg-border text-text-secondary font-bold flex items-center justify-center shrink-0"
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
