import { describe, expect, test } from 'vitest'

import { getCurrentProfile, percentChange, withBalancesCarriedForward } from './current-values'
import { remainingInstallmentPeriods } from './plan-projection'
import type { Profile, ProfileLiability, Transfer } from './schemas'

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
  })

  test('takes the elapsed installments off the remaining term', () => {
    // Five of the loan's 36 monthly installments have been paid, so it now runs
    // for 31 more: 31/12 = 2.58 years. Left at three, every re-dating of the
    // baseline would restart the loan's clock and push the payoff date out.
    expect(getCurrentProfile(PROFILE, TODAY).liabilities?.[0].remaining_term).toBe(2.58)
  })

  test('writes the term back at a precision the user can read and edit', () => {
    // The term lands in the financial-data form, where the user typed it by
    // hand — a figure that grows a tail of decimals on its own reads as
    // machine output. Two places still recover the exact installment count.
    const weekly: ProfileLiability = {
      id: 'l2',
      name: 'Weekly loan',
      outstanding_balance: 6_000,
      installment_frequency: 'weekly',
      annual_rate: 5,
      installment_amount: 50,
      remaining_term: 3,
    }
    const carried = getCurrentProfile({ ...PROFILE, liabilities: [weekly] }, TODAY).liabilities![0]
    // 156 weekly installments less the 25 that fell due: 131/52 = 2.5192 years.
    expect(carried.remaining_term).toBe(2.52)
    expect(remainingInstallmentPeriods(carried)).toBe(131)
  })

  test('writes the shortened term back in the unit the loan states it in', () => {
    // A term stated in months has to come back in months. Written back as the
    // equivalent in years, `remaining_term_unit` would reinterpret it — 31
    // months becoming 2.5833 *months* — and collapse the payoff date.
    const profile: Profile = {
      ...PROFILE,
      liabilities: [
        { ...PROFILE.liabilities![0], remaining_term: 36, remaining_term_unit: 'months' },
      ],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.liabilities?.[0].remaining_term).toBe(31)
    expect(current.liabilities?.[0].remaining_term_unit).toBe('months')
  })

  test('pays the final installment in full so the loan ends with its term', () => {
    // 100/month never amortizes 6,000 at 5% in three years, but the loan's term
    // is what the projection engine honours: its last scheduled installment
    // settles whatever is left. Without the same balloon here, the dashboard
    // would carry a residual balance the projection has already cleared.
    const profile: Profile = {
      ...PROFILE,
      liabilities: [{ ...PROFILE.liabilities![0], installment_amount: 100 }],
      snapshots: [{ date: '2023-01-01', cash_amount: 15_000 }],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.liabilities?.[0].outstanding_balance).toBe(0)
    expect(current.liabilities?.[0].remaining_term).toBe(0)
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
    // 300 monthly installments less the five that fell due: 295/12.
    expect(current.tangible_assets?.[0].remaining_term).toBe(24.58)
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

describe('getCurrentProfile with transfers', () => {
  // 600 a month out of cash and into the ETF: the shape the Claire example
  // ships with, and the one every regular contribution takes.
  const CONTRIBUTION: Transfer = {
    id: 'tr1',
    name: 'Monthly ETF contribution',
    from_asset_id: 'cash',
    to_asset_id: 'inv1',
    amount: 600,
    schedule: 'recurring',
    frequency: 'monthly',
    start: 'immediately',
    end: 'never',
    change_over_time: 'none',
  }
  const WITH_CONTRIBUTION: Profile = { ...PROFILE, transfers: [CONTRIBUTION] }

  test('takes a recurring transfer out of the source and pays it into the destination', () => {
    const current = getCurrentProfile(WITH_CONTRIBUTION, TODAY)
    // Cash accrues 21,600 − 7,200 a year rather than the full 21,600 …
    expect(current.cash_amount).toBe(22_175.36)
    // … and the ETF gets the 7,200 on top of its own growth.
    expect(current.investments?.[0].balance).toBe(108_451.46)
  })

  test('leaves net worth where it was, since the money only changed hands', () => {
    const before = getCurrentProfile(PROFILE, TODAY)
    const after = getCurrentProfile(WITH_CONTRIBUTION, TODAY)
    const netWorth = (profile: Profile) =>
      (profile.cash_amount ?? 0) + (profile.investments ?? []).reduce((s, i) => s + i.balance, 0)
    expect(netWorth(after)).toBeCloseTo(netWorth(before), 2)
  })

  test('charges the exit fee on the way out, so the destination receives less', () => {
    const profile: Profile = {
      ...PROFILE,
      investments: [{ ...PROFILE.investments![0], exit_fee: 10 }, PROFILE.investments![1]],
      transfers: [{ ...CONTRIBUTION, from_asset_id: 'inv1', to_asset_id: 'cash', amount: 100 }],
    }
    const current = getCurrentProfile(profile, TODAY)
    // The ETF loses the full 1,200 a year …
    expect(current.investments?.[0].balance).toBe(104_265.83)
    // … and cash receives 1,080 of it.
    expect(current.cash_amount).toBe(26_301.19)
  })

  test('charges the upfront entry fee on the way in', () => {
    const profile: Profile = {
      ...PROFILE,
      investments: [
        { ...PROFILE.investments![0], entry_fee: 5, entry_fee_type: 'upfront' },
        PROFILE.investments![1],
      ],
      transfers: [{ ...CONTRIBUTION, amount: 100 }],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.cash_amount).toBe(25_165.09)
    expect(current.investments?.[0].balance).toBe(105_431.83)
  })

  test('ignores a transfer whose window has already closed', () => {
    const profile: Profile = {
      ...PROFILE,
      transfers: [{ ...CONTRIBUTION, end: 'at_specific_date', end_year: 2025, end_month: 12 }],
    }
    const current = getCurrentProfile(profile, TODAY)
    expect(current.cash_amount).toBe(25_763.04)
    expect(current.investments?.[0].balance).toBe(104_863.78)
  })

  test('ignores a one-time transfer, which is an event rather than a rate', () => {
    const profile: Profile = {
      ...PROFILE,
      transfers: [
        {
          ...CONTRIBUTION,
          schedule: 'one_time',
          transaction_year: 2026,
          transaction_month: 3,
          frequency: undefined,
        },
      ],
    }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(25_763.04)
  })

  test('ignores a "transfer all" sweep, which has no yearly rate to accrue', () => {
    const profile: Profile = {
      ...PROFILE,
      transfers: [{ ...CONTRIBUTION, transfer_all: true }],
    }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(25_763.04)
  })

  test('ignores a transfer pointing at something the profile no longer holds', () => {
    const profile: Profile = { ...PROFILE, transfers: [{ ...CONTRIBUTION, to_asset_id: 'gone' }] }
    expect(getCurrentProfile(profile, TODAY).cash_amount).toBe(25_763.04)
  })

  test('floors an investment drained by a transfer at zero', () => {
    const profile: Profile = {
      ...PROFILE,
      transfers: [{ ...CONTRIBUTION, from_asset_id: 'inv2', to_asset_id: 'cash', amount: 100_000 }],
    }
    expect(getCurrentProfile(profile, TODAY).investments?.[1].balance).toBe(0)
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

  test('reads a debt getting smaller as an improvement', () => {
    // Measured against the size of the baseline, not its sign: halving what is
    // owed is a 50% move in the right direction, and dividing by the signed
    // figure would render it in the destructive red.
    expect(percentChange(-1_000, -500)).toBe(50)
    expect(percentChange(-1_000, -1_500)).toBe(-50)
  })
})

describe('withBalancesCarriedForward', () => {
  test('carries a balance the edit left alone forward to today', () => {
    // Renaming one investment must not freeze the other balances at the values
    // they had on the snapshot date.
    const next: Profile = {
      ...PROFILE,
      investments: [{ ...PROFILE.investments![0], name: 'Renamed ETF' }, PROFILE.investments![1]],
    }
    const merged = withBalancesCarriedForward(PROFILE, next, TODAY)

    expect(merged.cash_amount).toBe(25_763.04)
    expect(merged.investments?.[0].balance).toBe(104_863.78)
    expect(merged.investments?.[0].name).toBe('Renamed ETF')
    expect(merged.investments?.[1].balance).toBe(51_834.69)
    expect(merged.liabilities?.[0].outstanding_balance).toBe(5_117.68)
  })

  test('carries the elapsed installments out of the remaining term', () => {
    // The re-dated baseline says these balances are today's. The loan's term has
    // to move with them, or every save restarts its clock: five installments
    // paid leave 31 of 36, i.e. 2.58 years.
    const merged = withBalancesCarriedForward(PROFILE, { ...PROFILE }, TODAY)
    expect(merged.liabilities?.[0].remaining_term).toBe(2.58)
  })

  test('keeps a remaining term the edit changed exactly as given', () => {
    const next: Profile = {
      ...PROFILE,
      liabilities: [{ ...PROFILE.liabilities![0], remaining_term: 10 }],
    }
    expect(withBalancesCarriedForward(PROFILE, next, TODAY).liabilities?.[0].remaining_term).toBe(
      10,
    )
  })

  test('keeps a balance the edit confirmed outright, even when it matches the stored one', () => {
    // Quick update's Confirm submits what the user saw in the dialog. Re-typing
    // the stored figure is the user's word on today's balance, not a field left
    // untouched — substituting the projection would discard the correction.
    const next: Profile = { ...PROFILE, cash_amount: 15_000 }
    const merged = withBalancesCarriedForward(PROFILE, next, TODAY, {
      cash: true,
      investmentIds: new Set(['inv1']),
    })

    expect(merged.cash_amount).toBe(15_000)
    expect(merged.investments?.[0].balance).toBe(100_000)
    // Not confirmed, so it still arrives at today's value.
    expect(merged.investments?.[1].balance).toBe(51_834.69)
  })

  test('keeps a balance the edit changed exactly as given', () => {
    const next: Profile = {
      ...PROFILE,
      cash_amount: 1_000,
      investments: [{ ...PROFILE.investments![0], balance: 42 }, PROFILE.investments![1]],
    }
    const merged = withBalancesCarriedForward(PROFILE, next, TODAY)

    expect(merged.cash_amount).toBe(1_000)
    expect(merged.investments?.[0].balance).toBe(42)
    // The one it did not touch still arrives at today's value.
    expect(merged.investments?.[1].balance).toBe(51_834.69)
  })

  test('leaves an item the profile did not hold before untouched', () => {
    const next: Profile = {
      ...PROFILE,
      investments: [
        ...(PROFILE.investments ?? []),
        { id: 'inv3', name: 'Bonds', balance: 5_000, apy: 3 },
      ],
    }
    expect(withBalancesCarriedForward(PROFILE, next, TODAY).investments?.[2].balance).toBe(5_000)
  })

  test("carries a financed asset's debt forward but not its value", () => {
    const asset = {
      id: 't1',
      name: 'House',
      value: 300_000,
      status: 'financed' as const,
      outstanding_balance: 200_000,
      installment_frequency: 'monthly' as const,
      annual_rate: 3,
      installment_amount: 1_000,
      remaining_term: 25,
    }
    const stored: Profile = { ...PROFILE, tangible_assets: [asset] }
    const merged = withBalancesCarriedForward(stored, { ...stored }, TODAY)

    expect(merged.tangible_assets?.[0].value).toBe(300_000)
    expect(merged.tangible_assets?.[0].outstanding_balance).toBe(197_487.47)
  })

  test('returns the edit untouched when nothing has elapsed', () => {
    const stored: Profile = { ...PROFILE, snapshots: [{ date: '2026-07-02' }] }
    const next: Profile = { ...stored, cash_amount: 99 }
    expect(withBalancesCarriedForward(stored, next, TODAY)).toBe(next)
  })
})
