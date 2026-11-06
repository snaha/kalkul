import { describe, expect, test } from 'vitest'

import { getCurrentProfile } from './current-values'
import { getMetricChanges } from './metric-changes'
import type { Profile, Snapshot } from './schemas'

const TODAY = new Date(2026, 3, 1)
const TODAY_DATE = '2026-04-01'

const JANUARY: Snapshot = {
  date: '2026-01-01',
  cash_amount: 10_000,
  investments: [{ id: 'inv1', balance: 100_000 }],
  tangible_assets: [],
  liabilities: [],
  incomes: [{ id: 'inc1', amount: 4_000, frequency: 'monthly' }],
  expenses: [{ id: 'exp1', amount: 3_000, frequency: 'monthly' }],
}

const APRIL: Snapshot = {
  date: '2026-04-01',
  cash_amount: 12_000,
  investments: [{ id: 'inv1', balance: 105_000 }],
  tangible_assets: [],
  liabilities: [],
  incomes: [{ id: 'inc1', amount: 4_000, frequency: 'monthly' }],
  expenses: [{ id: 'exp1', amount: 3_400, frequency: 'monthly' }],
}

/** Stored as of April; 0 % APY so carrying it forward to today moves nothing. */
const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 12_000,
  investments: [{ id: 'inv1', name: 'ETF', balance: 105_000, apy: 0 }],
  incomes: [
    { id: 'inc1', name: 'Salary', amount: 4_000, schedule: 'recurring', frequency: 'monthly' },
  ],
  expenses: [
    { id: 'exp1', name: 'Rent', amount: 3_400, schedule: 'recurring', frequency: 'monthly' },
  ],
  snapshots: [JANUARY, APRIL],
}

const changesOf = (profile: Profile) =>
  getMetricChanges(profile, getCurrentProfile(profile, TODAY), TODAY_DATE)

describe('getMetricChanges', () => {
  test('measures today against the snapshot before the latest one', () => {
    expect(changesOf(PROFILE)).toEqual({
      since: '2026-01-01',
      // 117,000 − 110,000
      netWorth: 7_000,
      // 25 % → 15 %, in percentage points
      savingsRate: -10,
      // 110,000 / 3,000 = 36.7 months → 3.06 years; 117,000 / 3,400 = 34.4 months → 2.87 years
      runwayYears: -0.2,
      // FI number 3,000 × 12 / 4 % = 900,000, cash + investments 110,000 of it = 12.2 %;
      // 3,400 × 12 / 4 % = 1,020,000, 117,000 of it = 11.5 %
      fiPercent: -1,
    })
  })

  test('nothing to compare with until there are two snapshots', () => {
    expect(changesOf({ ...PROFILE, snapshots: [APRIL] })).toBeUndefined()
    expect(changesOf({ ...PROFILE, snapshots: [] })).toBeUndefined()
  })

  test('a snapshot dated after today is not the latest yet', () => {
    const future = { ...APRIL, date: '2026-05-01' }
    expect(changesOf({ ...PROFILE, snapshots: [JANUARY, APRIL, future] })?.since).toBe('2026-01-01')
  })

  test('a sub-unit move reads as unchanged, not as "-0"', () => {
    const nearlyTheSame = { ...APRIL, expenses: JANUARY.expenses }
    const changes = changesOf({
      ...PROFILE,
      expenses: PROFILE.expenses?.map((e) => ({ ...e, amount: 3_000 })),
      snapshots: [JANUARY, nearlyTheSame],
    })
    // 3.06 → 3.25 years is +0.2; the FI % moves from 12.2 % to 13 %.
    expect(changes?.runwayYears).toBe(0.2)
    expect(changes?.fiPercent).toBe(1)
    expect(Object.is(changes?.savingsRate, 0)).toBe(true)
  })

  test('a figure missing on either side has no change', () => {
    const noExpensesThen = { ...JANUARY, expenses: [] }
    const changes = changesOf({ ...PROFILE, snapshots: [noExpensesThen, APRIL] })
    // Nothing spent then is a 100 % savings rate; nothing to pay is no runway and no FI number.
    expect(changes?.savingsRate).toBe(-85)
    expect(changes?.runwayYears).toBeUndefined()
    expect(changes?.fiPercent).toBeUndefined()
  })
})
