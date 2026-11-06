import { describe, expect, test } from 'vitest'

import type { Profile } from '$lib/schemas'

import { buildConfirmUpdates } from './quick-update-confirm'

// The stored profile: the list Confirm builds its payload from, so that
// nothing the dialog leaves out can be dropped or rewritten.
const STORED: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 9_415.61,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 10_296.57, apy: 10 },
    { id: 'inv2', name: 'Bonds', balance: 7_436.14, apy: 4.2, ter: 0.35 },
    // Bought in 2035, so Quick update never asks about it.
    {
      id: 'inv3',
      name: 'Future ETF',
      balance: 50_000,
      apy: 6,
      start: 'at_specific_date',
      start_year: 2035,
    },
  ],
  tangible_assets: [
    {
      id: 't1',
      name: 'House',
      value: 300_000,
      status: 'financed',
      outstanding_balance: 197_487.47,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 1_000,
      remaining_term: 20,
    },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Car loan',
      outstanding_balance: 4_537.98,
      installment_frequency: 'monthly',
      annual_rate: 12,
      installment_amount: 200,
      remaining_term: 3,
    },
  ],
}

describe('buildConfirmUpdates', () => {
  test('submits only cash and investments', () => {
    const { updates } = buildConfirmUpdates(STORED, 9_415.61, new Map())
    expect(Object.keys(updates).sort()).toEqual(['cash_amount', 'investments'])
  })

  test('uses the entered value for an investment and the stored one otherwise', () => {
    const { updates } = buildConfirmUpdates(STORED, undefined, new Map([['inv1', 9_999]]))
    expect(updates.investments?.map((i) => i.balance)).toEqual([9_999, 7_436.14, 50_000])
  })

  test('keeps the rest of each investment intact', () => {
    const { updates } = buildConfirmUpdates(STORED, undefined, new Map([['inv1', 9_999]]))
    expect(updates.investments?.[0]).toEqual({ id: 'inv1', name: 'ETF', balance: 9_999, apy: 10 })
    expect(updates.investments?.[2]).toEqual(STORED.investments?.[2])
  })

  test('passes entered cash through', () => {
    expect(buildConfirmUpdates(STORED, 1_234.56, new Map()).updates.cash_amount).toBe(1_234.56)
  })

  test('leaves cash out when it was not entered', () => {
    expect(buildConfirmUpdates(STORED, undefined, new Map()).updates).not.toHaveProperty(
      'cash_amount',
    )
  })

  test('reports which figures were entered', () => {
    const { entered } = buildConfirmUpdates(STORED, 0, new Map([['inv2', 7_500]]))
    expect(entered).toEqual({ cash: true, investmentIds: new Set(['inv2']) })
  })

  test('reports nothing entered for an untouched dialog', () => {
    const { entered } = buildConfirmUpdates(STORED, undefined, new Map())
    expect(entered).toEqual({ cash: false, investmentIds: new Set() })
  })
})
