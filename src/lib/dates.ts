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

/** Date range; year shown only when it disambiguates:
 *  current year:  '10/12 (一) – 10/15 (四)'
 *  other year:    '2027/10/12 (一) – 10/15 (四)'
 *  cross-year:    '12/30 (三) – 2027/1/2 (六)' */
export function fmtRange(start: string, end: string, today = todayStr()): string {
  const startYear = start.slice(0, 4)
  const endYear = end.slice(0, 4)
  const s = (startYear !== today.slice(0, 4) ? startYear + '/' : '') + fmtMD(start)
  const e = (endYear !== startYear ? endYear + '/' : '') + fmtMD(end)
  return `${s} – ${e}`
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
