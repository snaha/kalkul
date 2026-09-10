import { describe, expect, test } from 'vitest'

import { CATEGORY_COLORS } from './chart-colors'
import {
  getAnnualDebtServiceTotal,
  getAnnualExpensesTotal,
  getAnnualIncomeTotal,
  getCashTotal,
  getFiPercent,
  getFinancedAssetsDebtTotal,
  getInvestableNetWorth,
  getInvestmentsTotal,
  getLiabilitiesTotal,
  getNetWorth,
  getOverviewSegments,
  getRunwayYears,
  getSavingsRate,
  getTangibleAssetsTotal,
  getTotalAssets,
  hasAnyFinancialData,
} from './financial-totals'
import type { Expense, Income, Profile } from './schemas'
import { captureSnapshot, snapshotNetWorth } from './snapshots'

const EMPTY_PROFILE: Profile = {
  name: '',
  email: '',
}

const POPULATED_PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 4_700,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 10_000, apy: 5 },
    { id: 'inv2', name: 'Crypto', balance: 2_500, apy: 10 },
  ],
  tangible_assets: [
    { id: 't1', name: 'House', value: 200_000, status: 'fully_owned' },
    { id: 't2', name: 'Car', value: 8_000, status: 'fully_owned' },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Mortgage',
      outstanding_balance: 120_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 800,
      remaining_term: 20,
    },
  ],
}

// POPULATED_PROFILE plus a financed house: €200k value, €150k mortgage debt.
const FINANCED_PROFILE: Profile = {
  ...POPULATED_PROFILE,
  tangible_assets: [
    {
      id: 't1',
      name: 'House',
      value: 200_000,
      status: 'financed',
      outstanding_balance: 150_000,
      installment_frequency: 'monthly',
      annual_rate: 4,
      installment_amount: 790,
      remaining_term: 25,
    },
    { id: 't2', name: 'Car', value: 8_000, status: 'fully_owned' },
  ],
}

