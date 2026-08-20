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

  test('does not accrue income that has not started yet', () => {
    const profile: Profile = {
      ...PROFILE,
      cash_amount: 50_000,
      incomes: [
        { ...PROFILE.incomes![0], start: 'at_specific_date', start_year: 2027, start_month: 1 },
      ],
    }
    // Only outflows are running: 50,000 − (36,000 + 2,400) × 0.4982888.
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(30_865.71)
  })

  test('stops accruing an expense whose window has already closed', () => {
    const profile: Profile = {
      ...PROFILE,
      expenses: [
        { ...PROFILE.expenses![0], end: 'at_specific_date', end_year: 2026, end_month: 5 },
      ],
    }
    // 15,000 + (60,000 − 2,400) × 0.4982888.
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(43_701.44)
  })

  test('counts a flow whose start month has arrived', () => {
    const profile: Profile = {
      ...PROFILE,
      incomes: [
        { ...PROFILE.incomes![0], start: 'at_specific_date', start_year: 2026, start_month: 7 },
      ],
    }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(25_763.04)
  })

  test('resolves age-based windows against the birth date', () => {
    const profile: Profile = {
      ...PROFILE,
      cash_amount: 50_000,
      // Turns 40 in 2030, so the income has not started.
      birth_date: '1990-06-15',
      incomes: [{ ...PROFILE.incomes![0], start: 'when_age_is', start_age: 40 }],
    }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(30_865.71)
  })

  test('rounds projected balances to the cent', () => {
    // Compounding a fraction of a year otherwise leaves a long tail of digits
    // that would show up verbatim in the Quick update inputs.
    const current = getCurrentProfile(PROFILE, TODAY)
    expect(current.cash_amount).toBe(25_763.04)
    expect(current.investments?.[0].balance).toBe(104_863.78)
  })

  test('leaves a fully owned tangible asset untouched', () => {
    const profile: Profile = {
      ...PROFILE,
      tangible_assets: [{ id: 't1', name: 'Car', value: 20_000, status: 'fully_owned' }],
    }
    expect(getCurrentProfile(profile, TODAY).tangible_assets).toEqual(profile.tangible_assets)
  })

  test('amortizes a liability over the whole installments elapsed', () => {
    // 5 whole monthly installments fit in 182 days. Each one adds 5%/12 of
    // interest and takes 200 off: 6,000 → 5,825 → 5,649.27 → 5,472.81 →
    // 5,295.61 → 5,117.68.
    const current = getCurrentProfile(PROFILE, TODAY)
    expect(current.liabilities?.[0].outstanding_balance).toBe(5_117.68)
    // Every other field survives.
    expect(current.liabilities?.[0].name).toBe('Car loan')
    expect(current.liabilities?.[0].remaining_term).toBe(3)
  })

  test("amortizes a financed asset's debt while leaving its value alone", () => {
    const profile: Profile = {
      ...PROFILE,
      tangible_assets: [
        {
          id: 't1',
          name: 'House',
          value: 300_000,
          status: 'financed',
          outstanding_balance: 200_000,
          installment_frequency: 'monthly',
          annual_rate: 3,
          installment_amount: 1_000,
          remaining_term: 25,
        },
      ],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.tangible_assets?.[0].value).toBe(300_000)
    expect(current.tangible_assets?.[0].outstanding_balance).toBe(197_487.47)
  })

  test('floors a liability that pays off inside the window at zero', () => {
    const profile: Profile = {
      ...PROFILE,
      liabilities: [{ ...PROFILE.liabilities![0], outstanding_balance: 400 }],
    }
    expect(getCurrentProfile(profile, TODAY).liabilities?.[0].outstanding_balance).toBe(0)
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
