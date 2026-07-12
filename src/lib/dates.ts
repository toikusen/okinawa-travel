const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function parse(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

/** '2026-10-12' → '10/12 (一)' */
export function fmtMD(dateStr: string): string {
  const d = parse(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`
}

/** '2026-10-12' → '10/12 一' (date chips) */
export function fmtChip(dateStr: string): string {
  const d = parse(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`
}

/** Local today as 'YYYY-MM-DD' */
export function todayStr(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Inclusive day count of a trip */
export function dayCount(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) + 1
}

export function daysUntil(start: string, today = todayStr()): number {
  return Math.round((parse(start).getTime() - parse(today).getTime()) / 86400000)
}

export type TripStatus = 'upcoming' | 'ongoing' | 'ended'

export function tripStatus(start: string, end: string, today = todayStr()): TripStatus {
  if (today < start) return 'upcoming'
  if (today > end) return 'ended'
  return 'ongoing'
}
