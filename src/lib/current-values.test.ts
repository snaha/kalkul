import { describe, expect, test } from 'vitest'

import { getCurrentProfile, percentChange } from './current-values'
import type { Profile } from './schemas'

// Snapshot on 2026-01-01, read on 2026-07-02 — 182 days, 0.4982888 of a year.
const SNAPSHOT_DATE = '2026-01-01'
const TODAY = new Date(2026, 6, 2)

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 15_000,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 100_000, apy: 10 },
    { id: 'inv2', name: 'Fund', balance: 50_000, apy: 8, ter: 0.5 },
  ],
  incomes: [
    {
      id: 'i1',
      name: 'Salary',
      amount: 5_000,
      frequency: 'monthly',
      withhold_taxes: false,
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
  expenses: [
    {
      id: 'e1',
      name: 'Living',
      amount: 3_000,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
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
  snapshots: [{ date: SNAPSHOT_DATE, cash_amount: 15_000 }],
}

describe('getCurrentProfile', () => {
  test('compounds each investment at its effective APY over the elapsed fraction of a year', () => {
    const current = getCurrentProfile(PROFILE, TODAY)
    expect(current.investments?.[0].balance).toBeCloseTo(104_863.78, 2)
    // 8% APY minus a 0.5% TER compounds at 7.5%.
    expect(current.investments?.[1].balance).toBeCloseTo(51_834.69, 2)
  })

  test('accrues cash at income minus expenses minus debt service', () => {
    // (60,000 − 36,000 − 2,400) × 0.4982888 added to 15,000.
    expect(getCurrentProfile(PROFILE, TODAY).cash_amount).toBeCloseTo(25_763.04, 2)
  })

  test('rounds projected balances to the cent', () => {
    // Compounding a fraction of a year otherwise leaves a long tail of digits
    // that would show up verbatim in the Quick update inputs.
    const current = getCurrentProfile(PROFILE, TODAY)
    expect(current.cash_amount).toBe(25_763.04)
    expect(current.investments?.[0].balance).toBe(104_863.78)
  })

  test('leaves tangible assets and liabilities untouched', () => {
    const profile: Profile = {
      ...PROFILE,
      tangible_assets: [{ id: 't1', name: 'Car', value: 20_000, status: 'fully_owned' }],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.tangible_assets).toEqual(profile.tangible_assets)
    expect(current.liabilities).toEqual(profile.liabilities)
  })

  test('returns the profile unchanged when the latest snapshot is today', () => {
    const profile: Profile = { ...PROFILE, snapshots: [{ date: '2026-07-02' }] }
    expect(getCurrentProfile(profile, TODAY)).toEqual(profile)
  })

  test('returns the profile unchanged when there are no snapshots', () => {
    const { snapshots: _snapshots, ...withoutSnapshots } = PROFILE
    expect(getCurrentProfile(withoutSnapshots, TODAY)).toEqual(withoutSnapshots)
  })

  test('ignores snapshots dated in the future rather than projecting backwards', () => {
    const profile: Profile = { ...PROFILE, snapshots: [{ date: '2027-01-01' }] }
    expect(getCurrentProfile(profile, TODAY)).toEqual(profile)
  })

  test('floors projected cash at zero when outflows outrun income', () => {
    const profile: Profile = {
      ...PROFILE,
      cash_amount: 100,
      incomes: [],
    }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(0)
  })

  test('keeps the snapshot list intact so history still resolves', () => {
    expect(getCurrentProfile(PROFILE, TODAY).snapshots).toEqual(PROFILE.snapshots)
  })
})

describe('percentChange', () => {
  test('reports growth as a positive percentage', () => {
    expect(percentChange(100, 125)).toBe(25)
  })

  test('reports a decline as a negative percentage', () => {
    expect(percentChange(200, 150)).toBe(-25)
  })

  test('is undefined when there is nothing to compare against', () => {
    expect(percentChange(0, 500)).toBeUndefined()
  })
})
