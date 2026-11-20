import { describe, expect, test } from 'vitest'

import { monthTicks, niceAxisBounds, tickStride } from './chart-axis'

describe('niceAxisBounds', () => {
  test('rounds the top of the axis up to a round step above the data', () => {
    // The dashboard case: a ~297K peak reads against 0–400K in 100K steps.
    expect(niceAxisBounds([15_000, 120_000, 297_000])).toEqual({
      min: 0,
      max: 400_000,
      ticks: [0, 100_000, 200_000, 300_000, 400_000],
    })
  })

  test('always returns the requested number of ticks', () => {
    expect(niceAxisBounds([0, 42], 5).ticks).toHaveLength(5)
    expect(niceAxisBounds([0, 42], 3).ticks).toHaveLength(3)
  })

  test('anchors the axis at zero so the area reads from the baseline', () => {
    expect(niceAxisBounds([80_000, 90_000]).min).toBe(0)
  })

  test('extends below zero for negative net worth and keeps zero on a tick', () => {
    const bounds = niceAxisBounds([-50_000, 100_000])
    expect(bounds.min).toBe(-50_000)
    expect(bounds.max).toBe(150_000)
    expect(bounds.ticks).toContain(0)
  })

  test('keeps the highest value inside the axis', () => {
    const bounds = niceAxisBounds([-30_000, 260_000])
    expect(bounds.max).toBeGreaterThanOrEqual(260_000)
    expect(bounds.min).toBeLessThanOrEqual(-30_000)
    expect(bounds.ticks).toContain(0)
  })

  test('falls back to a unit axis for an all-zero series', () => {
    expect(niceAxisBounds([0, 0])).toEqual({
      min: 0,
      max: 1,
      ticks: [0, 0.25, 0.5, 0.75, 1],
    })
  })

  test('falls back to a unit axis for an empty series', () => {
    expect(niceAxisBounds([]).max).toBe(1)
  })
})

describe('monthTicks', () => {
  test('returns the first of each month within the range', () => {
    expect(monthTicks('2025-12-15', '2026-03-04')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
  })

  test('includes a month start that coincides with the range start', () => {
    expect(monthTicks('2026-01-01', '2026-02-10')).toEqual(['2026-01-01', '2026-02-01'])
  })

  test('returns nothing when the range spans no month boundary', () => {
    expect(monthTicks('2026-01-05', '2026-01-28')).toEqual([])
  })

  test('crosses a year boundary', () => {
    expect(monthTicks('2025-11-20', '2026-01-10')).toEqual(['2025-12-01', '2026-01-01'])
  })

  test('returns nothing when the range is inverted', () => {
    expect(monthTicks('2026-03-01', '2026-01-01')).toEqual([])
  })
})

describe('tickStride', () => {
  test('six months on a desktop dashboard chart show every second month', () => {
    // 562px fits four labels; Dec to May is six ticks: Dec, Feb, Apr.
    expect(tickStride(6, 562)).toBe(2)
  })

  test('a phone-width chart keeps two month labels', () => {
    expect(tickStride(6, 280)).toBe(3)
  })

  test('a wide chart never shows more than four month labels', () => {
    expect(tickStride(12, 2000)).toBe(3)
  })

  test('a six-year history widens the interval past four months', () => {
    expect(tickStride(72, 900)).toBe(18)
  })

  test('a short history shows every month', () => {
    expect(tickStride(3, 562)).toBe(1)
  })

  test('an unmeasured chart or an empty history still yields a stride', () => {
    expect(tickStride(6, 0)).toBe(6)
    expect(tickStride(0, 562)).toBe(1)
  })
})
