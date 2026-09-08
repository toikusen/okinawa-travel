import { describe, it, expect } from 'vitest'
import { fmtMD, fmtChip, fmtRange, dayCount, daysUntil, tripStatus, todayStr, hhmm, sortTrips, mapsUrl, nowLineIndex, pickNow, scrollTargetEventId } from '../../lib/dates'

describe('dates', () => {
  it('formats YYYY-MM-DD as M/D (weekday)', () => {
    expect(fmtMD('2026-10-12')).toBe('10/12 (一)')
    expect(fmtChip('2026-10-12')).toBe('10/12 一')
  })

  it('formats ranges with year only when needed', () => {
    // current year: no year shown
    expect(fmtRange('2026-10-12', '2026-10-16', '2026-07-12')).toBe('10/12 (一) – 10/16 (五)')
    // other year: year on start
    expect(fmtRange('2027-10-12', '2027-10-16', '2026-07-12')).toBe('2027/10/12 (二) – 10/16 (六)')
    // cross-year: year on end (and start if not current year)
    expect(fmtRange('2026-12-30', '2027-01-02', '2026-07-12')).toBe('12/30 (三) – 2027/1/2 (六)')
    expect(fmtRange('2025-12-30', '2026-01-02', '2026-07-12')).toBe('2025/12/30 (二) – 2026/1/2 (五)')
  })

  it('counts trip days inclusively', () => {
    expect(dayCount('2026-10-12', '2026-10-16')).toBe(5)
    expect(dayCount('2026-08-01', '2026-08-01')).toBe(1)
  })

  it('computes days until start', () => {
    expect(daysUntil('2026-07-22', '2026-07-12')).toBe(10)
    expect(daysUntil('2026-07-12', '2026-07-12')).toBe(0)
  })

  it('classifies trip status relative to today', () => {
    expect(tripStatus('2026-08-01', '2026-08-05', '2026-07-12')).toBe('upcoming')
    expect(tripStatus('2026-07-10', '2026-07-14', '2026-07-12')).toBe('ongoing')
    expect(tripStatus('2026-07-10', '2026-07-12', '2026-07-12')).toBe('ongoing')
    expect(tripStatus('2026-06-01', '2026-06-05', '2026-07-12')).toBe('ended')
  })

  it('formats today as YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 6, 12))).toBe('2026-07-12')
  })

  it('hhmm zero-pads hours and minutes', () => {
    expect(hhmm(new Date('2026-10-12T09:05:00'))).toBe('09:05')
    expect(hhmm(new Date('2026-10-12T18:45:00'))).toBe('18:45')
  })

  it('mapsUrl encodes the location into a Google Maps search', () => {
    expect(mapsUrl('美麗海水族館')).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('美麗海水族館')
    )
  })
})

describe('sortTrips', () => {
  const t = (id: string, start: string, end: string) => ({ id, start_date: start, end_date: end })

  it('puts the soonest upcoming trip first', () => {
    const { upcoming } = sortTrips(
      [t('far', '2026-12-01', '2026-12-05'), t('soon', '2026-09-20', '2026-09-22')],
      '2026-09-08'
    )
    expect(upcoming.map(x => x.id)).toEqual(['soon', 'far'])
  })

  it('puts the most recently ended trip first', () => {
    const { ended } = sortTrips(
      [t('old', '2025-01-01', '2025-01-05'), t('recent', '2026-08-01', '2026-08-05')],
      '2026-09-08'
    )
    expect(ended.map(x => x.id)).toEqual(['recent', 'old'])
  })

  it('separates the ongoing trip from the rest', () => {
    const { ongoing, upcoming, ended } = sortTrips(
      [t('now', '2026-09-07', '2026-09-10'), t('later', '2026-10-01', '2026-10-03'), t('done', '2026-01-01', '2026-01-02')],
      '2026-09-08'
    )
    expect(ongoing.map(x => x.id)).toEqual(['now'])
    expect(upcoming.map(x => x.id)).toEqual(['later'])
    expect(ended.map(x => x.id)).toEqual(['done'])
  })
})

