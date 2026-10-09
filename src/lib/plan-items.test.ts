import { describe, expect, it } from 'vitest'

import type { Portfolio, Profile, ProfileInvestment, Transfer } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

import { PLAN_LISTS, planItems, removePlanItem, upsertPlanItem } from './plan-items'

function inv(id: string, name = id): ProfileInvestment {
  return { id, name, balance: 100, apy: 5 }
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { name: 'Test', email: '', ...overrides }
}

/** A PortfolioStore whose update merges in place; nothing persists. */
function makePlan(overrides: Partial<Portfolio> = {}): PortfolioStore {
  const state: Portfolio = {
    id: 'plan-1',
    name: 'Plan',
    start_date: '2025-01-01',
    end_date: '2030-01-01',
    inflation_rate: 0,
    ...overrides,
  }
  return Object.assign(state, {
    update: (updates: Partial<Omit<Portfolio, 'id'>>) => Object.assign(state, updates),
    delete: () => {},
    toJSON: () => state,
  }) as unknown as PortfolioStore
}

const transfer: Transfer = {
  id: 't1',
  name: 'Move',
  from_asset_id: 'cash',
  to_asset_id: 'i1',
  amount: 100,
  schedule: 'one_time',
  transaction_year: 2027,
  transaction_month: 1,
}

describe('planItems', () => {
  it("shows financial data with the plan's override in its place, then the plan's own items", () => {
    const profile = makeProfile({ investments: [inv('i1'), inv('i2')] })
    const plan = makePlan({ investments: [inv('i2', 'i2 edited'), inv('own')] })
    expect(planItems(profile, plan, 'investments').map((i) => i.name)).toEqual([
      'i1',
      'i2 edited',
      'own',
    ])
  })

  it('shows financial data alone while the plan is still resolving', () => {
    const profile = makeProfile({ investments: [inv('i1')] })
    expect(planItems(profile, undefined, 'investments')).toEqual([inv('i1')])
  })
})

describe('upsertPlanItem', () => {
  it('adds a new item to the plan and never to financial data', () => {
    const profile = makeProfile()
    const plan = makePlan()
    upsertPlanItem(PLAN_LISTS.investment, inv('i1'), plan, profile)
    expect(plan.investments).toEqual([inv('i1')])
    expect(profile.investments).toBeUndefined()
  })

  it('adds a new id to the include list when the plan has one, and leaves an undefined one alone', () => {
    const profile = makeProfile({ investments: [inv('i1')] })
    const explicit = makePlan({ included_investment_ids: ['i1'] })
    upsertPlanItem(PLAN_LISTS.investment, inv('i2'), explicit, profile)
    expect(explicit.included_investment_ids).toEqual(['i1', 'i2'])

    const implicit = makePlan()
    upsertPlanItem(PLAN_LISTS.investment, inv('i2'), implicit, profile)
    expect(implicit.included_investment_ids).toBeUndefined()
  })

  it('edits a financial-data item as an override under the same id and leaves the original alone (#324)', () => {
    const profile = makeProfile({ investments: [inv('i1'), inv('i2')] })
    const plan = makePlan({ included_investment_ids: ['i1', 'i2'] })
    upsertPlanItem(PLAN_LISTS.investment, inv('i1', 'renamed'), plan, profile)
    expect(profile.investments).toEqual([inv('i1'), inv('i2')])
    expect(plan.investments).toEqual([inv('i1', 'renamed')])
    // Same id, so the include list and any transfer pointing at it still apply.
    expect(plan.included_investment_ids).toEqual(['i1', 'i2'])
    expect(planItems(profile, plan, 'investments').map((i) => i.name)).toEqual(['renamed', 'i2'])
  })

  it('replaces a plan item in place rather than appending a second copy', () => {
    const plan = makePlan({ transfers: [transfer, { ...transfer, id: 't2' }] })
    upsertPlanItem(PLAN_LISTS.transfer, { ...transfer, amount: 200 }, plan, makeProfile())
    expect(plan.transfers?.map((t) => [t.id, t.amount])).toEqual([
      ['t1', 200],
      ['t2', 100],
    ])
  })
})

describe('removePlanItem', () => {
  it('excludes a financial-data item from the plan and leaves financial data alone (#357)', () => {
    const profile = makeProfile({ investments: [inv('i1'), inv('i2')] })
    const plan = makePlan({ investments: [inv('own')] })
    removePlanItem(PLAN_LISTS.investment, 'i1', plan, profile)
    expect(profile.investments).toEqual([inv('i1'), inv('i2')])
    expect(plan.investments).toEqual([inv('own')])
    expect(plan.included_investment_ids).toEqual(['i2', 'own'])
  })

  it("drops the plan's own item, from its include list too", () => {
    const plan = makePlan({ investments: [inv('own')], included_investment_ids: ['own'] })
    removePlanItem(PLAN_LISTS.investment, 'own', plan, makeProfile())
    expect(plan.investments).toEqual([])
    expect(plan.included_investment_ids).toEqual([])
  })

  it('drops an override and excludes the original, so the item is gone from the plan', () => {
    const profile = makeProfile({ investments: [inv('i1')] })
    const plan = makePlan({ investments: [inv('i1', 'renamed')] })
    removePlanItem(PLAN_LISTS.investment, 'i1', plan, profile)
    expect(plan.investments).toEqual([])
    expect(plan.included_investment_ids).toEqual([])
    expect(profile.investments).toEqual([inv('i1')])
  })
})
