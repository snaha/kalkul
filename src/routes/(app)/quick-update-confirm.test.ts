import { describe, expect, test } from 'vitest'

import type { Profile } from '$lib/schemas'

import { buildConfirmUpdates } from './quick-update-confirm'

// Balances as getCurrentProfile would return them today: cash and investments
// grown, loan balances amortized down from their stored values.
const PROJECTED: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 9_415.61,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 10_296.57, apy: 10 },
    { id: 'inv2', name: 'Bonds', balance: 7_436.14, apy: 4.2, ter: 0.35 },
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
  test('carries the projected loan balances the dialog does not ask about', () => {
    const updates = buildConfirmUpdates(PROJECTED, 9_415.61, new Map())
    expect(updates.liabilities?.[0].outstanding_balance).toBe(4_537.98)
    expect(updates.tangible_assets?.[0].outstanding_balance).toBe(197_487.47)
    expect(updates.tangible_assets?.[0].value).toBe(300_000)
  })

  test('uses the edited value for an investment and the suggestion otherwise', () => {
    const updates = buildConfirmUpdates(PROJECTED, 9_415.61, new Map([['inv1', 9_999]]))
    expect(updates.investments?.map((i) => i.balance)).toEqual([9_999, 7_436.14])
  })

  test('passes the confirmed cash amount through', () => {
    expect(buildConfirmUpdates(PROJECTED, 1_234.56, new Map()).cash_amount).toBe(1_234.56)
  })
})
