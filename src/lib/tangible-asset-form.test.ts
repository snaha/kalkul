import { describe, expect, it } from 'vitest'

import {
  type TangibleAssetFinancing,
  type TangibleAssetUI,
  downPaymentExceedsPrice,
  downPaymentOf,
  outstandingBalance,
  outstandingBalanceFor,
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

  it('never goes below zero', () => {
    expect(outstandingBalance(4, 50_000)).toBe(0)
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

describe('outstandingBalanceFor', () => {
  const financed: TangibleAssetFinancing = {
    status: 'financed',
    value: 300_000,
    down_payment: downPaymentOf(300_000, 250_000),
  }

  it('stores the price less the down payment on a financed asset', () => {
    expect(outstandingBalanceFor(financed)).toBe(250_000)
  })

  it('owes the whole price until a down payment is entered', () => {
    expect(outstandingBalanceFor({ ...financed, down_payment: undefined })).toBe(300_000)
  })

  it('stores no balance on an asset paid upfront', () => {
    expect(outstandingBalanceFor({ ...financed, status: 'fully_owned' })).toBeUndefined()
  })

  it('follows the price while it is retyped, since the down payment is its own field', () => {
    const f = { ...financed }
    for (const value of [4, 40, 400, 4_000, 40_000, 400_000]) f.value = value
    expect(f.down_payment).toBe(50_000)
    expect(outstandingBalanceFor(f)).toBe(350_000)
  })

  it('survives a detour through Upfront, since the status does not touch the down payment', () => {
    const f = { ...financed }
    f.status = 'fully_owned'
    f.value = 400_000
    expect(outstandingBalanceFor(f)).toBeUndefined()
    f.status = 'financed'
    expect(outstandingBalanceFor(f)).toBe(350_000)
  })
})

describe('downPaymentExceedsPrice', () => {
  it('flags a down payment above the price', () => {
    expect(
      downPaymentExceedsPrice({ status: 'financed', value: 300_000, down_payment: 500_000 }),
    ).toBe(true)
    expect(
      downPaymentExceedsPrice({ status: 'financed', value: 300_000, down_payment: 300_000 }),
    ).toBe(false)
    expect(
      downPaymentExceedsPrice({ status: 'financed', value: 300_000, down_payment: undefined }),
    ).toBe(false)
  })
})
