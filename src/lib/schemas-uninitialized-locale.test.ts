import { describe, expect, test } from 'vitest'

import { profileInvestmentSchema, profileTangibleAssetSchema } from './schemas'

// This file deliberately does NOT initialize svelte-i18n, which is the state
// the app is in when `loadData()` parses stored data at module load. A
// refinement that resolves a translation for data that is actually valid
// throws there, `loadData` swallows it, and the whole profile falls back to
// the empty default — the user opens the app to the landing page with their
// data still sitting in localStorage.
describe('parsing planned timing before a locale is set', () => {
  test('accepts an investment bought in a future year', () => {
    expect(() =>
      profileInvestmentSchema.parse({
        id: 'i1',
        name: 'Future ETF',
        balance: 100_000,
        apy: 7,
        start: 'at_specific_date',
        start_year: 2035,
        start_month: 1,
      }),
    ).not.toThrow()
  })

  test('accepts an investment sold in a specific year', () => {
    expect(() =>
      profileInvestmentSchema.parse({
        id: 'i1',
        name: 'Fund',
        balance: 100_000,
        apy: 7,
        exit: 'at_specific_date',
        exit_year: 2040,
        exit_month: 6,
      }),
    ).not.toThrow()
  })

  test('accepts a property bought in a future year', () => {
    expect(() =>
      profileTangibleAssetSchema.parse({
        id: 'a1',
        name: 'Future flat',
        value: 300_000,
        status: 'fully_owned',
        purchase: 'at_specific_date',
        purchase_year: 2035,
        purchase_month: 1,
      }),
    ).not.toThrow()
  })
})
