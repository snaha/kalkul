import { init } from 'svelte-i18n'

import { describe, expect, it } from 'vitest'

import { portfolioSchema } from '$lib/schemas'
import type { Income, Portfolio } from '$lib/schemas'

import { withPortfolioStore } from './portfolio.svelte'

// `update` validates with portfolioSchema, whose refinements resolve their
// messages through svelte-i18n.
init({ fallbackLocale: 'en', initialLocale: 'en' })

// Minimal AppParent stub. The store only calls persist()/deletePortfolio()
// on user actions, never during construction or serialisation, so no-op
// implementations suffice.
const app = {
  persist: () => {},
  deletePortfolio: () => {},
}

// A fixture with EVERY key of `portfolioSchema` populated with a defined
// value. The guards below keep it honest: if a new schema key is added it must
// be represented here, and if the store then drops it the round-trip fails.
const fixture: Portfolio = {
  id: 'portfolio-1',
  name: 'Retirement',
  notes: 'Long-term retirement plan',
  start_date: '2024-01-01',
  end_date: '2054-01-01',
  inflation_rate: 0.03,
  cash_amount: 500,
  investments: [{ id: 'inv-2', name: 'ETF', balance: 1, apy: 1 }],
  tangible_assets: [{ id: 'asset-2', name: 'Flat', value: 1, status: 'fully_owned' }],
  liabilities: [
    {
      id: 'liab-2',
      name: 'Loan',
      outstanding_balance: 1,
      installment_frequency: 'monthly',
      annual_rate: 1,
      installment_amount: 1,
      remaining_term: 1,
    },
  ],
  incomes: [flow('income-2')],
  expenses: [flow('expense-2')],
  transfers: [
    {
      id: 'transfer-2',
      name: 'Move',
      from_asset_id: 'cash',
      to_asset_id: 'inv-2',
      amount: 1,
      schedule: 'recurring',
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
  base: {
    cash_amount: 400,
    investments: [{ id: 'inv-1', name: 'ETF', balance: 1, apy: 1 }],
    tangible_assets: [],
    liabilities: [],
    incomes: [],
    expenses: [],
    transfers: [],
  },
}

function flow(id: string): Income {
  return {
    id,
    name: id,
    amount: 1,
    schedule: 'recurring',
    frequency: 'monthly',
    start: 'immediately',
    end: 'never',
    change_over_time: 'none',
  }
}

describe('withPortfolioStore', () => {
  const schemaKeys = Object.keys(portfolioSchema.shape)

  it('fixture covers every key declared by portfolioSchema', () => {
    // If a new schema field is added, this fails until the fixture is updated,
    // forcing the round-trip test below to actually exercise the new field.
    expect([...Object.keys(fixture)].sort()).toEqual([...schemaKeys].sort())
  })

  it('fixture populates every key with a defined value', () => {
    // `toEqual` ignores `undefined` properties, so an undefined fixture value
    // would let a dropped key slip through the round-trip assertion.
    for (const key of schemaKeys) {
      expect(
        fixture[key as keyof Portfolio],
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

  it('rejects an update the schema does not accept and leaves the plan as it was', () => {
    let persisted = 0
    const store = withPortfolioStore(fixture, { ...app, persist: () => persisted++ })
    const invalid = [
      { id: 'inv-3', name: 'No year', balance: 1, apy: 1, start: 'at_specific_date' },
    ]
    expect(() => store.update({ investments: invalid as Portfolio['investments'] })).toThrow()
    expect(store.investments).toEqual(fixture.investments)
    expect(persisted).toBe(0)
    store.update({ investments: [] })
    expect(store.investments).toEqual([])
    expect(persisted).toBe(1)
  })

  it('omits notes from toJSON() when unset', () => {
    const { notes: _notes, ...withoutNotes } = fixture
    const store = withPortfolioStore(withoutNotes, app)
    expect(store.notes).toBeUndefined()
    expect('notes' in store.toJSON()).toBe(false)
  })
})
