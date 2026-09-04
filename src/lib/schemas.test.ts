import { addMessages, init } from 'svelte-i18n'

import { describe, expect, it, vi } from 'vitest'

import en from './locales/en.json'
import {
  expenseSchema,
  incomeSchema,
  profileInvestmentSchema,
  profileLiabilitySchema,
  profileSchema,
  profileTangibleAssetSchema,
  remainingTermUnitSchema,
  repairStoredCashFlowMonths,
  storedDataSchema,
  timingComplete,
  transferSchema,
} from './schemas'
import type { CashFlowEnd, CashFlowStart, Expense, Income, Transfer } from './schemas'

// The temporal refinement resolves its error messages through svelte-i18n at
// parse time, so the locale must be initialized before any failing parse.
addMessages('en', en)
init({ fallbackLocale: 'en', initialLocale: 'en' })

interface TimingVariant<M> {
  mode: M
  year?: number
  month?: number
  age?: number
}

const startVariants: TimingVariant<CashFlowStart>[] = [
  { mode: 'immediately' },
  { mode: 'now' },
  { mode: 'at_specific_date', year: 2030, month: 6 },
  { mode: 'at_specific_date', year: 2030 },
  { mode: 'at_specific_date', month: 6 },
  { mode: 'at_specific_date' },
  { mode: 'when_age_is', age: 40 },
  { mode: 'when_age_is' },
]

const endVariants: TimingVariant<CashFlowEnd>[] = [
  { mode: 'never' },
  { mode: 'at_specific_date', year: 2040, month: 12 },
  { mode: 'at_specific_date', year: 2040 },
  { mode: 'at_specific_date', month: 12 },
  { mode: 'at_specific_date' },
  { mode: 'when_age_is', age: 60 },
  { mode: 'when_age_is' },
]

function label(variant: TimingVariant<CashFlowStart | CashFlowEnd>): string {
  const fields = [
    variant.year !== undefined ? 'year' : undefined,
    variant.month !== undefined ? 'month' : undefined,
    variant.age !== undefined ? 'age' : undefined,
  ].filter((f) => f !== undefined)
  return `${variant.mode}(${fields.join('+') || 'no fields'})`
}

describe('timingComplete', () => {
  it('requires year and month for at_specific_date', () => {
    expect(timingComplete('at_specific_date', 2030, 6, undefined)).toBe(true)
    expect(timingComplete('at_specific_date', 2030, undefined, undefined)).toBe(false)
    expect(timingComplete('at_specific_date', undefined, 6, undefined)).toBe(false)
    expect(timingComplete('at_specific_date', undefined, undefined, undefined)).toBe(false)
  })

  it('requires age for when_age_is', () => {
    expect(timingComplete('when_age_is', undefined, undefined, 40)).toBe(true)
    expect(timingComplete('when_age_is', undefined, undefined, undefined)).toBe(false)
  })

  it('is always complete for modes without extra fields', () => {
    expect(timingComplete('immediately', undefined, undefined, undefined)).toBe(true)
    expect(timingComplete('now', undefined, undefined, undefined)).toBe(true)
    expect(timingComplete('never', undefined, undefined, undefined)).toBe(true)
  })

  describe('matches the cashFlowTemporalRefinement accept/reject behavior', () => {
    for (const start of startVariants) {
      for (const end of endVariants) {
        it(`start=${label(start)} end=${label(end)}`, () => {
          const income = {
            id: 'income-1',
            name: 'Salary',
            amount: 1000,
            frequency: 'monthly' as const,
            withhold_taxes: false,
            change_over_time: 'none' as const,
            start: start.mode,
            start_year: start.year,
            start_month: start.month,
            start_age: start.age,
            end: end.mode,
            end_year: end.year,
            end_month: end.month,
            end_age: end.age,
          }
          const expected =
            timingComplete(start.mode, start.year, start.month, start.age) &&
            timingComplete(end.mode, end.year, end.month, end.age)
          expect(incomeSchema.safeParse(income).success).toBe(expected)
        })
      }
    }
  })
})

