import { describe, expect, it } from 'vitest'

import { snapshotFinancialData } from './plan-base'
import { activeYearsOfCashFlow } from './plan-item-years'
import { getYearlyPlanProjection } from './plan-projection'
import type { Portfolio, Profile } from './schemas'

// A plan from 2025 to 2030 with a salary that ends in 2027, a one-time
// expense in 2028 and a transfer that starts in 2029.
const profile: Profile = {
  name: 'Test',
  email: 'test@example.com',
  cash_amount: 100_000,
  investments: [{ id: 'inv1', name: 'ETF', balance: 0, apy: 0 }],
  incomes: [
    {
      id: 'salary',
      name: 'Salary',
      amount: 1000,
      schedule: 'recurring',
      frequency: 'yearly',
      start: 'immediately',
      end: 'at_specific_date',
      end_year: 2027,
      end_month: 12,
      change_over_time: 'none',
    },
  ],
  expenses: [
    {
      id: 'car',
      name: 'New car',
      amount: 5000,
      schedule: 'one_time',
      transaction_year: 2028,
      transaction_month: 6,
    },
  ],
  transfers: [
    {
      id: 'invest',
      name: 'Invest',
      from_asset_id: 'cash',
      to_asset_id: 'inv1',
      amount: 100,
      schedule: 'recurring',
      frequency: 'yearly',
      start: 'at_specific_date',
      start_year: 2029,
      start_month: 1,
      end: 'never',
      change_over_time: 'none',
    },
  ],
}
const data = snapshotFinancialData(profile)
const plan = {
  id: 'plan-1',
  name: 'Test plan',
  start_date: '2025-01-01',
  end_date: '2030-01-01',
  inflation_rate: 0,
  ...data,
  base: data,
} as Portfolio
const projection = getYearlyPlanProjection(plan, profile)

describe('activeYearsOfCashFlow', () => {
  it('gives the years a recurring income runs in', () => {
    expect([...activeYearsOfCashFlow(projection, 'salary')]).toEqual([2025, 2026, 2027])
  })

  it('gives the single year of a one-time expense', () => {
    expect([...activeYearsOfCashFlow(projection, 'car')]).toEqual([2028])
  })

  it('gives the years a transfer runs in', () => {
    expect([...activeYearsOfCashFlow(projection, 'invest')]).toEqual([2029, 2030])
  })

  it('gives no years for an id that is not a cash flow', () => {
    expect([...activeYearsOfCashFlow(projection, 'inv1')]).toEqual([])
  })
})
