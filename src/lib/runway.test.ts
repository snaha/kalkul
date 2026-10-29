import { describe, expect, test } from 'vitest'

import { DEFAULT_RUNWAY_SETTINGS, getRunwayYears } from './runway'
import type { Expense, Income, Profile, RunwaySettings } from './schemas'

const BASE: Profile = { name: 'Test', email: 't@example.com' }

function expense(amount: number, frequency: Expense['frequency'] = 'monthly'): Expense {
  return { id: `e-${amount}`, name: 'Expense', amount, schedule: 'recurring', frequency }
}

function income(amount: number): Income {
  return { id: `i-${amount}`, name: 'Income', amount, schedule: 'recurring', frequency: 'monthly' }
}

// Growth off and nothing taxed, so the numbers below are exact.
const FLAT: RunwaySettings = {
  ...DEFAULT_RUNWAY_SETTINGS,
  investment_growth: false,
  tangible_asset_growth: false,
}

describe('getRunwayYears', () => {
  test('cash alone against yearly expenses', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 620_000,
      expenses: [expense(40_000, 'yearly')],
    }
    expect(getRunwayYears(profile)).toBeCloseTo(15.5, 6)
  })

  test('is undefined with nothing to pay and 0 with nothing to pay it from', () => {
    expect(getRunwayYears({ ...BASE, cash_amount: 100 })).toBeUndefined()
    expect(getRunwayYears({ ...BASE, cash_amount: 100, expenses: [expense(0)] })).toBeUndefined()
    expect(getRunwayYears({ ...BASE, expenses: [expense(1_000)] })).toBe(0)
  })

  test('credits the covered share of the month it runs out in', () => {
    const profile: Profile = { ...BASE, cash_amount: 2_500, expenses: [expense(1_000)] }
    expect(getRunwayYears(profile)).toBeCloseTo(2.5 / 12, 6)
  })

  test('income offsets the outflows unless switched off', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 12_000,
      incomes: [income(1_000)],
      expenses: [expense(2_000)],
    }
    expect(getRunwayYears(profile)).toBeCloseTo(1, 6)
    expect(getRunwayYears(profile, { ...FLAT, include_income: false })).toBeCloseTo(0.5, 6)
  })

  test('is Infinity when income covers the outflows', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 100,
      incomes: [income(2_000)],
      expenses: [expense(2_000)],
    }
    expect(getRunwayYears(profile)).toBe(Infinity)
  })

  test('draws on investments after cash, when allowed', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 6_000,
      investments: [{ id: 'i', name: 'ETF', balance: 6_000, apy: 7 }],
      expenses: [expense(1_000)],
    }
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(1, 6)
    expect(getRunwayYears(profile, { ...FLAT, withdraw_investments: false })).toBeCloseTo(0.5, 6)
  })

  test('growth lengthens the runway and tax takes back only the growth', () => {
    const profile: Profile = {
      ...BASE,
      investments: [{ id: 'i', name: 'ETF', balance: 1_200, apy: 12 }],
      expenses: [expense(100)],
    }
    const flat = getRunwayYears(profile, FLAT)
    const grown = getRunwayYears(profile, { ...FLAT, investment_growth: true })
    const grownTaxedHalf = getRunwayYears(profile, {
      ...FLAT,
      investment_growth: true,
      investment_tax_rate: 50,
    })
    const grownTaxedAll = getRunwayYears(profile, {
      ...FLAT,
      investment_growth: true,
      investment_tax_rate: 100,
    })
    expect(flat).toBeCloseTo(1, 6)
    expect(grown).toBeGreaterThan(grownTaxedHalf!)
    expect(grownTaxedHalf).toBeGreaterThan(flat!)
    // Taxing all of the gain leaves exactly the basis: the same as no growth.
    expect(grownTaxedAll).toBeCloseTo(1, 6)
    // Tax on a balance that never grew changes nothing.
    expect(getRunwayYears(profile, { ...FLAT, investment_tax_rate: 50 })).toBeCloseTo(1, 6)
  })

  test('sells tangible assets after investments, when allowed', () => {
    const profile: Profile = {
      ...BASE,
      tangible_assets: [{ id: 't', name: 'Car', value: 12_000, status: 'fully_owned' }],
      expenses: [expense(1_000)],
    }
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(1, 6)
    expect(getRunwayYears(profile, { ...FLAT, sell_tangible_assets: false })).toBe(0)
  })

  test('selling a financed asset settles what is still owed and ends its installments', () => {
    const profile: Profile = {
      ...BASE,
      tangible_assets: [
        {
          id: 't',
          name: 'Flat',
          value: 100_000,
          status: 'financed',
          outstanding_balance: 40_000,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 1_000,
          remaining_term: 40,
          remaining_term_unit: 'months',
        },
      ],
      expenses: [expense(1_000)],
    }
    // Month 1 pays 2,000 from nothing, so the flat is sold: 100,000 less the
    // 39,000 still owed after one installment leaves 59,000 after the month's
    // shortfall, which then covers 59 more months of expenses alone.
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(5, 6)
  })

  test('loan installments stop at the end of the term', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 30_000,
      liabilities: [
        {
          id: 'l',
          name: 'Loan',
          outstanding_balance: 12_000,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 1_000,
          remaining_term: 1,
        },
      ],
      expenses: [expense(1_000)],
    }
    // 2,000 a month for a year, then 1,000 a month for the remaining 6,000.
    expect(getRunwayYears(profile)).toBeCloseTo(1.5, 6)
  })

  test('uses the settings stored on the profile by default', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 12_000,
      incomes: [income(1_000)],
      expenses: [expense(2_000)],
      runway_settings: { ...FLAT, include_income: false },
    }
    expect(getRunwayYears(profile)).toBeCloseTo(0.5, 6)
  })
})
