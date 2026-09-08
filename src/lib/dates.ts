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

/** Date → 'HH:MM' */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Group trips by status, each group ordered the way a traveller reads it:
 *  ongoing and upcoming soonest-first, ended most-recent-first. */
export function sortTrips<T extends { start_date: string; end_date: string }>(
  trips: T[],
  today = todayStr()
): { ongoing: T[]; upcoming: T[]; ended: T[] } {
  const ongoing: T[] = []
  const upcoming: T[] = []
  const ended: T[] = []

  for (const trip of trips) {
    const bucket = { ongoing, upcoming, ended }[tripStatus(trip.start_date, trip.end_date, today)]
    bucket.push(trip)
  }

  ongoing.sort((a, b) => a.start_date.localeCompare(b.start_date))
  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date))
  ended.sort((a, b) => b.end_date.localeCompare(a.end_date))

  return { ongoing, upcoming, ended }
}

/** Google Maps search link for a free-text place name. */
export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
