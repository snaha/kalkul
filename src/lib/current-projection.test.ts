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

  test('runs to the year the user turns 85', () => {
    expect(buildCurrentProjectionPlan(PROFILE, TODAY).end_date).toBe('2075-03-01')
  })

  test('falls back to 85 years out when no birth date is known', () => {
    const { birth_date: _birthDate, ...withoutBirthDate } = PROFILE
    expect(buildCurrentProjectionPlan(withoutBirthDate, TODAY).end_date).toBe('2111-01-01')
  })

  test('still ends after it starts for someone already past 85', () => {
    const profile: Profile = { ...PROFILE, birth_date: '1930-03-14' }
    const plan = buildCurrentProjectionPlan(profile, TODAY)
    expect(plan.end_date > plan.start_date).toBe(true)
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
