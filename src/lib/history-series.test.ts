import { describe, expect, test } from 'vitest'

import {
  type HistoryPoint,
  buildHistorySeries,
  hasHistoryToShow,
  historyInRange,
} from './history-series'
import type { Profile, Snapshot } from './schemas'

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
    expect(series[0]).toMatchObject({ date: '2026-01-01', netWorth: 110_000, projected: false })
    expect(series).toHaveLength(9)
    expect(series.slice(1).every((point) => point.projected)).toBe(true)
    expect(series.at(-1)?.date).toBe('2026-07-02')
  })

  test('each sample compounds from the recorded baseline', () => {
    // 100,000 × 1.1^(days/365.25) + 10,000 cash, rounded to the cent.
    const series = buildHistorySeries(GROWING, TODAY)
    expect(series.map((point) => point.netWorth)).toEqual([
      110_000, 110_602, 111_208, 111_790, 112_403, 113_019, 113_640, 114_236, 114_864,
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
    expect(recorded).toMatchObject([
      { date: '2026-01-01', netWorth: 10_000, projected: false },
      { date: '2026-03-01', netWorth: 12_000, projected: false },
    ])
  })

  test('does not project when the last snapshot is today', () => {
    const profile: Profile = { ...GROWING, snapshots: [{ date: '2026-07-02', cash_amount: 500 }] }
    expect(buildHistorySeries(profile, TODAY)).toMatchObject([
      { date: '2026-07-02', netWorth: 500, projected: false },
    ])
  })

  test('returns a single actual point when there are no snapshots yet', () => {
    const { snapshots: _snapshots, ...noHistory } = GROWING
    expect(buildHistorySeries(noHistory, TODAY)).toMatchObject([
      { date: '2026-07-02', netWorth: 110_000, projected: false },
    ])
  })

  test('returns nothing for a profile with no financial data', () => {
    expect(buildHistorySeries({ name: '', email: '' }, TODAY)).toEqual([])
  })
})

describe('buildHistorySeries figures', () => {
  const JANUARY: Snapshot = {
    date: '2026-01-01',
    cash_amount: 10_000,
    investments: [{ id: 'inv1', balance: 100_000 }],
    tangible_assets: [],
    liabilities: [],
    incomes: [{ id: 'inc1', amount: 4_000, frequency: 'monthly' }],
    expenses: [{ id: 'exp1', amount: 3_000, frequency: 'monthly' }],
  }
  const APRIL: Snapshot = {
    ...JANUARY,
    date: '2026-04-01',
    cash_amount: 12_000,
    investments: [{ id: 'inv1', balance: 105_000 }],
    expenses: [{ id: 'exp1', amount: 3_400, frequency: 'monthly' }],
  }
  /** Stored as of April; 0 % APY so nothing moves between readings. */
  const PROFILE: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 12_000,
    investments: [{ id: 'inv1', name: 'ETF', balance: 105_000, apy: 0 }],
    incomes: [
      { id: 'inc1', name: 'Salary', amount: 4_000, schedule: 'recurring', frequency: 'monthly' },
    ],
    expenses: [
      { id: 'exp1', name: 'Rent', amount: 3_400, schedule: 'recurring', frequency: 'monthly' },
    ],
    snapshots: [JANUARY, APRIL],
  }
  const APRIL_FIRST = new Date(2026, 3, 1)

  test('each recorded point carries its net worth, runway and FI', () => {
    const [january, april] = buildHistorySeries(PROFILE, APRIL_FIRST)
    expect(january).toMatchObject({
      date: '2026-01-01',
      netWorth: 110_000,
      // 110,000 / 3,000 a month = 36.7 months
      runwayYears: expect.closeTo(3.06, 2),
      // FI number 3,000 × 12 / 4 % = 900,000; cash + investments 110,000 of it
      fiPercent: expect.closeTo(12.22, 2),
      projected: false,
    })
    expect(april).toMatchObject({
      date: '2026-04-01',
      netWorth: 117_000,
      // 117,000 / 3,400 a month = 34.4 months
      runwayYears: expect.closeTo(2.87, 2),
      // 3,400 × 12 / 4 % = 1,020,000; 117,000 of it
      fiPercent: expect.closeTo(11.47, 2),
      projected: false,
    })
  })

  test('each point breaks its net worth down by category, asset debt under liabilities', () => {
    const snapshot: Snapshot = {
      date: '2026-04-01',
      cash_amount: 12_000,
      investments: [{ id: 'inv1', balance: 105_000 }],
      tangible_assets: [{ id: 'home', value: 300_000, outstanding_balance: 200_000 }],
      liabilities: [{ id: 'loan', outstanding_balance: 5_000 }],
    }
    const [point] = buildHistorySeries({ ...PROFILE, snapshots: [snapshot] }, APRIL_FIRST)
    expect(point).toMatchObject({
      cash: 12_000,
      investments: 105_000,
      tangibleAssets: 300_000,
      liabilities: 205_000,
      netWorth: 212_000,
    })
  })
})

describe('hasHistoryToShow', () => {
  const EMPTY: Profile = { name: 'Alice', email: 'a@example.com' }

  test('is true for a profile with balances', () => {
    expect(hasHistoryToShow({ ...EMPTY, cash_amount: 100 })).toBe(true)
  })

  test('is true for a spent-out profile that still has recorded snapshots', () => {
    // Going to zero is recorded deliberately, so the history has to stay
    // reachable — gating on balances alone hid the page the moment the last
    // one was spent.
    expect(
      hasHistoryToShow({ ...EMPTY, cash_amount: 0, snapshots: [{ date: '2026-01-01' }] }),
    ).toBe(true)
  })

  test('is false for a profile with neither', () => {
    expect(hasHistoryToShow(EMPTY)).toBe(false)
    expect(hasHistoryToShow({ ...EMPTY, snapshots: [] })).toBe(false)
  })
})

describe('historyInRange', () => {
  const point = (date: string): HistoryPoint => ({
    date,
    netWorth: 0,
    cash: 0,
    investments: 0,
    tangibleAssets: 0,
    liabilities: 0,
    projected: false,
  })
  const POINTS = [
    '2024-07-01',
    '2024-07-02',
    '2025-07-02',
    '2026-04-01',
    '2026-06-02',
    '2026-07-02',
  ].map(point)
  const dates = (range: Parameters<typeof historyInRange>[1]) =>
    historyInRange(POINTS, range, '2026-07-02').map((p) => p.date)

  test('all keeps every point', () => {
    expect(dates('all')).toHaveLength(6)
  })

  test('a range keeps the points back to the same day that many months ago, inclusive', () => {
    expect(dates('1m')).toEqual(['2026-06-02', '2026-07-02'])
    expect(dates('3m')).toEqual(['2026-06-02', '2026-07-02'])
    expect(dates('6m')).toEqual(['2026-04-01', '2026-06-02', '2026-07-02'])
    expect(dates('1y')).toEqual(['2025-07-02', '2026-04-01', '2026-06-02', '2026-07-02'])
    expect(dates('2y')).toEqual([
      '2024-07-02',
      '2025-07-02',
      '2026-04-01',
      '2026-06-02',
      '2026-07-02',
    ])
  })
})
