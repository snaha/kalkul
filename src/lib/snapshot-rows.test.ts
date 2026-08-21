import { describe, expect, test } from 'vitest'

import type { Profile } from './schemas'
import { buildSnapshotRows } from './snapshot-rows'
import { captureSnapshot } from './snapshots'

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 20_000,
  investments: [{ id: 'inv1', name: 'ETF', balance: 80_000, apy: 5 }],
  tangible_assets: [
    {
      id: 't1',
      name: 'House',
      value: 200_000,
      status: 'financed',
      outstanding_balance: 100_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 1_000,
      remaining_term: 20,
    },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Card',
      outstanding_balance: 5_000,
      installment_frequency: 'monthly',
      annual_rate: 15,
      installment_amount: 250,
      remaining_term: 2,
    },
  ],
  expenses: [
    {
      id: 'e1',
      name: 'Living',
      amount: 1_000,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
}

describe('buildSnapshotRows', () => {
  test('reports each snapshot, newest first', () => {
    const profile: Profile = {
      ...PROFILE,
      snapshots: [
        captureSnapshot(PROFILE, '2026-01-01'),
        captureSnapshot(PROFILE, '2026-06-01'),
        captureSnapshot(PROFILE, '2026-03-01'),
      ],
    }
    expect(buildSnapshotRows(profile).map((r) => r.date)).toEqual([
      '2026-06-01',
      '2026-03-01',
      '2026-01-01',
    ])
  })

  test('totals the assets, debt and net worth recorded on the date', () => {
    const profile: Profile = { ...PROFILE, snapshots: [captureSnapshot(PROFILE, '2026-06-01')] }
    expect(buildSnapshotRows(profile)[0]).toMatchObject({
      // 20,000 cash + 80,000 investments + 200,000 house
      totalAssets: 300_000,
      // 5,000 card + 100,000 mortgage
      liabilities: 105_000,
      netWorth: 195_000,
    })
  })

  test('reads each row from its own snapshot, not from the profile', () => {
    const past: Profile = { ...PROFILE, cash_amount: 1_000 }
    const profile: Profile = {
      ...PROFILE,
      snapshots: [captureSnapshot(past, '2026-01-01'), captureSnapshot(PROFILE, '2026-06-01')],
    }
    const [newest, oldest] = buildSnapshotRows(profile)
    expect(newest.totalAssets).toBe(300_000)
    expect(oldest.totalAssets).toBe(281_000)
  })

  test('states financial independence against the outflows of the day', () => {
    const profile: Profile = { ...PROFILE, snapshots: [captureSnapshot(PROFILE, '2026-06-01')] }
    // Investable net worth 20,000 + 80,000 − 5,000 = 95,000, against yearly
    // outflows of 12,000 living + 12,000 mortgage + 3,000 card = 27,000.
    // 95,000 / (27,000 × 25) = 14.074…%
    expect(buildSnapshotRows(profile)[0].fiPercent).toBeCloseTo(14.0741, 4)
  })

  test('leaves financial independence undefined when nothing flows out', () => {
    const noOutflows: Profile = {
      name: '',
      email: '',
      cash_amount: 1_000,
    }
    const profile: Profile = {
      ...noOutflows,
      snapshots: [captureSnapshot(noOutflows, '2026-06-01')],
    }
    expect(buildSnapshotRows(profile)[0].fiPercent).toBeUndefined()
  })

  test('is empty for a profile with no history', () => {
    expect(buildSnapshotRows(PROFILE)).toEqual([])
  })
})
