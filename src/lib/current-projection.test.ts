import { describe, expect, test } from 'vitest'

import type { Profile } from '$lib/schemas'

import { CURRENT_PROJECTION_ID, buildCurrentProjectionPlan } from './current-projection'

const TODAY = new Date(2026, 5, 20) // 2026-06-20
const profile: Profile = {
  name: 'Test',
  email: '',
  cash_amount: 500,
  investments: [{ id: 'etf', name: 'ETF', balance: 100, apy: 5 }],
}

describe('buildCurrentProjectionPlan', () => {
  test('starts on the first of the current month', () => {
    expect(buildCurrentProjectionPlan(profile, TODAY).start_date).toBe('2026-06-01')
  })

  test('runs 20 years ahead', () => {
    expect(buildCurrentProjectionPlan(profile, TODAY).end_date).toBe('2046-06-01')
  })

  test('takes an explicit end date instead', () => {
    expect(buildCurrentProjectionPlan(profile, TODAY, '2075-03-01').end_date).toBe('2075-03-01')
  })

  test('is a copy of the profile, cash and every list, like a saved plan at creation', () => {
    const plan = buildCurrentProjectionPlan(profile, TODAY)
    expect(plan.cash_amount).toBe(500)
    expect(plan.investments).toEqual(profile.investments)
    expect(plan.tangible_assets).toEqual([])
    expect(plan.base.investments).toEqual(profile.investments)
  })

  test('carries a stable id so it never collides with a saved plan', () => {
    expect(buildCurrentProjectionPlan(profile, TODAY).id).toBe(CURRENT_PROJECTION_ID)
  })

  test('uses the default inflation rate', () => {
    expect(buildCurrentProjectionPlan(profile, TODAY).inflation_rate).toBe(0.02)
  })
})
