/** Brand mark: 旅 on a rounded blue tile, app-icon style. */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.5, borderRadius: size * 0.26 }}
      className="bg-[#0077b6] text-white flex items-center justify-center font-bold select-none shadow-[0_2px_8px_rgba(0,119,182,0.25)]"
    >
      旅
    </div>
  )
}