describe('getCashTotal', () => {
  test('returns 0 when cash_amount is undefined', () => {
    expect(getCashTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when cash_amount is 0', () => {
    expect(getCashTotal({ ...EMPTY_PROFILE, cash_amount: 0 })).toBe(0)
  })

  test('returns the value when cash_amount is set', () => {
    expect(getCashTotal({ ...EMPTY_PROFILE, cash_amount: 4_700 })).toBe(4_700)
  })
})

describe('getInvestmentsTotal', () => {
  test('returns 0 when investments is undefined', () => {
    expect(getInvestmentsTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when investments is empty', () => {
    expect(getInvestmentsTotal({ ...EMPTY_PROFILE, investments: [] })).toBe(0)
  })

  test('sums investment balances', () => {
    expect(getInvestmentsTotal(POPULATED_PROFILE)).toBe(12_500)
  })
})

describe('getTangibleAssetsTotal', () => {
  test('returns 0 when tangible_assets is undefined', () => {
    expect(getTangibleAssetsTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when tangible_assets is empty', () => {
    expect(getTangibleAssetsTotal({ ...EMPTY_PROFILE, tangible_assets: [] })).toBe(0)
  })

  test('sums tangible asset values', () => {
    expect(getTangibleAssetsTotal(POPULATED_PROFILE)).toBe(208_000)
  })
})

describe('getLiabilitiesTotal', () => {
  test('returns 0 when liabilities is undefined', () => {
    expect(getLiabilitiesTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when liabilities is empty', () => {
    expect(getLiabilitiesTotal({ ...EMPTY_PROFILE, liabilities: [] })).toBe(0)
  })

  test('sums liability outstanding balances', () => {
    expect(getLiabilitiesTotal(POPULATED_PROFILE)).toBe(120_000)
  })

  test('includes financed tangible asset debt', () => {
    expect(getLiabilitiesTotal(FINANCED_PROFILE)).toBe(120_000 + 150_000)
  })
})

describe('getFinancedAssetsDebtTotal', () => {
  test('returns 0 when tangible_assets is undefined', () => {
    expect(getFinancedAssetsDebtTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when all assets are fully owned', () => {
    expect(getFinancedAssetsDebtTotal(POPULATED_PROFILE)).toBe(0)
  })

  test('sums outstanding balances of financed assets only', () => {
    expect(getFinancedAssetsDebtTotal(FINANCED_PROFILE)).toBe(150_000)
  })
})

describe('getTotalAssets', () => {
  test('returns 0 when nothing is set', () => {
    expect(getTotalAssets(EMPTY_PROFILE)).toBe(0)
  })

  test('sums cash + investments + tangible assets', () => {
    expect(getTotalAssets(POPULATED_PROFILE)).toBe(4_700 + 12_500 + 208_000)
  })

  test('does not include liabilities', () => {
    const totalAssets = getTotalAssets(POPULATED_PROFILE)
    expect(totalAssets).toBe(225_200)
    expect(totalAssets).not.toBe(225_200 - 120_000)
  })
})

describe('getNetWorth', () => {
  test('returns 0 when nothing is set', () => {
    expect(getNetWorth(EMPTY_PROFILE)).toBe(0)
  })

  test('returns assets minus liabilities', () => {
    expect(getNetWorth(POPULATED_PROFILE)).toBe(225_200 - 120_000)
  })

  test('subtracts financed tangible asset debt', () => {
    expect(getNetWorth(FINANCED_PROFILE)).toBe(225_200 - 120_000 - 150_000)
  })

  test('can be negative when liabilities exceed assets', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 1_000,
      liabilities: [
        {
          id: 'l1',
          name: 'Loan',
          outstanding_balance: 5_000,
          installment_frequency: 'monthly',
          annual_rate: 5,
          installment_amount: 100,
          remaining_term: 5,
        },
      ],
    }
    expect(getNetWorth(profile)).toBe(-4_000)
  })

  // A planned holding is money the profile does not have yet (or no longer
  // has): the schema says a future start buys the balance out of cash that
  // year. Counting it today both overstates net worth and disagrees with the
  // Current projection card beside it, which holds it at zero until then.
  const AS_OF = new Date(2026, 5, 15)

  test('leaves out a position that has not been bought yet', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 10_000,
      investments: [
        { id: 'i1', name: 'ETF', balance: 5_000, apy: 5 },
        {
          id: 'i2',
          name: 'Future ETF',
          balance: 100_000,
          apy: 5,
          start: 'at_specific_date',
          start_year: 2035,
        },
      ],
    }
    expect(getNetWorth(profile, AS_OF)).toBe(15_000)
  })

  test('leaves out a position that has already been sold', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 10_000,
      investments: [
        {
          id: 'i1',
          name: 'Sold fund',
          balance: 5_000,
          apy: 5,
          exit: 'at_specific_date',
          exit_year: 2025,
        },
      ],
    }
    expect(getNetWorth(profile, AS_OF)).toBe(10_000)
  })

  test('leaves out a property not bought yet along with its financing', () => {
    // Dropping the value but keeping the debt would read as a 200,000 hole.
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 10_000,
      tangible_assets: [
        {
          id: 'a1',
          name: 'Future flat',
          value: 300_000,
          status: 'financed',
          outstanding_balance: 200_000,
          installment_frequency: 'monthly',
          annual_rate: 3,
          installment_amount: 1_000,
          remaining_term: 25,
          purchase: 'at_specific_date',
          purchase_year: 2035,
        },
      ],
    }
    expect(getNetWorth(profile, AS_OF)).toBe(10_000)
  })

  // The History chart plots recorded snapshots with `snapshotNetWorth` while
  // the dashboard's headline figure comes from here. Two independent
  // definitions could drift apart silently, so there is only one — this pins
  // the agreement for a profile exercising every category.
  test('agrees with the net worth of the snapshot captured from the same profile', () => {
    const profile: Profile = {
      ...FINANCED_PROFILE,
      cash_amount: 4_700.55,
      investments: [
        { id: 'inv1', name: 'ETF', balance: 10_000.25, apy: 5 },
        { id: 'inv2', name: 'Crypto', balance: 2_500.5, apy: 10 },
      ],
    }
    expect(snapshotNetWorth(captureSnapshot(profile, '2026-04-27'))).toBe(getNetWorth(profile))
  })
})

