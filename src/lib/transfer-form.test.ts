import { describe, expect, test } from 'vitest'

import type { Transfer } from '$lib/schemas'
import {
  blankTransferFields,
  endMinMonth,
  transferFromFields,
  transferToFields,
  usesAdvancedTiming,
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

describe('usesAdvancedTiming', () => {
  test('false for the blank defaults', () => {
    expect(usesAdvancedTiming(blankTransferFields('x', 'X'))).toBe(false)
  })

  test('true when start, end or change differs from the default', () => {
    const blank = blankTransferFields('x', 'X')
    expect(usesAdvancedTiming({ ...blank, start: 'now' })).toBe(true)
    expect(usesAdvancedTiming({ ...blank, end: 'at_specific_date' })).toBe(true)
    expect(usesAdvancedTiming({ ...blank, change_over_time: 'increase_yearly' })).toBe(true)
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
