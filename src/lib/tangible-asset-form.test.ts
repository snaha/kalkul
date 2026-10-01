import { describe, expect, it } from 'vitest'

import {
  type TangibleAssetUI,
  downPaymentOf,
  outstandingBalance,
  toStoredTangibleAsset,
} from '$lib/tangible-asset-form'

const base: TangibleAssetUI = {
  id: 't1',
  name: 'House',
  value: 1000,
  status: 'fully_owned',
  outstanding_balance: undefined,
  installment_frequency: 'monthly',
  annual_rate: undefined,
  installment_amount: undefined,
  remaining_term: undefined,
  remaining_term_unit: 'years',
  value_over_time: 'appreciate',
  value_rate: undefined,
  property_tax_rate: undefined,
  showAdvanced: false,
  editing: false,
}

describe('toStoredTangibleAsset', () => {
  it('leaves value_over_time unset when no rate was entered', () => {
    expect(toStoredTangibleAsset(base, undefined).value_over_time).toBeUndefined()
  })

  it('keeps value_over_time once a rate is set', () => {
    const stored = toStoredTangibleAsset({ ...base, value_rate: 3 }, undefined)
    expect(stored.value_over_time).toBe('appreciate')
    expect(stored.value_rate).toBe(3)
  })

  it('carries plan-dialog-only fields through from the stored asset', () => {
    const prev = {
      ...toStoredTangibleAsset(base, undefined),
      purchase: 'at_specific_date' as const,
    }
    expect(toStoredTangibleAsset(base, prev).purchase).toBe('at_specific_date')
  })

  it('clears the loan interest settings when the asset is no longer financed', () => {
    const prev = {
      ...toStoredTangibleAsset(base, undefined),
      interest_type: 'simple' as const,
      compounding_frequency: 'monthly' as const,
    }
    const stored = toStoredTangibleAsset({ ...base, status: 'fully_owned' }, prev)
    expect(stored.interest_type).toBeUndefined()
    expect(stored.compounding_frequency).toBeUndefined()
  })
})

describe('outstandingBalance', () => {
  it('is the price less the down payment', () => {
    expect(outstandingBalance(400_000, 50_000)).toBe(350_000)
  })

  it('never goes below zero while the price is still being typed', () => {
    expect(outstandingBalance(4, 50_000)).toBe(0)
  })

  it('keeps the down payment through a retyped price (#263)', () => {
    // Select-all and type 400000 with 50 000 down: the balance follows each
    // partial price and lands on the right figure, since the down payment is
    // held rather than re-derived from the clamped balance.
    const paid = 50_000
    const balances = [4, 40, 400, 4_000, 40_000, 400_000].map((price) =>
      outstandingBalance(price, paid),
    )
    expect(balances).toEqual([0, 0, 0, 0, 0, 350_000])
  })

  it('treats missing figures as zero', () => {
    expect(outstandingBalance(undefined, undefined)).toBe(0)
    expect(outstandingBalance(1_000, undefined)).toBe(1_000)
  })

  it('subtracts without floating-point drift', () => {
    expect(outstandingBalance(0.3, 0.1)).toBe(0.2)
  })
})

describe('downPaymentOf', () => {
  it('is the price less the balance still owed', () => {
    expect(downPaymentOf(300_000, 250_000)).toBe(50_000)
  })

  it('is the full price for a paid-down loan', () => {
    expect(downPaymentOf(100, 0)).toBe(100)
  })

  it('is unknown until both figures exist', () => {
    expect(downPaymentOf(undefined, 0)).toBeUndefined()
    expect(downPaymentOf(100, undefined)).toBeUndefined()
  })

  it('never goes below zero', () => {
    expect(downPaymentOf(100, 150)).toBe(0)
  })
})
