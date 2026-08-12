import { describe, expect, it } from 'vitest'

import { daysBetween, formatDate } from './date'

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
