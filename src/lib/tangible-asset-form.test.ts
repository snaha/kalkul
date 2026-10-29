import { describe, expect, it } from 'vitest'

import {
  type TangibleAssetUI,
  impliedDownPayment,
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
  derivedFrom: 'term',
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
  it('is the price less the down payment, never below 0', () => {
    expect(outstandingBalance(300_000, 50_000)).toBe(250_000)
    expect(outstandingBalance(300_000, undefined)).toBe(300_000)
    expect(outstandingBalance(4, 50_000)).toBe(0)
    expect(outstandingBalance(undefined, 50_000)).toBe(0)
  })

  it('keeps a held down payment through a retyped price', () => {
    const paid = 50_000
    expect(
      [4, 40, 400, 4_000, 40_000, 400_000].map((price) => outstandingBalance(price, paid)),
    ).toEqual([0, 0, 0, 0, 0, 350_000])
  })

  it('is exact in cents', () => {
    expect(outstandingBalance(0.3, 0.1)).toBe(0.2)
  })
})

describe('impliedDownPayment', () => {
  it('is nothing paid until a balance exists, so typing a price leaves it at 0', () => {
    expect(impliedDownPayment(undefined, undefined)).toBeUndefined()
    expect(impliedDownPayment(300_000, undefined)).toBe(0)
  })

  it('is the price less the stored balance, never below 0', () => {
    expect(impliedDownPayment(300_000, 250_000)).toBe(50_000)
    expect(impliedDownPayment(300_000, 0)).toBe(300_000)
    // Underwater: more owed than the asset is worth.
    expect(impliedDownPayment(9_000, 11_500)).toBe(0)
  })
})
