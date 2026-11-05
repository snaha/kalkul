import { describe, expect, test } from 'vitest'

import {
  DEFAULT_RUNWAY_SETTINGS,
  type RunwaySettings,
  changedRunwaySettings,
  getRunwayYears,
  validRunwaySettings,
  validTaxRate,
} from './runway'
import type { Expense, Income, Profile, ProfileInvestment, ProfileLiability } from './schemas'

const BASE: Profile = { name: 'Test', email: 't@example.com' }

function expense(amount: number, frequency: Expense['frequency'] = 'monthly'): Expense {
  return { id: `e-${amount}`, name: 'Expense', amount, schedule: 'recurring', frequency }
}

function income(amount: number): Income {
  return { id: `i-${amount}`, name: 'Income', amount, schedule: 'recurring', frequency: 'monthly' }
}

function etf(id: string, balance: number, apy: number): ProfileInvestment {
  return { id, name: id, balance, apy }
}

// Yearly rates whose monthly factor is exactly 1.01 and 0.99, so grown balances can be worked by hand.
const ONE_PERCENT_A_MONTH = (1.01 ** 12 - 1) * 100
const MINUS_ONE_PERCENT_A_MONTH = (1 - 0.99 ** 12) * 100

// Everything allowed and nothing grows or is taxed, so the numbers are exact.
const FLAT: RunwaySettings = {
  withdraw_investments: true,
  investment_growth: false,
  investment_tax_rate: 0,
  include_income: true,
  sell_tangible_assets: true,
  tangible_asset_growth: false,
  tangible_asset_tax_rate: 0,
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
    // A loan with no installment is nothing to pay either.
    const unpaid: ProfileLiability = {
      id: 'l',
      name: 'Loan',
      outstanding_balance: 5_000,
      installment_frequency: 'monthly',
      annual_rate: 0,
      installment_amount: 0,
      remaining_term: 0,
    }
    expect(getRunwayYears({ ...BASE, cash_amount: 100, liabilities: [unpaid] })).toBeUndefined()
  })

  test('credits the covered share of the month it runs out in', () => {
    const profile: Profile = { ...BASE, cash_amount: 2_500, expenses: [expense(1_000)] }
    expect(getRunwayYears(profile)).toBeCloseTo(2.5 / 12, 6)
  })

  test('cash below zero is already out, unless income more than covers the outflows', () => {
    expect(getRunwayYears({ ...BASE, cash_amount: -1_000, expenses: [expense(1_000)] })).toBe(0)
    const breakEven: Profile = {
      ...BASE,
      cash_amount: -1_000,
      incomes: [income(2_000)],
      expenses: [expense(2_000)],
    }
    expect(getRunwayYears(breakEven, FLAT)).toBe(0)
    const surplus: Profile = { ...breakEven, incomes: [income(3_000)] }
    expect(getRunwayYears(surplus, FLAT)).toBe(Infinity)
    // Deeper than one month's surplus still climbs out.
    expect(getRunwayYears({ ...surplus, cash_amount: -1_001 }, FLAT)).toBe(Infinity)
  })

  test('income offsets the outflows unless switched off', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 12_000,
      incomes: [income(1_000)],
      expenses: [expense(2_000)],
    }
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(1, 6)
    expect(getRunwayYears(profile, { ...FLAT, include_income: false })).toBeCloseTo(0.5, 6)
  })

  test('is Infinity when income covers the outflows, or the money outlasts the cap', () => {
    const covered: Profile = {
      ...BASE,
      cash_amount: 100,
      incomes: [income(2_000)],
      expenses: [expense(2_000)],
    }
    expect(getRunwayYears(covered, FLAT)).toBe(Infinity)
    const endless: Profile = { ...BASE, cash_amount: 10_000_000, expenses: [expense(1_000)] }
    expect(getRunwayYears(endless)).toBe(Infinity)
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

  test('growth compounds monthly at the effective APY', () => {
    const grown: RunwaySettings = { ...FLAT, investment_growth: true }
    const profile: Profile = {
      ...BASE,
      investments: [{ id: 'i', name: 'ETF', balance: 1_000, apy: ONE_PERCENT_A_MONTH }],
      expenses: [expense(500)],
    }
    // 1,010 − 500 = 510; 515.1 − 500 = 15.1; 15.251 covers 3.0502% of month three.
    expect(getRunwayYears(profile, grown)).toBeCloseTo(2.030502 / 12, 6)
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(2 / 12, 6)
    // The TER comes off the APY, as it does on the dashboard.
    const withTer: Profile = {
      ...profile,
      investments: [{ id: 'i', name: 'ETF', balance: 1_000, apy: ONE_PERCENT_A_MONTH, ter: 1 }],
    }
    // 11.68% a year is 0.925% a month: 1,009.25 − 500 = 509.25; 513.96 − 500 =
    // 13.96; 14.09 covers 2.818% of month three.
    expect(getRunwayYears(withTer, grown)).toBeCloseTo(2.02818 / 12, 5)
  })

  test('tax takes its share of the gain only', () => {
    const profile: Profile = {
      ...BASE,
      investments: [{ id: 'i', name: 'ETF', balance: 1_000, apy: ONE_PERCENT_A_MONTH }],
      expenses: [expense(1_500)],
    }
    // 1,010 after a month, of which 10 is gain. Taxed at 50% the whole holding
    // nets 1,005, which covers 67% of the month's 1,500.
    expect(
      getRunwayYears(profile, { ...FLAT, investment_growth: true, investment_tax_rate: 50 }),
    ).toBeCloseTo(0.67 / 12, 6)
    // Taxing all of the gain leaves exactly the basis: the same as no growth.
    expect(
      getRunwayYears(profile, { ...FLAT, investment_growth: true, investment_tax_rate: 100 }),
    ).toBeCloseTo(1_000 / 1_500 / 12, 6)
    // Tax on a balance that never grew changes nothing.
    expect(getRunwayYears(profile, { ...FLAT, investment_tax_rate: 50 })).toBeCloseTo(
      1_000 / 1_500 / 12,
      6,
    )
  })

  test('growth that outpaces the draw never runs out', () => {
    const profile: Profile = {
      ...BASE,
      investments: [{ id: 'i', name: 'ETF', balance: 12_000, apy: ONE_PERCENT_A_MONTH }],
      expenses: [expense(100)],
    }
    expect(getRunwayYears(profile, { ...FLAT, investment_growth: true })).toBe(Infinity)
    // The 4% rule: a million at 7% against 40,000 a year.
    const fourPercent: Profile = {
      ...BASE,
      investments: [etf('a', 1_000_000, 7)],
      expenses: [expense(3_333)],
    }
    expect(getRunwayYears(fourPercent, { ...FLAT, investment_growth: true })).toBe(Infinity)
  })

  test('a draw close to the growth walks the months, as tax and slower investments eat into it', () => {
    const grown = (investment_tax_rate: number): RunwaySettings => ({
      ...FLAT,
      investment_growth: true,
      investment_tax_rate,
    })
    const cases: [Profile, RunwaySettings, number][] = [
      [
        { ...BASE, investments: [etf('a', 500_000, 6)], expenses: [expense(2_200)] },
        grown(26),
        55.72,
      ],
      [
        {
          ...BASE,
          investments: [etf('a', 400_000, 5)],
          incomes: [income(1_500)],
          expenses: [expense(3_000)],
        },
        grown(20),
        76.71,
      ],
      [
        {
          ...BASE,
          investments: [etf('a', 600_000, 7), etf('b', 400_000, 3)],
          expenses: [expense(4_000)],
        },
        grown(0),
        55.77,
      ],
      [
        {
          ...BASE,
          investments: [etf('a', 300_000, 8), etf('b', 200_000, 2)],
          expenses: [expense(2_200)],
        },
        grown(0),
        42.31,
      ],
      [
        {
          ...BASE,
          investments: [etf('a', 800_000, 6)],
          liabilities: [
            {
              id: 'l',
              name: 'Loan',
              outstanding_balance: 144_000,
              installment_frequency: 'monthly',
              annual_rate: 0,
              installment_amount: 1_200,
              remaining_term: 10,
            },
          ],
          expenses: [expense(3_000)],
        },
        grown(25),
        59.94,
      ],
      // Either side of the line between sustainable and not, no cliff.
      [
        { ...BASE, investments: [etf('a', 1_000_000, 7)], expenses: [expense(5_650)] },
        grown(25),
        31.97,
      ],
      [
        { ...BASE, investments: [etf('a', 1_000_000, 7)], expenses: [expense(5_700)] },
        grown(25),
        31.12,
      ],
    ]
    for (const [profile, settings, years] of cases)
      expect(getRunwayYears(profile, settings)).toBeCloseTo(years, 2)
  })

  test('a return below −100% is a total loss, not NaN', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 1_000,
      investments: [{ id: 'i', name: 'Bet', balance: 5_000, apy: -150 }],
      expenses: [expense(1_000)],
    }
    expect(getRunwayYears(profile, { ...FLAT, investment_growth: true })).toBeCloseTo(1 / 12, 6)
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

  test('an asset grows or depreciates at its own rate, and tax takes a share of the gain', () => {
    const grown: RunwaySettings = { ...FLAT, tangible_asset_growth: true }
    const car = { id: 't', name: 'Car', value: 10_000, status: 'fully_owned' as const }
    const expenses = [expense(2_000)]
    // Worth 10,100 after a month, sold with 50 of tax on the 100 gain: 8,050
    // left after the month's shortfall covers 4.025 more months.
    const appreciating: Profile = {
      ...BASE,
      tangible_assets: [{ ...car, value_over_time: 'appreciate', value_rate: ONE_PERCENT_A_MONTH }],
      expenses,
    }
    expect(getRunwayYears(appreciating, { ...grown, tangible_asset_tax_rate: 50 })).toBeCloseTo(
      5.025 / 12,
      6,
    )
    // Worth 9,900 after a month, no gain to tax: 7,900 covers 3.95 more months.
    const depreciating: Profile = {
      ...BASE,
      tangible_assets: [
        { ...car, value_over_time: 'depreciate', value_rate: MINUS_ONE_PERCENT_A_MONTH },
      ],
      expenses,
    }
    expect(getRunwayYears(depreciating, { ...grown, tangible_asset_tax_rate: 50 })).toBeCloseTo(
      4.95 / 12,
      6,
    )
    // No value-over-time setting means the value stays put, growth switch or not.
    const flat: Profile = { ...BASE, tangible_assets: [{ ...car, value_rate: 50 }], expenses }
    expect(getRunwayYears(flat, grown)).toBeCloseTo(5 / 12, 6)
    expect(getRunwayYears(appreciating, FLAT)).toBeCloseTo(5 / 12, 6)
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

  test('a loan with no installment is never paid but still settled by a sale', () => {
    const profile: Profile = {
      ...BASE,
      tangible_assets: [
        {
          id: 't',
          name: 'House',
          value: 100_000,
          status: 'financed',
          outstanding_balance: 90_000,
          installment_frequency: 'monthly',
          annual_rate: 5,
          installment_amount: 0,
          remaining_term: 0,
        },
      ],
      expenses: [expense(1_000)],
    }
    // Nothing is paid on the loan, so the first month sells the house for
    // 100,000 less the 90,000 owed: 9,000 after the month covers 9 more.
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(10 / 12, 6)
  })

  test('what is owed at a sale follows the loan schedule, interest included', () => {
    const profile: Profile = {
      ...BASE,
      tangible_assets: [
        {
          id: 't',
          name: 'Flat',
          value: 20_000,
          status: 'financed',
          outstanding_balance: 12_000,
          installment_frequency: 'monthly',
          annual_rate: 12,
          interest_type: 'simple',
          installment_amount: 1_000,
          remaining_term: 20,
          remaining_term_unit: 'months',
        },
      ],
      expenses: [expense(2_000)],
    }
    // 12,000 at 1% a month less a 1,000 installment leaves 11,120, so the sale
    // nets 8,880; after the month's 3,000 shortfall 5,880 covers 2.94 months.
    expect(getRunwayYears(profile, FLAT)).toBeCloseTo(3.94 / 12, 6)
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

  test('a weekly loan pays 52 installments a year', () => {
    const weekly: ProfileLiability = {
      id: 'l',
      name: 'Loan',
      outstanding_balance: 5_200,
      installment_frequency: 'weekly',
      annual_rate: 0,
      installment_amount: 100,
      remaining_term: 1,
    }
    const profile: Profile = {
      ...BASE,
      cash_amount: 6_400,
      liabilities: [weekly],
      expenses: [expense(100)],
    }
    // 433.33 of loan and 100 of expenses a month for twelve months is exactly 6,400.
    expect(getRunwayYears(profile)).toBeCloseTo(1, 6)
  })

  test('a yearly installment on a term in months is spread over those months', () => {
    const yearly: ProfileLiability = {
      id: 'l',
      name: 'Loan',
      outstanding_balance: 1_800,
      installment_frequency: 'yearly',
      annual_rate: 0,
      installment_amount: 1_200,
      remaining_term: 18,
      remaining_term_unit: 'months',
    }
    const profile: Profile = {
      ...BASE,
      cash_amount: 3_600,
      liabilities: [yearly],
      expenses: [expense(100)],
    }
    // 100 of loan and 100 of expenses a month for eighteen months.
    expect(getRunwayYears(profile)).toBeCloseTo(1.5, 6)
  })

  test('defaults draw on cash and investments only, without growth', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 12_000,
      incomes: [income(1_000)],
      investments: [{ id: 'i', name: 'ETF', balance: 12_000, apy: 50 }],
      tangible_assets: [{ id: 't', name: 'Car', value: 12_000, status: 'fully_owned' }],
      expenses: [expense(2_000)],
    }
    expect(DEFAULT_RUNWAY_SETTINGS).toEqual({
      withdraw_investments: true,
      investment_growth: false,
      investment_tax_rate: 0,
      include_income: false,
      sell_tangible_assets: false,
      tangible_asset_growth: false,
      tangible_asset_tax_rate: 0,
    })
    expect(getRunwayYears(profile)).toBeCloseTo(1, 6)
  })

  test('uses the settings stored on the profile by default', () => {
    const profile: Profile = {
      ...BASE,
      cash_amount: 12_000,
      incomes: [income(1_000)],
      expenses: [expense(2_000)],
      runway_include_income: true,
    }
    expect(getRunwayYears(profile)).toBeCloseTo(1, 6)
  })
})

describe('changedRunwaySettings', () => {
  test('is empty when nothing differs from what the profile has', () => {
    expect(changedRunwaySettings(BASE, DEFAULT_RUNWAY_SETTINGS)).toEqual({})
    const stored: Profile = { ...BASE, runway_include_income: true }
    expect(
      changedRunwaySettings(stored, { ...DEFAULT_RUNWAY_SETTINGS, include_income: true }),
    ).toEqual({})
  })

  test('holds only the fields that changed, including a change back to the default', () => {
    expect(
      changedRunwaySettings(BASE, {
        ...DEFAULT_RUNWAY_SETTINGS,
        include_income: true,
        investment_growth: true,
        investment_tax_rate: 15,
      }),
    ).toEqual({
      runway_include_income: true,
      runway_investment_growth: true,
      runway_investment_tax_rate: 15,
    })
    const stored: Profile = { ...BASE, runway_include_income: true, runway_investment_growth: true }
    expect(changedRunwaySettings(stored, DEFAULT_RUNWAY_SETTINGS)).toEqual({
      runway_include_income: false,
      runway_investment_growth: false,
    })
  })

  test('leaves a tax rate alone while it is not shown', () => {
    const hidden: RunwaySettings = { ...DEFAULT_RUNWAY_SETTINGS, investment_tax_rate: 150 }
    expect(changedRunwaySettings(BASE, hidden)).toEqual({})
    const stored: Profile = { ...BASE, runway_investment_tax_rate: 20 }
    expect(changedRunwaySettings(stored, { ...hidden, investment_growth: false })).toEqual({})
    expect(changedRunwaySettings(stored, { ...hidden, investment_growth: true })).toEqual({
      runway_investment_growth: true,
      runway_investment_tax_rate: 150,
    })
  })
})

describe('validRunwaySettings', () => {
  test('accepts tax rates from 0 to 100 and rejects the rest, where they are shown', () => {
    expect(validTaxRate(0)).toBe(true)
    expect(validTaxRate(100)).toBe(true)
    expect(validTaxRate(-1)).toBe(false)
    expect(validTaxRate(101)).toBe(false)
    const shown: RunwaySettings = {
      ...FLAT,
      investment_growth: true,
      tangible_asset_growth: true,
    }
    expect(validRunwaySettings(shown)).toBe(true)
    expect(validRunwaySettings({ ...shown, investment_tax_rate: 100 })).toBe(true)
    expect(validRunwaySettings({ ...shown, investment_tax_rate: -1 })).toBe(false)
    expect(validRunwaySettings({ ...shown, tangible_asset_tax_rate: 101 })).toBe(false)
    // A rate the dialog does not show cannot block Apply.
    expect(
      validRunwaySettings({ ...shown, investment_growth: false, investment_tax_rate: -1 }),
    ).toBe(true)
    expect(
      validRunwaySettings({ ...shown, sell_tangible_assets: false, tangible_asset_tax_rate: 101 }),
    ).toBe(true)
  })
})
