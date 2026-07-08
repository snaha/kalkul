import { SvelteSet } from 'svelte/reactivity'

import { describe, expect, it } from 'vitest'

import { portfolioNestedSchema } from '$lib/schemas'
import type { Transfer } from '$lib/schemas'
import type { PortfolioNested } from '$lib/types'

import { withPortfolioStore } from './portfolio.svelte'

// Minimal AppParent stub. The store only touches `hiddenIds` (via a getter) and
// `persist()` during construction/serialisation, so no-op implementations suffice.
const app = {
  persist: () => {},
  deletePortfolio: () => {},
  duplicatePortfolio: () => undefined,
  hiddenIds: new SvelteSet<string>(),
}

// A fully-populated transfer so the `transfers` array survives the
// `length > 0` guard in `toJSON()`.
const transfer: Transfer = {
  id: 'transfer-1',
  name: 'Rebalance',
  from_asset_id: 'inv-1',
  to_asset_id: 'goal-1',
  amount: 500,
  transfer_all: false,
  inflation_adjusted: true,
  schedule: 'recurring',
  transaction_year: 2030,
  transaction_month: 6,
  frequency: 'yearly',
  start: 'immediately',
  start_year: 2030,
  start_month: 1,
  start_age: 40,
  end: 'when_age_is',
  end_year: 2050,
  end_month: 12,
  end_age: 65,
  change_over_time: 'match_inflation',
  change_percentage: 2,
}

// A fixture with EVERY key of `portfolioNestedSchema` populated with a defined
// value. The guards below keep it honest: if a new schema key is added it must
// be represented here, and if the store then drops it the round-trip fails.
const fixture: PortfolioNested = {
  id: 'portfolio-1',
  name: 'Retirement',
  notes: 'Long-term retirement plan',
  start_date: '2024-01-01',
  end_date: '2054-01-01',
  inflation_rate: 0.03,
  include_cash: true,
  included_investment_ids: ['inv-1'],
  included_tangible_asset_ids: ['asset-1'],
  included_liability_ids: ['liab-1'],
  included_income_ids: ['income-1'],
  included_expense_ids: ['expense-1'],
  transfers: [transfer],
  included_transfer_ids: ['transfer-1'],
  investments: [{ id: 'inv-1', name: 'ETF', transactions: [] }],
  goals: [{ id: 'goal-1', name: 'House', transactions: [] }],
}

describe('withPortfolioStore', () => {
  const schemaKeys = Object.keys(portfolioNestedSchema.shape)

  it('fixture covers every key declared by portfolioNestedSchema', () => {
    // If a new schema field is added, this fails until the fixture is updated,
    // forcing the round-trip test below to actually exercise the new field.
    expect([...Object.keys(fixture)].sort()).toEqual([...schemaKeys].sort())
  })

  it('fixture populates every key with a defined value', () => {
    // `toEqual` ignores `undefined` properties, so an undefined fixture value
    // would let a dropped key slip through the round-trip assertion.
    for (const key of schemaKeys) {
      expect(
        fixture[key as keyof PortfolioNested],
        `fixture.${key} must be defined so a dropped key is detectable`,
      ).toBeDefined()
    }
  })

  it('round-trips every key through toJSON()', () => {
    const store = withPortfolioStore(fixture, app)
    expect(store.toJSON()).toEqual(fixture)
  })

  it('persists notes through the store (regression for #112)', () => {
    const store = withPortfolioStore(fixture, app)
    expect(store.notes).toBe('Long-term retirement plan')
    expect(store.toJSON().notes).toBe('Long-term retirement plan')
  })

  it('omits notes from toJSON() when unset', () => {
    const { notes: _notes, ...withoutNotes } = fixture
    const store = withPortfolioStore(withoutNotes, app)
    expect(store.notes).toBeUndefined()
    expect('notes' in store.toJSON()).toBe(false)
  })
})
