import { describe, expect, it } from 'vitest'

import type { Portfolio, Profile, ProfileInvestment } from '$lib/schemas'

import { emptyPlanData, isPlanOutdated, snapshotFinancialData } from './plan-base'

const etf: ProfileInvestment = { id: 'etf', name: 'ETF', balance: 100, apy: 5 }
const profile: Profile = { name: 'Test', email: '', cash_amount: 500, investments: [etf] }

function planFrom(p: Profile): Portfolio {
  return {
    id: 'plan-1',
    name: 'Plan',
    start_date: '2025-01-01',
    end_date: '2030-01-01',
    inflation_rate: 0,
    ...snapshotFinancialData(p),
    base: snapshotFinancialData(p),
  }
}

describe('snapshotFinancialData', () => {
  it('copies cash and every list, with empty lists and 0 cash for what the profile lacks', () => {
    expect(snapshotFinancialData(profile)).toEqual({
      cash_amount: 500,
      investments: [etf],
      tangible_assets: [],
      liabilities: [],
      incomes: [],
      expenses: [],
      transfers: [],
    })
    expect(emptyPlanData().cash_amount).toBe(0)
  })

  it('returns copies, so the plan never shares an item with financial data', () => {
    const snapshot = snapshotFinancialData(profile)
    expect(snapshot.investments[0]).not.toBe(etf)
    expect(snapshot.investments[0]).toEqual(etf)
  })
})

describe('isPlanOutdated', () => {
  it('is false right after creation', () => {
    expect(isPlanOutdated(planFrom(profile), profile)).toBe(false)
  })

  it('is false when the plan itself was edited', () => {
    const plan = planFrom(profile)
    plan.cash_amount = 1
    plan.investments = []
    expect(isPlanOutdated(plan, profile)).toBe(false)
  })

  it('is true once financial data changed', () => {
    const plan = planFrom(profile)
    expect(isPlanOutdated(plan, { ...profile, cash_amount: 501 })).toBe(true)
    expect(isPlanOutdated(plan, { ...profile, investments: [{ ...etf, balance: 101 }] })).toBe(true)
    expect(isPlanOutdated(plan, { ...profile, investments: [] })).toBe(true)
  })

  it('ignores key order, which a form round-trip can change', () => {
    const plan = planFrom(profile)
    const reordered: ProfileInvestment = { apy: 5, balance: 100, name: 'ETF', id: 'etf' }
    expect(isPlanOutdated(plan, { ...profile, investments: [reordered] })).toBe(false)
  })
})
