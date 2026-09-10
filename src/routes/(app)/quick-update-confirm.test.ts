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
  // Loans amortize on the store's own clock. Submitting the page's projected
  // balances would stamp them as user-confirmed values computed from a clock
  // read when the dashboard rendered — possibly yesterday.
  test('submits nothing the dialog does not ask about', () => {
    const updates = buildConfirmUpdates(STORED, 9_415.61, new Map())
    expect(Object.keys(updates).sort()).toEqual(['cash_amount', 'investments'])
  })

  test('uses the confirmed value for an investment and the stored one otherwise', () => {
    const updates = buildConfirmUpdates(STORED, 9_415.61, new Map([['inv1', 9_999]]))
    expect(updates.investments?.map((i) => i.balance)).toEqual([9_999, 7_436.14, 50_000])
  })

  test('keeps an investment the dialog did not ask about, at its stored balance', () => {
    // Quick update asks only about what the user holds today, so a position
    // bought in a future year is not on the list. Confirming must neither drop
    // it from the profile nor rewrite the amount the plan is going to buy.
    const updates = buildConfirmUpdates(
      STORED,
      9_415.61,
      new Map([
        ['inv1', 9_999],
        ['inv2', 7_500],
      ]),
    )
    expect(updates.investments?.[2]).toEqual({
      id: 'inv3',
      name: 'Future ETF',
      balance: 50_000,
      apy: 6,
      start: 'at_specific_date',
      start_year: 2035,
    })
  })

  test('keeps the rest of each investment intact', () => {
    const updates = buildConfirmUpdates(STORED, 9_415.61, new Map([['inv1', 9_999]]))
    expect(updates.investments?.[0]).toEqual({ id: 'inv1', name: 'ETF', balance: 9_999, apy: 10 })
  })

  test('passes the confirmed cash amount through', () => {
    expect(buildConfirmUpdates(STORED, 1_234.56, new Map()).cash_amount).toBe(1_234.56)
  })
})