const baseIncome: Income = {
  id: 'income-1',
  name: 'Salary',
  amount: 1000,
  frequency: 'monthly',
  withhold_taxes: false,
  start: 'immediately',
  end: 'never',
  change_over_time: 'none',
}

const baseExpense: Expense = {
  id: 'expense-1',
  name: 'Rent',
  amount: 500,
  frequency: 'monthly',
  start: 'immediately',
  end: 'never',
  change_over_time: 'none',
}

const baseTransfer: Transfer = {
  id: 'transfer-1',
  name: 'Monthly savings',
  from_asset_id: 'cash',
  to_asset_id: 'investment-1',
  amount: 200,
  schedule: 'recurring',
  frequency: 'monthly',
  start: 'immediately',
  end: 'never',
  change_over_time: 'none',
}

interface TemporalFields {
  start?: Income['start']
  start_year?: number
  start_month?: number
  end?: Income['end']
  end_year?: number
  end_month?: number
}

const sameYearInverted: TemporalFields = {
  start: 'at_specific_date',
  start_year: 2030,
  start_month: 8,
  end: 'at_specific_date',
  end_year: 2030,
  end_month: 3,
}

describe('cash flow month order validation', () => {
  it('rejects an income with start month after end month in the same year', () => {
    const result = incomeSchema.safeParse({ ...baseIncome, ...sameYearInverted })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1)
      expect(result.error.issues[0].path).toEqual(['end_month'])
      expect(result.error.issues[0].message).toBe(
        'End month must not be before start month in the same year',
      )
    }
  })

  it('rejects an expense with start month after end month in the same year', () => {
    const result = expenseSchema.safeParse({ ...baseExpense, ...sameYearInverted })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['end_month'])
    }
  })

  it('rejects a recurring transfer with start month after end month in the same year', () => {
    const result = transferSchema.safeParse({ ...baseTransfer, ...sameYearInverted })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['end_month'])
    }
  })

  it('accepts a same-year range with start month before end month', () => {
    const result = incomeSchema.safeParse({
      ...baseIncome,
      ...sameYearInverted,
      start_month: 3,
      end_month: 8,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a same-year range starting and ending in the same month', () => {
    const result = incomeSchema.safeParse({
      ...baseIncome,
      ...sameYearInverted,
      start_month: 6,
      end_month: 6,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a later start month when the end year is later', () => {
    const result = incomeSchema.safeParse({
      ...baseIncome,
      ...sameYearInverted,
      end_year: 2031,
    })
    expect(result.success).toBe(true)
  })

  it('accepts an open-ended cash flow regardless of start month', () => {
    const result = incomeSchema.safeParse({
      ...baseIncome,
      start: 'at_specific_date',
      start_year: 2030,
      start_month: 12,
      end: 'never',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an age-based end regardless of start month', () => {
    const result = incomeSchema.safeParse({
      ...baseIncome,
      start: 'at_specific_date',
      start_year: 2030,
      start_month: 12,
      end: 'when_age_is',
      end_age: 65,
    })
    expect(result.success).toBe(true)
  })
})

describe('repairStoredCashFlowMonths', () => {
  function storedWithInverted() {
    return {
      lastUpdated: 1,
      profile: {
        name: 'Test',
        email: '',
        incomes: [{ ...baseIncome, ...sameYearInverted }],
        expenses: [{ ...baseExpense, ...sameYearInverted }],
        transfers: [{ ...baseTransfer, ...sameYearInverted }],
      },
      portfolios: [
        {
          id: 'portfolio-1',
          name: 'Plan',
          start_date: '2026-01-01',
          end_date: '2060-01-01',
          inflation_rate: 2,
        },
      ],
    }
  }

  it('swaps inverted same-year months everywhere so stored data still parses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const repaired = storedDataSchema.parse(repairStoredCashFlowMonths(storedWithInverted()))
    expect(repaired.profile.incomes?.[0]).toMatchObject({ start_month: 3, end_month: 8 })
    expect(repaired.profile.expenses?.[0]).toMatchObject({ start_month: 3, end_month: 8 })
    expect(repaired.profile.transfers?.[0]).toMatchObject({ start_month: 3, end_month: 8 })
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })

  it('leaves an ordered same-year range untouched', () => {
    const stored = storedWithInverted()
    stored.profile.incomes[0].start_month = 3
    stored.profile.incomes[0].end_month = 8
    repairStoredCashFlowMonths(stored)
    expect(stored.profile.incomes[0]).toMatchObject({ start_month: 3, end_month: 8 })
  })

  it('leaves months in different years untouched', () => {
    const stored = storedWithInverted()
    stored.profile.incomes[0].end_year = 2031
    repairStoredCashFlowMonths(stored)
    expect(stored.profile.incomes[0]).toMatchObject({ start_month: 8, end_month: 3 })
  })

  it('passes through data that is not a stored-data object', () => {
    expect(repairStoredCashFlowMonths(undefined)).toBe(undefined)
    expect(repairStoredCashFlowMonths('not an object')).toBe('not an object')
    expect(repairStoredCashFlowMonths({ profile: 'malformed', portfolios: 42 })).toEqual({
      profile: 'malformed',
      portfolios: 42,
    })
  })
})

describe('planned timing refinement', () => {
  const investment = { id: 'i1', name: 'Fund', balance: 100, apy: 5 }
  const asset = { id: 't1', name: 'House', value: 100, status: 'fully_owned' as const }

  it('requires a year and month for an investment starting at a specific date', () => {
    const result = profileInvestmentSchema.safeParse({ ...investment, start: 'at_specific_date' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['start_year'])
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['start_month'])
    }
  })

  it('requires an age for an investment exiting when age is', () => {
    const result = profileInvestmentSchema.safeParse({ ...investment, exit: 'when_age_is' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['exit_age'])
    }
  })

  it('accepts an investment with complete timing, and one with none at all', () => {
    expect(
      profileInvestmentSchema.safeParse({
        ...investment,
        start: 'at_specific_date',
        start_year: 2030,
        start_month: 5,
        exit: 'when_age_is',
        exit_age: 65,
      }).success,
    ).toBe(true)
    expect(profileInvestmentSchema.safeParse(investment).success).toBe(true)
  })

  it('requires a year and month for a purchase at a specific date', () => {
    const result = profileTangibleAssetSchema.safeParse({ ...asset, purchase: 'at_specific_date' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['purchase_year'])
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['purchase_month'])
    }
  })

  it('requires an age for a sale when age is', () => {
    const result = profileTangibleAssetSchema.safeParse({ ...asset, sale: 'when_age_is' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['sale_age'])
    }
  })

  it('accepts a tangible asset with complete timing, and one with none at all', () => {
    expect(
      profileTangibleAssetSchema.safeParse({
        ...asset,
        purchase: 'at_specific_date',
        purchase_year: 2030,
        purchase_month: 5,
        sale: 'at_specific_date',
        sale_year: 2040,
        sale_month: 2,
      }).success,
    ).toBe(true)
    expect(profileTangibleAssetSchema.safeParse(asset).success).toBe(true)
  })
})

describe('profileTangibleAssetSchema financed refinement', () => {
  const financed = {
    id: 'asset-1',
    name: 'House',
    value: 1_000_000,
    status: 'financed' as const,
    outstanding_balance: 500_000,
    installment_frequency: 'monthly' as const,
    annual_rate: 4.5,
    installment_amount: 2_500,
    remaining_term: 25,
  }

  it('accepts a fully populated financed asset', () => {
    expect(profileTangibleAssetSchema.safeParse(financed).success).toBe(true)
  })

  it('accepts a fully-owned asset without any financing fields', () => {
    const result = profileTangibleAssetSchema.safeParse({
      id: 'asset-2',
      name: 'Car',
      value: 15_000,
      status: 'fully_owned',
    })
    expect(result.success).toBe(true)
  })

  const requiredWhenFinanced = [
    'outstanding_balance',
    'installment_frequency',
    'annual_rate',
    'installment_amount',
    'remaining_term',
  ] as const

  for (const field of requiredWhenFinanced) {
    it(`requires ${field} when financed`, () => {
      const { [field]: _omitted, ...withoutField } = financed
      const result = profileTangibleAssetSchema.safeParse(withoutField)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.map((i) => i.path)).toContainEqual([field])
      }
    })
  }
})

