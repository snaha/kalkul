import { describe, expect, it } from 'vitest'

import { emptyPlanData } from '$lib/plan-base'
import type { Portfolio, ProfileInvestment } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

import { removePlanItem, upsertPlanItem } from './plan-items'

function inv(id: string, name = id): ProfileInvestment {
  return { id, name, balance: 100, apy: 5 }
}

/** A PortfolioStore whose update merges in place; nothing persists. */
function makePlan(overrides: Partial<Portfolio> = {}): PortfolioStore {
  const state: Portfolio = {
    id: 'plan-1',
    name: 'Plan',
    start_date: '2025-01-01',
    end_date: '2030-01-01',
    inflation_rate: 0,
    ...emptyPlanData(),
    base: emptyPlanData(),
    ...overrides,
  }
  return Object.assign(state, {
    update: (updates: Partial<Omit<Portfolio, 'id'>>) => Object.assign(state, updates),
    delete: () => {},
    toJSON: () => state,
  }) as unknown as PortfolioStore
}

describe('upsertPlanItem', () => {
  it('appends an item the plan does not have', () => {
    const plan = makePlan({ investments: [inv('i1')] })
    upsertPlanItem('investments', inv('i2'), plan)
    expect(plan.investments).toEqual([inv('i1'), inv('i2')])
  })

  it('replaces an item in place by id rather than appending a second copy', () => {
    const plan = makePlan({ investments: [inv('i1'), inv('i2')] })
    upsertPlanItem('investments', inv('i1', 'renamed'), plan)
    expect(plan.investments).toEqual([inv('i1', 'renamed'), inv('i2')])
  })

  it('never touches the base', () => {
    const plan = makePlan({
      investments: [inv('i1')],
      base: { ...emptyPlanData(), investments: [inv('i1')] },
    })
    upsertPlanItem('investments', inv('i1', 'renamed'), plan)
    expect(plan.base.investments).toEqual([inv('i1')])
  })
})

describe('removePlanItem', () => {
  it('drops the item from the plan and leaves the base alone', () => {
    const plan = makePlan({
      investments: [inv('i1'), inv('i2')],
      base: { ...emptyPlanData(), investments: [inv('i1')] },
    })
    removePlanItem('investments', 'i1', plan)
    expect(plan.investments).toEqual([inv('i2')])
    expect(plan.base.investments).toEqual([inv('i1')])
  })
})
