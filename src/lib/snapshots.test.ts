import { describe, expect, test } from 'vitest'

import type { Profile, Snapshot } from './schemas'
import {
  captureSnapshot,
  hasSameBalances,
  latestSnapshot,
  snapshotNetWorth,
  upsertSnapshot,
  withSeededSnapshot,
} from './snapshots'

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 15_000,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 100_000, apy: 5 },
    { id: 'inv2', name: 'Bonds', balance: 78_000, apy: 2 },
  ],
  tangible_assets: [
    { id: 't1', name: 'Car', value: 20_000, status: 'fully_owned' },
    {
      id: 't2',
      name: 'House',
      value: 170_000,
      status: 'financed',
      outstanding_balance: 80_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 700,
      remaining_term: 20,
    },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Car loan',
      outstanding_balance: 6_000,
      installment_frequency: 'monthly',
      annual_rate: 5,
      installment_amount: 200,
      remaining_term: 3,
    },
  ],
}

describe('captureSnapshot', () => {
  test('records every balance that makes up net worth', () => {
    expect(captureSnapshot(PROFILE, '2026-04-27')).toEqual({
      date: '2026-04-27',
      cash_amount: 15_000,
      investments: [
        { id: 'inv1', balance: 100_000 },
        { id: 'inv2', balance: 78_000 },
      ],
      tangible_assets: [
        { id: 't1', value: 20_000, outstanding_balance: undefined },
        { id: 't2', value: 170_000, outstanding_balance: 80_000 },
      ],
      liabilities: [{ id: 'l1', outstanding_balance: 6_000 }],
    })
  })

  test('captures an empty profile as zero cash and empty lists', () => {
    expect(captureSnapshot({ name: '', email: '' }, '2026-04-27')).toEqual({
      date: '2026-04-27',
      cash_amount: 0,
      investments: [],
      tangible_assets: [],
      liabilities: [],
    })
  })
})

describe('snapshotNetWorth', () => {
  test('sums assets and subtracts both standalone and financed-asset debt', () => {
    // 15,000 + 178,000 + 190,000 − (6,000 + 80,000)
    expect(snapshotNetWorth(captureSnapshot(PROFILE, '2026-04-27'))).toBe(297_000)
  })

  test('is zero for a snapshot with no balances', () => {
    expect(snapshotNetWorth({ date: '2026-04-27' })).toBe(0)
  })
})

describe('upsertSnapshot', () => {
  const a: Snapshot = { date: '2026-01-01', cash_amount: 100 }
  const b: Snapshot = { date: '2026-03-01', cash_amount: 300 }

  test('appends a new date and keeps the list sorted by date', () => {
    const result = upsertSnapshot([b, a], { date: '2026-02-01', cash_amount: 200 })
    expect(result.map((s) => s.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  test('replaces an existing snapshot with the same date', () => {
    const result = upsertSnapshot([a, b], { date: '2026-03-01', cash_amount: 999 })
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ date: '2026-03-01', cash_amount: 999 })
  })

  test('treats a missing list as empty', () => {
    expect(upsertSnapshot(undefined, a)).toEqual([a])
  })

  test('does not mutate the input list', () => {
    const input = [a]
    upsertSnapshot(input, b)
    expect(input).toEqual([a])
  })
})

describe('latestSnapshot', () => {
  test('returns the snapshot with the most recent date', () => {
    const snapshots: Snapshot[] = [
      { date: '2026-01-01' },
      { date: '2026-03-01' },
      { date: '2026-02-01' },
    ]
    expect(latestSnapshot(snapshots)?.date).toBe('2026-03-01')
  })

  test('returns undefined when there are no snapshots', () => {
    expect(latestSnapshot(undefined)).toBeUndefined()
    expect(latestSnapshot([])).toBeUndefined()
  })
})

describe('hasSameBalances', () => {
  test('ignores the date when comparing', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot(PROFILE, '2026-06-01')
    expect(hasSameBalances(one, two)).toBe(true)
  })

  test('detects a changed balance', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot({ ...PROFILE, cash_amount: 15_001 }, '2026-01-01')
    expect(hasSameBalances(one, two)).toBe(false)
  })

  test('detects an added item', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot(
      {
        ...PROFILE,
        investments: [
          ...(PROFILE.investments ?? []),
          { id: 'inv3', name: 'x', balance: 1, apy: 0 },
        ],
      },
      '2026-01-01',
    )
    expect(hasSameBalances(one, two)).toBe(false)
  })

  test('treats a missing snapshot as different', () => {
    expect(hasSameBalances(undefined, captureSnapshot(PROFILE, '2026-01-01'))).toBe(false)
  })
})

describe('withSeededSnapshot', () => {
  const asOf = new Date(2026, 3, 27) // 2026-04-27

  test('gives a profile with no history a baseline dated asOf', () => {
    const seeded = withSeededSnapshot(PROFILE, asOf)
    expect(seeded.snapshots).toEqual([captureSnapshot(PROFILE, '2026-04-27')])
  })

  test('leaves an existing history untouched', () => {
    const profile: Profile = { ...PROFILE, snapshots: [{ date: '2020-01-01' }] }
    expect(withSeededSnapshot(profile, asOf)).toBe(profile)
  })

  test('records nothing for a profile with no balances', () => {
    const profile: Profile = { name: '', email: '' }
    expect(withSeededSnapshot(profile, asOf).snapshots).toBeUndefined()
  })
})
