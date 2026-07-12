import { describe, it, expect } from 'vitest'
import { fmtMD, fmtChip, fmtRange, dayCount, daysUntil, tripStatus, todayStr } from '../../lib/dates'

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
})
