import { describe, expect, it } from 'vitest'

import type { TaxRule } from '$lib/schemas'
import { invalidTaxRuleFields } from '$lib/tax-rule-form'

const rule: TaxRule = { id: 'r1', rate: 15, holding_period: 'more_than', holding_years: 3 }

describe('invalidTaxRuleFields', () => {
  it('accepts an in-range rule', () => {
    expect(invalidTaxRuleFields(rule)).toEqual([])
  })

  it('accepts an incomplete rule', () => {
    expect(invalidTaxRuleFields({ id: 'r1', holding_period: 'more_than' })).toEqual([])
  })

  it('flags a rate above 100', () => {
    expect(invalidTaxRuleFields({ ...rule, rate: 150 })).toEqual(['rate'])
  })

  it('flags a negative holding period', () => {
    expect(invalidTaxRuleFields({ ...rule, holding_years: -1 })).toEqual(['holding_years'])
  })

  it('flags both fields at once', () => {
    expect(invalidTaxRuleFields({ ...rule, rate: -5, holding_years: -1 })).toEqual([
      'rate',
      'holding_years',
    ])
  })
})
