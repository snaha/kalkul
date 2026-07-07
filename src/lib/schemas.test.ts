import { addMessages, init } from 'svelte-i18n'

import { describe, expect, it } from 'vitest'

import en from './locales/en.json'
import { expenseSchema, incomeSchema, timingComplete, transferSchema } from './schemas'
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
