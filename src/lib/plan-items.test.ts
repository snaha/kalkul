import { describe, expect, it } from 'vitest'

import { emptyPlanData } from '$lib/plan-base'
import type { Portfolio, ProfileInvestment, ProfileLiability } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

import { removePlanItem, saveEditedPlanItem, upsertPlanItem } from './plan-items'

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

describe('saveEditedPlanItem', () => {
  it('appends a new item as edited', () => {
    const plan = makePlan({ investments: [inv('i1')] })
    saveEditedPlanItem('investments', inv('i2'), undefined, plan)
    expect(plan.investments).toEqual([inv('i1'), inv('i2')])
  })

  it('applies only the fields edited in the dialog, keeping a change made meanwhile elsewhere', () => {
    const opened = inv('i1')
    // While the dialog was open, another tab changed the return.
    const plan = makePlan({ investments: [{ ...opened, apy: 7 }, inv('i2')] })
    saveEditedPlanItem('investments', { ...opened, name: 'renamed' }, opened, plan)
    expect(plan.investments).toEqual([{ ...opened, name: 'renamed', apy: 7 }, inv('i2')])
  })

  it('writes a field the dialog normalised together with the edited one that belongs to it', () => {
    // Legacy data stores the term in months; the dialog shows and saves years.
    const opened: ProfileLiability = {
      id: 'l1',
      name: 'Loan',
      outstanding_balance: 1000,
      installment_frequency: 'monthly',
      annual_rate: 5,
      installment_amount: 100,
      remaining_term: 24,
      remaining_term_unit: 'months',
    }
    const plan = makePlan({ liabilities: [opened] })
    const edited: ProfileLiability = { ...opened, remaining_term: 3, remaining_term_unit: 'years' }
    saveEditedPlanItem('liabilities', edited, opened, plan)
    expect(plan.liabilities).toEqual([edited])
  })

  it('saves the item as edited when the plan no longer has it', () => {
    const opened = inv('i1')
    const plan = makePlan({ investments: [inv('i2')] })
    saveEditedPlanItem('investments', { ...opened, name: 'renamed' }, opened, plan)
    expect(plan.investments).toEqual([inv('i2'), { ...opened, name: 'renamed' }])
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
