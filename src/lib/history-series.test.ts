import { describe, expect, test } from 'vitest'

import { buildHistorySeries } from './history-series'
import type { Profile } from './schemas'

// Snapshot on 2026-01-01, read on 2026-07-02 — 182 elapsed days.
const TODAY = new Date(2026, 6, 2)

/** Growth from investments alone, so the tail is a clean compounding curve. */
const GROWING: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 10_000,
  investments: [{ id: 'inv1', name: 'ETF', balance: 100_000, apy: 10 }],
  snapshots: [
    {
      date: '2026-01-01',
      cash_amount: 10_000,
      investments: [{ id: 'inv1', balance: 100_000 }],
      tangible_assets: [],
      liabilities: [],
    },
  ],
}

describe('buildHistorySeries', () => {
  test('samples the projection between the last snapshot and today', () => {
    const series = buildHistorySeries(GROWING, TODAY)

    // One recorded point, then the tail: 8 samples ending on today.
    expect(series[0]).toEqual({ date: '2026-01-01', netWorth: 110_000, projected: false })
    expect(series).toHaveLength(9)
    expect(series.slice(1).every((point) => point.projected)).toBe(true)
    expect(series.at(-1)?.date).toBe('2026-07-02')
  })

  test('each sample compounds from the recorded baseline', () => {
    // 100,000 × 1.1^(days/365.25) + 10,000 cash, rounded to the cent.
    const series = buildHistorySeries(GROWING, TODAY)
    expect(series.map((point) => point.netWorth)).toEqual([
      110_000, 110_601.98, 111_207.58, 111_790.26, 112_403.02, 113_019.46, 113_639.62, 114_236.3,
      114_863.78,
    ])
  })

  test('the tail curves rather than running straight to the endpoint', () => {
    // A straight line between the tail's ends would sit above a compounding
    // curve at every point in between — that gap is the whole reason for
    // sampling instead of drawing one segment.
    const series = buildHistorySeries(GROWING, TODAY)
    const start = series[0].netWorth
    const end = series[series.length - 1].netWorth
    const middle = series[4].netWorth

    expect(middle).toBeLessThan((start + end) / 2)
    expect(middle).toBeGreaterThan(start)
  })

  test('dates advance evenly and stay within the window', () => {
    const dates = buildHistorySeries(GROWING, TODAY).map((point) => point.date)
    expect(dates).toEqual([
      '2026-01-01',
      '2026-01-24',
      '2026-02-16',
      '2026-03-10',
      '2026-04-02',
      '2026-04-25',
      '2026-05-18',
      '2026-06-09',
      '2026-07-02',
    ])
  })

  test('records a flat tail when nothing grows or accrues', () => {
    const idle: Profile = {
      name: 'Bob',
      email: 'b@example.com',
      cash_amount: 1_000,
      snapshots: [{ date: '2026-01-01', cash_amount: 1_000 }],
    }
    const series = buildHistorySeries(idle, TODAY)
    expect(new Set(series.map((point) => point.netWorth))).toEqual(new Set([1_000]))
  })

  test('never samples more often than once a day', () => {
    const profile: Profile = {
      ...GROWING,
      snapshots: [{ ...GROWING.snapshots![0], date: '2026-06-30' }],
    }
    // Two elapsed days cannot carry eight samples.
    const series = buildHistorySeries(profile, TODAY)
    expect(series.map((point) => point.date)).toEqual(['2026-06-30', '2026-07-01', '2026-07-02'])
  })

  test('plots one point per recorded snapshot before the tail', () => {
    const profile: Profile = {
      ...GROWING,
      snapshots: [
        { date: '2026-01-01', cash_amount: 10_000 },
        { date: '2026-03-01', cash_amount: 12_000 },
      ],
    }
    const series = buildHistorySeries(profile, TODAY)
    expect(series.filter((point) => !point.projected).map((point) => point.netWorth)).toEqual([
      10_000, 12_000,
    ])
  })

  test('plots an unsorted history in date order', () => {
    // Only the schema sorts what it stores, so a hand-edited backup can arrive
    // out of order. The last point is the baseline the tail projects from, and
    // the chart draws the points in the order it gets them.
    const profile: Profile = {
      ...GROWING,
      snapshots: [
        { date: '2026-03-01', cash_amount: 12_000 },
        { date: '2026-01-01', cash_amount: 10_000 },
      ],
    }
    const recorded = buildHistorySeries(profile, TODAY).filter((point) => !point.projected)
    expect(recorded).toEqual([
      { date: '2026-01-01', netWorth: 10_000, projected: false },
      { date: '2026-03-01', netWorth: 12_000, projected: false },
    ])
  })

  test('does not project when the last snapshot is today', () => {
    const profile: Profile = { ...GROWING, snapshots: [{ date: '2026-07-02', cash_amount: 500 }] }
    expect(buildHistorySeries(profile, TODAY)).toEqual([
      { date: '2026-07-02', netWorth: 500, projected: false },
    ])
  })

  test('returns a single actual point when there are no snapshots yet', () => {
    const { snapshots: _snapshots, ...noHistory } = GROWING
    expect(buildHistorySeries(noHistory, TODAY)).toEqual([
      { date: '2026-07-02', netWorth: 110_000, projected: false },
    ])
  })

  test('returns nothing for a profile with no financial data', () => {
    expect(buildHistorySeries({ name: '', email: '' }, TODAY)).toEqual([])
  })
})