describe('getOverviewSegments', () => {
  test('returns empty array for an empty profile', () => {
    expect(getOverviewSegments(EMPTY_PROFILE)).toEqual([])
  })

  test('omits zero-value segments', () => {
    const profile: Profile = { ...EMPTY_PROFILE, cash_amount: 0, investments: [] }
    expect(getOverviewSegments(profile)).toEqual([])
  })

  test('includes only non-zero categories', () => {
    const profile: Profile = { ...EMPTY_PROFILE, cash_amount: 100 }
    const segments = getOverviewSegments(profile)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({ label: 'cash', value: 100, color: CATEGORY_COLORS.cash })
  })

  test('returns all four category segments when all are populated', () => {
    const segments = getOverviewSegments(POPULATED_PROFILE)
    expect(segments.map((s) => s.label)).toEqual([
      'cash',
      'investments',
      'tangible-assets',
      'liabilities',
    ])
    expect(segments.map((s) => s.value)).toEqual([4_700, 12_500, 208_000, 120_000])
  })
})

function expense(amount: number, frequency: Expense['frequency']): Expense {
  return {
    id: `e-${amount}-${frequency}`,
    name: 'Expense',
    amount,
    frequency,
    start: 'now',
    end: 'never',
    change_over_time: 'none',
  }
}

