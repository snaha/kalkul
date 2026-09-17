import { describe, expect, test } from 'vitest'

import { CURRENT_PROJECTION_ID, buildCurrentProjectionPlan } from './current-projection'
import type { Profile } from './schemas'

const TODAY = new Date(2026, 5, 20) // 2026-06-20

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  birth_date: '1990-03-14',
  cash_amount: 15_000,
}

describe('buildCurrentProjectionPlan', () => {
  test('starts on the first of the current month', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY).start_date).toBe('2026-06-01')
  })

  test('runs 20 years ahead, whatever the age', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY).end_date).toBe('2046-06-01')
    const { birth_date: _birthDate, ...withoutBirthDate } = PROFILE
    expect(buildCurrentProjectionPlan(withoutBirthDate, TODAY).end_date).toBe('2046-06-01')
  })

  test('takes an explicit end date instead', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY, '2075-03-01').end_date).toBe('2075-03-01')
  })

  test('includes every asset, liability and cash flow', () => {
    const plan = buildCurrentProjectionPlan(PROFILE, TODAY)
    // An omitted `included_*_ids` list means "all of them" to the projection.
    expect(plan.included_investment_ids).toBeUndefined()
    expect(plan.included_tangible_asset_ids).toBeUndefined()
    expect(plan.included_liability_ids).toBeUndefined()
    expect(plan.included_income_ids).toBeUndefined()
    expect(plan.included_expense_ids).toBeUndefined()
    expect(plan.include_cash).not.toBe(false)
  })

  test('carries a stable id so it never collides with a saved plan', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY).id).toBe(CURRENT_PROJECTION_ID)
  })

  test('uses the default inflation rate', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY).inflation_rate).toBe(0.02)
  })
})