describe('transferSchema refinement', () => {
  const oneTime: Transfer = {
    id: 'transfer-1',
    name: 'Deposit',
    from_asset_id: 'cash',
    to_asset_id: 'inv-1',
    amount: 1000,
    schedule: 'one_time',
    transaction_year: 2030,
    transaction_month: 6,
  }

  it('accepts a valid one-time transfer', () => {
    expect(transferSchema.safeParse(oneTime).success).toBe(true)
  })

  it('rejects identical endpoints', () => {
    const result = transferSchema.safeParse({ ...oneTime, to_asset_id: 'cash' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['to_asset_id'])
    }
  })

  it('requires transaction year and month for one-time transfers', () => {
    const { transaction_year: _y, transaction_month: _m, ...bare } = oneTime
    const result = transferSchema.safeParse(bare)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      expect(paths).toContainEqual(['transaction_year'])
      expect(paths).toContainEqual(['transaction_month'])
    }
  })

  it('requires frequency, start, end, and change_over_time for recurring transfers', () => {
    const result = transferSchema.safeParse({
      id: 'transfer-2',
      name: 'Savings',
      from_asset_id: 'cash',
      to_asset_id: 'inv-1',
      amount: 100,
      schedule: 'recurring',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      for (const field of ['frequency', 'start', 'end', 'change_over_time']) {
        expect(paths).toContainEqual([field])
      }
    }
  })

  it('re-checks the nested temporal refinement for recurring transfers', () => {
    const result = transferSchema.safeParse({
      id: 'transfer-3',
      name: 'Savings',
      from_asset_id: 'cash',
      to_asset_id: 'inv-1',
      amount: 100,
      schedule: 'recurring',
      frequency: 'monthly',
      start: 'at_specific_date',
      end: 'never',
      change_over_time: 'none',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      expect(paths).toContainEqual(['start_year'])
      expect(paths).toContainEqual(['start_month'])
    }
  })
})

describe('remainingTermUnitSchema', () => {
  it('accepts years and months', () => {
    expect(remainingTermUnitSchema.safeParse('years').success).toBe(true)
    expect(remainingTermUnitSchema.safeParse('months').success).toBe(true)
  })

  it('rejects anything else', () => {
    expect(remainingTermUnitSchema.safeParse('fortnights').success).toBe(false)
    expect(remainingTermUnitSchema.safeParse(undefined).success).toBe(false)
  })

  it('accepts an explicit unit on a financed tangible asset', () => {
    expect(
      profileTangibleAssetSchema.safeParse({
        id: 'asset-1',
        name: 'House',
        value: 1_000_000,
        status: 'financed',
        outstanding_balance: 500_000,
        installment_frequency: 'monthly',
        annual_rate: 4.5,
        installment_amount: 2_500,
        remaining_term: 180,
        remaining_term_unit: 'months',
      }).success,
    ).toBe(true)
  })

  it('accepts an explicit unit on a liability', () => {
    expect(
      profileLiabilitySchema.safeParse({
        id: 'liab-1',
        name: 'Car loan',
        outstanding_balance: 20_000,
        installment_frequency: 'monthly',
        annual_rate: 6,
        installment_amount: 400,
        remaining_term: 48,
        remaining_term_unit: 'months',
      }).success,
    ).toBe(true)
  })

  it('treats an absent unit as valid (defaults to years for back-compat)', () => {
    expect(
      profileLiabilitySchema.safeParse({
        id: 'liab-1',
        name: 'Car loan',
        outstanding_balance: 20_000,
        installment_frequency: 'monthly',
        annual_rate: 6,
        installment_amount: 400,
        remaining_term: 4,
      }).success,
    ).toBe(true)
  })

  it('rejects an invalid unit on a financed tangible asset', () => {
    const result = profileTangibleAssetSchema.safeParse({
      id: 'asset-1',
      name: 'House',
      value: 1_000_000,
      status: 'financed',
      outstanding_balance: 500_000,
      installment_frequency: 'monthly',
      annual_rate: 4.5,
      installment_amount: 2_500,
      remaining_term: 180,
      remaining_term_unit: 'fortnights',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['remaining_term_unit'])
    }
  })
})

describe('profileSchema language', () => {
  it('accepts a supported language', () => {
    expect(profileSchema.safeParse({ name: 'A', email: 'a@b.c', language: 'cs' }).success).toBe(
      true,
    )
    expect(profileSchema.safeParse({ name: 'A', email: 'a@b.c', language: 'en' }).success).toBe(
      true,
    )
  })

  it('rejects an unsupported language', () => {
    const result = profileSchema.safeParse({ name: 'A', email: 'a@b.c', language: 'hu' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual(['language'])
    }
  })

  it('does not require a language (browser auto-detect remains the fallback)', () => {
    expect(profileSchema.safeParse({ name: 'A', email: 'a@b.c' }).success).toBe(true)
  })
})

// The cheap regression guard against schema changes invalidating existing
// localStorage: a realistic fully-populated payload must always parse. If a
// stricter rule is ever added, this fixture fails first — BEFORE real users
// hit the salvage path on load. (Valid data never resolves refinement
// messages, so no locale lookup happens on this path — though this suite
// initializes svelte-i18n above, so it does not prove that on its own.)
describe('storedDataSchema golden fixture', () => {
  it('parses a realistic fully-populated payload', () => {
    const golden = {
      lastUpdated: 1_784_000_000_000,
      profile: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        birth_date: '1990-06-01',
        location: 'CZ',
        currency: 'CZK',
        cash_amount: 250_000,
        has_investments: true,
        has_tangible_assets: true,
        has_liabilities: true,
        investments: [
          {
            id: 'inv-1',
            name: 'ETF portfolio',
            balance: 800_000,
            apy: 7,
            ter: 0.2,
            entry_fee: 1,
            entry_fee_type: 'forty-sixty',
            exit_fee: 0.5,
            exit_fee_type: 'percentage',
            start: 'at_specific_date',
            start_year: 2030,
            start_month: 5,
            exit: 'when_age_is',
            exit_age: 65,
          },
        ],
        tangible_assets: [
          {
            id: 'asset-1',
            name: 'Apartment',
            value: 6_500_000,
            status: 'financed',
            outstanding_balance: 3_200_000,
            installment_frequency: 'monthly',
            annual_rate: 4.79,
            installment_amount: 18_500,
            remaining_term: 22,
            interest_type: 'compound',
            compounding_frequency: 'monthly',
            purchase: 'at_specific_date',
            purchase_year: 2029,
            purchase_month: 3,
            sale: 'when_age_is',
            sale_age: 70,
            value_over_time: 'appreciate',
            value_rate: 1.5,
            property_tax_rate: 0.2,
          },
          { id: 'asset-2', name: 'Car', value: 250_000, status: 'fully_owned' },
        ],
        liabilities: [
          {
            id: 'liab-1',
            name: 'Student loan',
            outstanding_balance: 120_000,
            installment_frequency: 'monthly',
            annual_rate: 3.5,
            installment_amount: 2_000,
            remaining_term: 6,
            interest_type: 'compound',
            compounding_frequency: 'monthly',
          },
        ],
        incomes: [
          {
            id: 'income-1',
            name: 'Salary',
            amount: 65_000,
            frequency: 'monthly',
            withhold_taxes: true,
            tax_percentage: 23,
            start: 'immediately',
            end: 'when_age_is',
            end_age: 65,
            inflation_adjusted: true,
            change_over_time: 'increase_yearly',
            change_percentage: 2,
          },
        ],
        expenses: [
          {
            id: 'expense-1',
            name: 'Living costs',
            amount: 35_000,
            frequency: 'monthly',
            start: 'immediately',
            end: 'never',
            inflation_adjusted: true,
            change_over_time: 'none',
          },
        ],
        transfers: [
          {
            id: 'transfer-1',
            name: 'Monthly investing',
            from_asset_id: 'cash',
            to_asset_id: 'inv-1',
            amount: 10_000,
            schedule: 'recurring',
            frequency: 'monthly',
            start: 'immediately',
            end: 'when_age_is',
            end_age: 60,
            inflation_adjusted: true,
            change_over_time: 'none',
          },
          {
            id: 'transfer-2',
            name: 'Sell the car',
            from_asset_id: 'asset-2',
            to_asset_id: 'cash',
            amount: 0,
            transfer_all: true,
            schedule: 'one_time',
            transaction_year: 2032,
            transaction_month: 6,
          },
        ],
      },
      portfolios: [
        {
          id: 'portfolio-1',
          name: 'Retirement',
          notes: 'Base scenario',
          start_date: '2026-07-01',
          end_date: '2055-06-01',
          inflation_rate: 0.02,
          include_cash: true,
          included_investment_ids: ['inv-1'],
          included_tangible_asset_ids: ['asset-1', 'asset-2'],
          included_liability_ids: ['liab-1'],
          included_income_ids: ['income-1'],
          included_expense_ids: ['expense-1'],
          included_transfer_ids: ['transfer-1', 'transfer-2'],
        },
      ],
    }
    const result = storedDataSchema.safeParse(golden)
    expect(result.success).toBe(true)
    // Zod strips unknown keys, so parse success alone would not catch a field
    // missing from the schema — assert the financing interest options survive.
    expect(result.data?.profile.tangible_assets?.[0]).toMatchObject({
      interest_type: 'compound',
      compounding_frequency: 'monthly',
      purchase: 'at_specific_date',
      purchase_year: 2029,
      sale: 'when_age_is',
      sale_age: 70,
      value_over_time: 'appreciate',
      value_rate: 1.5,
      property_tax_rate: 0.2,
    })
    expect(result.data?.profile.investments?.[0]).toMatchObject({
      start: 'at_specific_date',
      start_year: 2030,
      exit: 'when_age_is',
      exit_age: 65,
    })
  })
})

describe('profileSchema tax rules', () => {
  it('round-trips investment and tangible asset tax rules, including half-filled ones', () => {
    const profile = {
      name: 'Test',
      email: '',
      investment_tax_rules: [
        { id: 'r1', rate: 15, holding_period: 'less_than', holding_years: 3 },
        { id: 'r2', holding_period: 'more_than' },
      ],
      tangible_asset_tax_rules: [
        { id: 'r3', rate: 0, holding_period: 'more_than', holding_years: 5 },
      ],
    }
    expect(profileSchema.parse(profile)).toEqual(profile)
  })

  it('rejects an unknown holding period', () => {
    expect(() =>
      profileSchema.parse({
        name: 'Test',
        email: '',
        investment_tax_rules: [{ id: 'r1', holding_period: 'between' }],
      }),
    ).toThrow()
  })
})
