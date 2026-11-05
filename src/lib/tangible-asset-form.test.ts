import { describe, expect, it } from 'vitest'

import {
  type TangibleAssetUI,
  financedAmount,
  seededDownPayment,
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

describe('financedAmount', () => {
  it('finances the whole price when nothing is paid down', () => {
    expect(financedAmount(400_000, undefined)).toBe(400_000)
  })

  it('finances the price less the down payment', () => {
    expect(financedAmount(400_000, 50_000)).toBe(350_000)
    expect(financedAmount(1000.3, 0.1)).toBe(1000.2)
  })

  it('never goes below zero, so a price retyped digit by digit cannot flip it', () => {
    expect(financedAmount(4, 50_000)).toBe(0)
    expect(financedAmount(undefined, 50_000)).toBe(0)
  })
})

describe('seededDownPayment', () => {
  const financed = { status: 'financed' as const, value: 420_000, outstanding_balance: 235_000 }

  it('keeps the down payment the dialog saved', () => {
    expect(seededDownPayment({ ...financed, down_payment: 10 })).toBe(10)
    expect(seededDownPayment({ ...financed, down_payment: 0 })).toBe(0)
  })

  it('reads the price less the balance owed when none was saved', () => {
    expect(seededDownPayment(financed)).toBe(185_000)
  })

  it('opens a paid-off loan at the full price', () => {
    expect(seededDownPayment({ ...financed, outstanding_balance: 0 })).toBe(420_000)
  })

  it('reads owing more than the price as nothing paid', () => {
    expect(seededDownPayment({ ...financed, value: 90_000, outstanding_balance: 98_000 })).toBe(0)
  })

  it('has none for an asset that is not financed or has no loan yet', () => {
    expect(seededDownPayment({ ...financed, status: 'fully_owned' })).toBeUndefined()
    expect(seededDownPayment({ ...financed, outstanding_balance: undefined })).toBeUndefined()
  })
})
