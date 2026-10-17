import { describe, expect, test } from 'vitest'

import {
  blankCashFlowFields,
  cashFlowFromFields,
  cashFlowToFields,
  cashFlowWithinPlan,
  endMinMonth,
} from '$lib/cash-flow-form'
import { planRangeOf } from '$lib/plan-range'
import type { Income } from '$lib/schemas'

const RECURRING: Income = {
  id: 'i1',
  name: 'Salary',
  amount: 5_000,
  inflation_adjusted: true,
  schedule: 'recurring',
  frequency: 'monthly',
  start: 'at_specific_date',
  start_year: 2027,
  start_month: 3,
  end: 'when_age_is',
  end_age: 60,
  change_over_time: 'increase_yearly',
  change_percentage: 2,
}

describe('cash-flow-form round trip', () => {
  test('a new item defaults to recurring, immediately, and monthly', () => {
    const blank = blankCashFlowFields('x', 'X')
    expect(blank.schedule).toBe('recurring')
    expect(blank.start).toBe('immediately')
    expect(blank.frequency).toBe('monthly')
    expect(blank.inflation_adjusted).toBe(true)
    expect(blank.amount).toBeUndefined()
  })

  test('a blank item seeds the transaction date with now, like transfers', () => {
    const blank = blankCashFlowFields('x', 'X')
    expect(blank.transaction_year).toBe(new Date().getFullYear())
    expect(blank.transaction_month).toBe(new Date().getMonth() + 1)
  })

  test('recurring item survives fields → stored unchanged', () => {
    expect(cashFlowFromFields(cashFlowToFields(RECURRING))).toEqual(RECURRING)
  })

  test('one-time item keeps only the transaction date', () => {
    const oneTime: Income = {
      id: 'i2',
      name: 'Bonus',
      amount: 10_000,
      schedule: 'one_time',
      transaction_year: 2030,
      transaction_month: 6,
    }
    const stored = cashFlowFromFields(cashFlowToFields(oneTime))
    expect(stored).toEqual(oneTime)
    expect('start' in stored).toBe(false)
    expect('frequency' in stored).toBe(false)
    expect('change_over_time' in stored).toBe(false)
  })

  test('drops timing fields the chosen start/end mode does not use', () => {
    const f = cashFlowToFields(RECURRING)
    f.start = 'immediately'
    f.end = 'never'
    f.change_over_time = 'none'
    const stored = cashFlowFromFields(f)
    expect(stored.start_year).toBeUndefined()
    expect(stored.start_month).toBeUndefined()
    expect(stored.end_age).toBeUndefined()
    expect(stored.change_percentage).toBeUndefined()
  })

  test('legacy match_inflation folds into the inflation toggle', () => {
    const legacy: Income = {
      ...RECURRING,
      inflation_adjusted: undefined,
      change_over_time: 'match_inflation',
    }
    const f = cashFlowToFields(legacy)
    expect(f.inflation_adjusted).toBe(true)
    expect(f.change_over_time).toBe('none')
    const stored = cashFlowFromFields(f)
    expect(stored.inflation_adjusted).toBe(true)
    expect(stored.change_over_time).toBe('none')
  })

  test('stored data without a schedule seeds as recurring', () => {
    // The schema defaults it, but the mapping must not depend on the parse.
    const legacy = { ...RECURRING, schedule: undefined } as unknown as Income
    expect(cashFlowToFields(legacy).schedule).toBe('recurring')
    const stored = cashFlowFromFields(cashFlowToFields(legacy))
    expect(stored.schedule).toBe('recurring')
  })
})

describe('endMinMonth', () => {
  test('is the start month only when both dates are in the same year', () => {
    const f = cashFlowToFields(RECURRING)
    f.end = 'at_specific_date'
    f.end_year = 2027
    expect(endMinMonth(f)).toBe(3)
    f.end_year = 2028
    expect(endMinMonth(f)).toBeUndefined()
    f.end = 'never'
    expect(endMinMonth(f)).toBeUndefined()
  })
})

describe('plan range', () => {
  const range = planRangeOf({ start_date: '2030-01-01', end_date: '2040-12-01' }, undefined)

  test('a new one-time date is seeded inside the plan when today is outside it', () => {
    const f = blankCashFlowFields('x', 'Bonus', range)
    expect(f.transaction_year).toBe(2030)
    expect(blankCashFlowFields('x', 'Bonus').transaction_year).toBe(new Date().getFullYear())
  })

  test('a one-time date must fall inside the plan', () => {
    const f = blankCashFlowFields('x', 'Bonus', range)
    f.schedule = 'one_time'
    expect(cashFlowWithinPlan(f, range)).toBe(true)
    f.transaction_year = 2041
    expect(cashFlowWithinPlan(f, range)).toBe(false)
  })

  test('recurring timing may only start before the plan ends and end after it starts', () => {
    const f = cashFlowToFields(RECURRING)
    expect(cashFlowWithinPlan(f, range)).toBe(true) // starts 2027, before the plan: clamped
    f.start_year = 2041
    expect(cashFlowWithinPlan(f, range)).toBe(false)
    f.start_year = 2035
    f.end = 'at_specific_date'
    f.end_year = 2029
    expect(cashFlowWithinPlan(f, range)).toBe(false)
    f.end_year = 2050
    expect(cashFlowWithinPlan(f, range)).toBe(true) // runs to the plan's last year
  })
})
