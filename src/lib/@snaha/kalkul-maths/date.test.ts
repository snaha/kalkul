import { describe, expect, it } from 'vitest'

import { addDays, daysBetween, formatDate } from './date'

describe('#formatDate', () => {
  it('formats a date to yyyy-MM-dd', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(date)).toBe('2025-03-17')
  })
})

describe('#daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-01-01', '2026-07-02')).toBe(182)
  })

  it('is zero for the same day', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('is negative when the range runs backwards', () => {
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9)
  })

  it('is unaffected by a daylight-saving change in between', () => {
    // Europe/Prague springs forward on 2026-03-29; local-midnight timestamps
    // across it are a whole day minus an hour apart.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('counts a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })
})

describe('#addDays', () => {
  it('advances within a month', () => {
    expect(addDays('2026-01-01', 23)).toBe('2026-01-24')
  })

  it('rolls over a month boundary', () => {
    expect(addDays('2026-01-24', 23)).toBe('2026-02-16')
  })

  it('rolls over a year boundary', () => {
    expect(addDays('2025-12-30', 3)).toBe('2026-01-02')
  })

  it('returns the same day for zero', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15')
  })

  it('walks backwards for a negative count', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('crosses a daylight-saving change without losing a day', () => {
    // Europe/Prague springs forward on 2026-03-29. Adding 24-hour steps to a
    // local-midnight date would land at 23:00 the day before.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })

  it('counts a leap day', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
  })

  it('round-trips with daysBetween', () => {
    expect(daysBetween('2026-01-01', addDays('2026-01-01', 182))).toBe(182)
  })
})