describe('getAnnualExpensesTotal', () => {
  test('returns 0 when expenses is undefined', () => {
    expect(getAnnualExpensesTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('annualizes each frequency', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      expenses: [expense(100, 'weekly'), expense(100, 'monthly'), expense(100, 'yearly')],
    }
    expect(getAnnualExpensesTotal(profile)).toBeCloseTo(100 * (365.25 / 7) + 1_200 + 100, 6)
  })
})

describe('getAnnualDebtServiceTotal', () => {
  test('returns 0 for an empty profile', () => {
    expect(getAnnualDebtServiceTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('annualizes standalone liability installments', () => {
    // Mortgage liability: 800/month
    expect(getAnnualDebtServiceTotal(POPULATED_PROFILE)).toBe(800 * 12)
  })

  test('includes financed tangible asset installments', () => {
    // Standalone mortgage 800/month + financed house 790/month
    expect(getAnnualDebtServiceTotal(FINANCED_PROFILE)).toBe((800 + 790) * 12)
  })

  // A loan whose balance has reached zero is no longer serviced, exactly as the
  // dashboard's cash accrual reads it — counting its installment would drain
  // phantom money out of the savings rate, FI % and runway.
  test('skips a liability that is already paid off', () => {
    const profile: Profile = {
      ...POPULATED_PROFILE,
      liabilities: [{ ...POPULATED_PROFILE.liabilities![0], outstanding_balance: 0 }],
    }
    expect(getAnnualDebtServiceTotal(profile)).toBe(0)
  })

  test('skips a financed asset whose debt is cleared', () => {
    const profile: Profile = {
      ...FINANCED_PROFILE,
      liabilities: [],
      tangible_assets: [
        { ...FINANCED_PROFILE.tangible_assets![0], outstanding_balance: 0 },
        FINANCED_PROFILE.tangible_assets![1],
      ],
    }
    expect(getAnnualDebtServiceTotal(profile)).toBe(0)
  })
})

function income(amount: number, frequency: Income['frequency']): Income {
  return {
    id: `i-${amount}-${frequency}`,
    name: 'Income',
    amount,
    frequency,
    start: 'now',
    end: 'never',
    change_over_time: 'none',
  }
}

describe('getAnnualIncomeTotal', () => {
  test('returns 0 when incomes is undefined', () => {
    expect(getAnnualIncomeTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('annualizes each frequency', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      incomes: [income(100, 'weekly'), income(100, 'monthly'), income(100, 'yearly')],
    }
    expect(getAnnualIncomeTotal(profile)).toBeCloseTo(100 * (365.25 / 7) + 1_200 + 100, 6)
  })
})

describe('getSavingsRate', () => {
  // 4,200/month in, 3,200/month of expenses and a 200/month loan payment
  // leaves 800/month — the dashboard's headline case.
  const SAVER: Profile = {
    ...EMPTY_PROFILE,
    incomes: [income(4_200, 'monthly')],
    expenses: [expense(3_200, 'monthly')],
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

  test('is the share of income left after expenses and debt service', () => {
    const rate = getSavingsRate(SAVER)
    expect(rate?.annualAmount).toBe(9_600)
    expect(rate?.percent).toBeCloseTo(19.047619, 6)
  })

  test('is negative when outflows exceed income', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      incomes: [income(1_000, 'monthly')],
      expenses: [expense(1_500, 'monthly')],
    }
    const rate = getSavingsRate(profile)
    expect(rate?.annualAmount).toBe(-6_000)
    expect(rate?.percent).toBe(-50)
  })

  test('is 100% when there is nothing to spend', () => {
    const profile: Profile = { ...EMPTY_PROFILE, incomes: [income(1_000, 'monthly')] }
    expect(getSavingsRate(profile)?.percent).toBe(100)
  })

  test('is undefined without income', () => {
    expect(getSavingsRate(EMPTY_PROFILE)).toBeUndefined()
    expect(
      getSavingsRate({ ...EMPTY_PROFILE, expenses: [expense(100, 'monthly')] }),
    ).toBeUndefined()
  })
})

describe('getInvestableNetWorth', () => {
  test('is cash + investments - liabilities, excluding tangible assets', () => {
    expect(getInvestableNetWorth(POPULATED_PROFILE)).toBe(4_700 + 12_500 - 120_000)
  })

  test('ignores financed asset debt (secured by the excluded asset)', () => {
    expect(getInvestableNetWorth(FINANCED_PROFILE)).toBe(getInvestableNetWorth(POPULATED_PROFILE))
  })
})

describe('getFiPercent / getRunwayYears', () => {
  // Worked example from docs/planning-reward-features.md:
  // €40k/yr expenses, €620k investable → FI 62%, runway 15.5 yrs
  const workedExample: Profile = {
    ...EMPTY_PROFILE,
    cash_amount: 620_000,
    expenses: [expense(40_000, 'yearly')],
  }

  test('matches the worked example', () => {
    expect(getFiPercent(workedExample)).toBeCloseTo(62, 6)
    expect(getRunwayYears(workedExample)).toBeCloseTo(15.5, 6)
  })

  test('return undefined without expenses', () => {
    expect(getFiPercent({ ...EMPTY_PROFILE, cash_amount: 100 })).toBeUndefined()
    expect(getRunwayYears({ ...EMPTY_PROFILE, cash_amount: 100 })).toBeUndefined()
  })

  test('return undefined when expenses total zero', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 100,
      expenses: [expense(0, 'monthly')],
    }
    expect(getFiPercent(profile)).toBeUndefined()
    expect(getRunwayYears(profile)).toBeUndefined()
  })

  test('include loan installments in the outflow denominator', () => {
    // Financed house adds 790/month = 9,480/yr of non-optional debt service:
    // outflows 40,000 → 49,480, but investable NW is unchanged.
    const withMortgage: Profile = {
      ...workedExample,
      tangible_assets: FINANCED_PROFILE.tangible_assets,
    }
    expect(getFiPercent(withMortgage)).toBeCloseTo((620_000 / (49_480 * 25)) * 100, 6)
    expect(getRunwayYears(withMortgage)).toBeCloseTo(620_000 / 49_480, 6)
  })

  test('clamp to 0 when investable net worth is negative', () => {
    const profile: Profile = {
      ...POPULATED_PROFILE,
      expenses: [expense(1_000, 'monthly')],
    }
    expect(getInvestableNetWorth(profile)).toBeLessThan(0)
    expect(getFiPercent(profile)).toBe(0)
    expect(getRunwayYears(profile)).toBe(0)
  })
})

describe('hasAnyFinancialData', () => {
  test('returns false for an empty profile', () => {
    expect(hasAnyFinancialData(EMPTY_PROFILE)).toBe(false)
  })

  test('returns false when all values are zero', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 0,
      investments: [{ id: 'i', name: 'x', balance: 0, apy: 0 }],
      tangible_assets: [{ id: 't', name: 'x', value: 0, status: 'fully_owned' }],
      liabilities: [
        {
          id: 'l',
          name: 'x',
          outstanding_balance: 0,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 0,
          remaining_term: 0,
        },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(false)
  })

  test('returns true when cash is positive', () => {
    expect(hasAnyFinancialData({ ...EMPTY_PROFILE, cash_amount: 1 })).toBe(true)
  })

  test('returns true when at least one investment has a positive balance', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      investments: [
        { id: 'i1', name: 'x', balance: 0, apy: 0 },
        { id: 'i2', name: 'y', balance: 1, apy: 0 },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })

  test('returns true when at least one tangible asset has a positive value', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      tangible_assets: [{ id: 't', name: 'x', value: 1, status: 'fully_owned' }],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })

  test('returns true when at least one liability has a positive outstanding balance', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      liabilities: [
        {
          id: 'l',
          name: 'x',
          outstanding_balance: 1,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 0,
          remaining_term: 0,
        },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })
})

describe('plan-owned items', () => {
  const owned = { plan_id: 'plan-1' }
  const withOwned: Profile = {
    ...POPULATED_PROFILE,
    investments: [
      ...POPULATED_PROFILE.investments!,
      { id: 'x', name: 'x', balance: 999, apy: 0, ...owned },
    ],
    tangible_assets: [
      ...POPULATED_PROFILE.tangible_assets!,
      {
        id: 'x',
        name: 'x',
        value: 999,
        status: 'financed',
        outstanding_balance: 999,
        installment_frequency: 'monthly',
        annual_rate: 1,
        installment_amount: 99,
        remaining_term: 10,
        ...owned,
      },
    ],
    liabilities: [
      ...(POPULATED_PROFILE.liabilities ?? []),
      {
        id: 'x',
        name: 'x',
        outstanding_balance: 999,
        installment_frequency: 'monthly',
        annual_rate: 1,
        installment_amount: 99,
        remaining_term: 10,
        ...owned,
      },
    ],
    incomes: [
      ...(POPULATED_PROFILE.incomes ?? []),
      {
        id: 'x',
        name: 'x',
        amount: 999,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
        ...owned,
      },
    ],
    expenses: [
      ...(POPULATED_PROFILE.expenses ?? []),
      {
        id: 'x',
        name: 'x',
        amount: 999,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
        ...owned,
      },
    ],
  }

  test('are not current data, so every total ignores them', () => {
    expect(getInvestmentsTotal(withOwned)).toBe(getInvestmentsTotal(POPULATED_PROFILE))
    expect(getTangibleAssetsTotal(withOwned)).toBe(getTangibleAssetsTotal(POPULATED_PROFILE))
    expect(getLiabilitiesTotal(withOwned)).toBe(getLiabilitiesTotal(POPULATED_PROFILE))
    expect(getAnnualIncomeTotal(withOwned)).toBe(getAnnualIncomeTotal(POPULATED_PROFILE))
    expect(getAnnualExpensesTotal(withOwned)).toBe(getAnnualExpensesTotal(POPULATED_PROFILE))
    expect(getAnnualDebtServiceTotal(withOwned)).toBe(getAnnualDebtServiceTotal(POPULATED_PROFILE))
    expect(getNetWorth(withOwned)).toBe(getNetWorth(POPULATED_PROFILE))
    expect(getOverviewSegments(withOwned)).toEqual(getOverviewSegments(POPULATED_PROFILE))
  })

  test('alone do not count as financial data', () => {
    expect(
      hasAnyFinancialData({
        ...EMPTY_PROFILE,
        investments: [{ id: 'x', name: 'x', balance: 999, apy: 0, ...owned }],
      }),
    ).toBe(false)
  })
})
