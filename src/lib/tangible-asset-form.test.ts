import { describe, expect, it } from 'vitest'

import { type TangibleAssetUI, toStoredTangibleAsset } from '$lib/tangible-asset-form'

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
