import { describe, expect, it } from 'vitest'

import { calculatePeriodDifference, formatDate, incrementDate } from './date'

describe('#formatDate', () => {
  it('formats a date to yyyy-MM-dd', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(date)).toBe('2025-03-17')
  })
})

describe('#incrementDate', () => {
  it('increments a date by days', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(incrementDate(date, 'day', 5))).toBe('2025-03-22')
  })

  it('increments a date by weeks', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(incrementDate(date, 'week', 2))).toBe('2025-03-31')
  })

  it('increments a date by months', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(incrementDate(date, 'month', 3))).toBe('2025-06-17')
  })

  it('increments a date by years', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(incrementDate(date, 'year', 1))).toBe('2026-03-17')
  })
})

describe('#calculatePeriodDifference', () => {
  it('calculates difference in days', () => {
    const startDate = new Date(2024, 0, 1) // Jan 1, 2024
    const endDate = new Date(2024, 0, 10) // Jan 10, 2024
    expect(calculatePeriodDifference(endDate, startDate, 'day')).toBe(9)
  })

  it('calculates difference in weeks', () => {
    const startDate = new Date(2024, 0, 1) // Jan 1, 2024
    const endDate = new Date(2024, 1, 1) // Feb 1, 2024
    expect(calculatePeriodDifference(endDate, startDate, 'week')).toBe(4)
  })

  it('calculates difference in months', () => {
    const startDate = new Date(2024, 0, 1) // Jan 1, 2024
    const endDate = new Date(2024, 3, 1) // Apr 1, 2024
    expect(calculatePeriodDifference(endDate, startDate, 'month')).toBe(3)
  })

  it('calculates difference in years', () => {
    const startDate = new Date(2024, 0, 1) // Jan 1, 2024
    const endDate = new Date(2026, 0, 1) // Jan 1, 2026
    expect(calculatePeriodDifference(endDate, startDate, 'year')).toBe(2)
  })

  it('throws error for invalid period', () => {
    const startDate = new Date(2024, 0, 1)
    const endDate = new Date(2024, 0, 10)
    expect(() => calculatePeriodDifference(endDate, startDate, 'invalid' as never)).toThrow(
      'invalidTransactionRepeatUnit',
    )
  })

  it('handles same dates', () => {
    const date = new Date(2024, 0, 1)
    expect(calculatePeriodDifference(date, date, 'day')).toBe(0)
    expect(calculatePeriodDifference(date, date, 'month')).toBe(0)
    expect(calculatePeriodDifference(date, date, 'year')).toBe(0)
  })

  it('handles negative differences (end before start)', () => {
    const startDate = new Date(2024, 0, 10)
    const endDate = new Date(2024, 0, 1)
    expect(calculatePeriodDifference(endDate, startDate, 'day')).toBe(-9)
  })
})
