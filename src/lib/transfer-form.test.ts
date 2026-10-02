import { describe, expect, test } from 'vitest'

import { planRangeOf } from '$lib/plan-range'
import type { ProfileInvestment, Transfer } from '$lib/schemas'
import {
  blankTransferFields,
  endMinMonth,
  transferFromFields,
  transferInvestments,
  transferToFields,
  transferWithinPlan,
} from '$lib/transfer-form'

const RECURRING: Transfer = {
  id: 't1',
  name: 'ETF',
  from_asset_id: 'cash',
  to_asset_id: 'inv1',
  amount: 600,
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

describe('transfer-form round trip', () => {
  test('a new transfer defaults to immediately, like every other editor', () => {
    expect(blankTransferFields('x', 'X').start).toBe('immediately')
  })

  test('recurring transfer survives fields → stored unchanged', () => {
    expect(transferFromFields(transferToFields(RECURRING))).toEqual(RECURRING)
  })

  test('one-time transfer keeps only the transaction date', () => {
    const oneTime: Transfer = {
      id: 't2',
      name: 'Car',
      from_asset_id: 'cash',
      to_asset_id: 'inv1',
      amount: 10_000,
      schedule: 'one_time',
      transaction_year: 2030,
      transaction_month: 6,
    }
    const stored = transferFromFields(transferToFields(oneTime))
    expect(stored).toEqual(oneTime)
    expect('start' in stored).toBe(false)
    expect('frequency' in stored).toBe(false)
  })

  test('drops timing fields the chosen start/end mode does not use', () => {
    const f = transferToFields(RECURRING)
    f.start = 'immediately'
    f.end = 'never'
    f.change_over_time = 'none'
    const stored = transferFromFields(f)
    expect(stored.start_year).toBeUndefined()
    expect(stored.start_month).toBeUndefined()
    expect(stored.end_age).toBeUndefined()
    expect(stored.change_percentage).toBeUndefined()
  })

  test('transfer_all zeroes the amount and is omitted when off', () => {
    const f = transferToFields(RECURRING)
    f.transfer_all = true
    const stored = transferFromFields(f)
    expect(stored.amount).toBe(0)
    expect(stored.transfer_all).toBe(true)
    expect('transfer_all' in transferFromFields(transferToFields(RECURRING))).toBe(false)
  })

  test('legacy match_inflation folds into the inflation toggle', () => {
    const legacy: Transfer = {
      ...RECURRING,
      inflation_adjusted: undefined,
      change_over_time: 'match_inflation',
    }
    const f = transferToFields(legacy)
    expect(f.inflation_adjusted).toBe(true)
    expect(f.change_over_time).toBe('none')
    const stored = transferFromFields(f)
    expect(stored.inflation_adjusted).toBe(true)
    expect(stored.change_over_time).toBe('none')
  })
})

describe('plan ownership', () => {
  test('a blank transfer has no owner', () => {
    expect(blankTransferFields('x', 'X').plan_id).toBeUndefined()
  })

  test('plan_id round-trips and is omitted when unset', () => {
    const owned: Transfer = { ...RECURRING, plan_id: 'plan-1' }
    expect(transferFromFields(transferToFields(owned))).toEqual(owned)
    expect('plan_id' in transferFromFields(transferToFields(RECURRING))).toBe(false)
  })
})

describe('transferInvestments', () => {
  const investment = (id: string, plan_id?: string): ProfileInvestment => ({
    id,
    name: id,
    balance: 1000,
    apy: 5,
    ...(plan_id ? { plan_id } : {}),
  })
  const shared = investment('shared')
  const own = investment('own', 'plan-1')
  const other = investment('other', 'plan-2')
  const all = [shared, own, other]

  test('financial data offers the shared investments only', () => {
    expect(transferInvestments(all)).toEqual([shared])
  })

  test("a plan with no include list offers the shared ones and its own, not another plan's", () => {
    expect(transferInvestments(all, { id: 'plan-1' })).toEqual([shared, own])
  })

  test("a plan's include list narrows what it offers", () => {
    expect(transferInvestments(all, { id: 'plan-1', included_investment_ids: ['own'] })).toEqual([
      own,
    ])
  })

  test("another plan's investment stays out even when the include list names it", () => {
    expect(
      transferInvestments(all, { id: 'plan-1', included_investment_ids: ['shared', 'other'] }),
    ).toEqual([shared])
  })

  test('treats a missing list as empty', () => {
    expect(transferInvestments(undefined)).toEqual([])
    expect(transferInvestments(undefined, { id: 'plan-1' })).toEqual([])
  })
})

describe('endMinMonth', () => {
  test('is the start month only when both dates are in the same year', () => {
    const f = transferToFields(RECURRING)
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
    expect(blankTransferFields('x', 'Move', range).transaction_year).toBe(2030)
    expect(blankTransferFields('x', 'Move').transaction_year).toBe(new Date().getFullYear())
  })

  test('a one-time date must fall inside the plan', () => {
    const f = blankTransferFields('x', 'Move', range)
    expect(transferWithinPlan(f, range)).toBe(true)
    f.transaction_year = 2029
    expect(transferWithinPlan(f, range)).toBe(false)
  })

  test('recurring timing may only start before the plan ends and end after it starts', () => {
    const f = transferToFields(RECURRING)
    expect(transferWithinPlan(f, range)).toBe(true)
    f.start_year = 2041
    expect(transferWithinPlan(f, range)).toBe(false)
    f.start_year = 2035
    f.end = 'at_specific_date'
    f.end_year = 2029
    expect(transferWithinPlan(f, range)).toBe(false)
  })
})
