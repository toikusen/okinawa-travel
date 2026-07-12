/** Brand mark: lowercase t with a companion pin on a rounded blue tile (design 3c). */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      className="bg-[#0077b6] flex items-center justify-center select-none shadow-[0_2px_8px_rgba(0,119,182,0.25)]"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 48 48" fill="none">
        <path
          d="M33 12c4.4 0 8 3.6 8 8 0 6-8 13.5-8 13.5S25 26 25 20c0-4.4 3.6-8 8-8z"
          fill="#fff"
          opacity=".45"
        />
        <path
          d="M15 7v21c0 4.7 3.3 7.5 8 7.5 2.3 0 4.2-.65 5.6-1.9"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M7 15.5h18" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  )
}