describe('nowLineIndex', () => {
  it('inserts after the last already-started event even when the list is out of time order', () => {
    // Dragged out of order: 14:00 sits before 09:00 in the list.
    const events = [{ time_start: '14:00' }, { time_start: '09:00' }, { time_start: '18:00' }]
    expect(nowLineIndex(events, '10:00')).toBe(2)
  })

  it('inserts at the front when nothing has started', () => {
    expect(nowLineIndex([{ time_start: '09:00' }, { time_start: '12:00' }], '08:00')).toBe(0)
  })

  it('inserts at the end when everything has started', () => {
    expect(nowLineIndex([{ time_start: '09:00' }, { time_start: '12:00' }], '23:00')).toBe(2)
  })

  it('ignores events without a start time', () => {
    expect(nowLineIndex([{ time_start: '' }, { time_start: '09:00' }], '10:00')).toBe(2)
  })
})

describe('pickNow', () => {
  const days = [
    { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 },
    { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 },
  ]
  const ev = (id: string, s: string, e: string) => ({
    id, type: 'shared' as const, title: id, time_start: s, time_end: e,
    location: '', notes: '', sort_order: 0,
  })

  it('returns the event spanning now as current and the rest of today as next', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '12:00'), ev('b', '12:30', '13:30'), ev('c', '14:00', '16:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.current.map(e => e.id)).toEqual(['a'])
    expect(result.next.map(e => e.id)).toEqual(['b', 'c'])
    expect(result.nextLabel).toBe('接下來')
  })

  it('caps next at three entries', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: ['b', 'c', 'd', 'e'].map((id, i) => ev(id, `1${i + 3}:00`, `1${i + 4}:00`)) },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.next).toHaveLength(3)
  })

  it('falls back to tomorrow when today has nothing left', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '10:00')], d2: [ev('t', '08:00', '09:00')] },
      now: new Date('2026-10-12T22:00:00'),
    })
    expect(result.current).toEqual([])
    expect(result.next.map(e => e.id)).toEqual(['t'])
    expect(result.nextLabel).toBe('明天')
  })

  it('lists every overlapping event as current', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '12:00'), ev('b', '09:30', '11:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.current.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('returns empty when today is not part of the trip', () => {
    const result = pickNow({ days, eventsByDay: {}, now: new Date('2026-11-01T10:00:00') })
    expect(result.current).toEqual([])
    expect(result.next).toEqual([])
  })

  it('keeps a running event as current while falling back to tomorrow for next', () => {
    const result = pickNow({
      days,
      eventsByDay: { d1: [ev('a', '09:00', '12:00')], d2: [ev('t', '08:00', '09:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(result.current.map(e => e.id)).toEqual(['a'])
    expect(result.next.map(e => e.id)).toEqual(['t'])
    expect(result.nextLabel).toBe('明天')
  })
})

describe('scrollTargetEventId', () => {
  const days = [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }]
  const ev = (id: string, s: string, e: string) => ({
    id, type: 'shared' as const, title: id, time_start: s, time_end: e,
    location: '', notes: '', sort_order: 0,
  })

  it('picks the first event that has not ended yet', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('done', '07:00', '08:00'), ev('live', '09:00', '12:00'), ev('later', '14:00', '16:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(target).toBe('live')
  })

  it('does not pick an event that already ended', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('morning', '07:00', '08:00'), ev('evening', '19:00', '21:00')] },
      now: new Date('2026-10-12T10:00:00'),
    })
    expect(target).toBe('evening')
  })

  it('falls back to the first event of today when all have ended', () => {
    const target = scrollTargetEventId({
      days,
      eventsByDay: { d1: [ev('a', '07:00', '08:00'), ev('b', '09:00', '10:00')] },
      now: new Date('2026-10-12T23:00:00'),
    })
    expect(target).toBe('a')
  })

  it('returns null when today is not part of the trip', () => {
    expect(scrollTargetEventId({ days, eventsByDay: {}, now: new Date('2026-11-01T10:00:00') })).toBeNull()
  })
})
