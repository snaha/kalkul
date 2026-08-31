import { describe, expect, it } from 'vitest'

import {
  buildPlanInclusions,
  getDefaultPlanDates,
  getDefaultPlanName,
  getPlanSpan,
  planTimelineToDates,
  seedPlanTimeline,
  toInflationPercent,
} from './plan-defaults'
import type { Profile } from './schemas'

const emptyProfile: Profile = { name: 'Test', email: 'test@example.com' }

describe('getDefaultPlanDates', () => {
  it('starts on the first of the current month', () => {
    const dates = getDefaultPlanDates(emptyProfile, new Date(2026, 7, 26))
    expect(dates.start_date).toBe('2026-08-01')
  })

  it('ends when the profile birth date reaches the default age', () => {
    const dates = getDefaultPlanDates(
      { ...emptyProfile, birth_date: '1985-03-15' },
      new Date(2026, 7, 26),
    )
    expect(dates.end_date).toBe('2070-03-01')
  })

  it('falls back to the current year plus the default age when no birth date is set', () => {
    const dates = getDefaultPlanDates(emptyProfile, new Date(2026, 7, 26))
    expect(dates.end_date).toBe('2111-01-01')
  })

  it('defaults inflation to 2%', () => {
    expect(getDefaultPlanDates(emptyProfile, new Date(2026, 7, 26)).inflation_rate).toBe(0.02)
  })

  it('still ends after it starts for someone already past the default age', () => {
    // Born 1938 -> age 85 was reached in 2023, before the plan even starts.
    // The dialog has no date fields, so an inverted plan could only be fixed
    // in settings — clamp it to a one-month span instead.
    const dates = getDefaultPlanDates(
      { ...emptyProfile, birth_date: '1938-03-15' },
      new Date(2026, 7, 26),
    )
    expect(dates.start_date).toBe('2026-08-01')
    expect(dates.end_date).toBe('2026-09-01')
  })

  it('clamps an end that lands in the start month itself', () => {
    const dates = getDefaultPlanDates(
      { ...emptyProfile, birth_date: '1941-08-15' },
      new Date(2026, 7, 26),
    )
    expect(dates.end_date).toBe('2026-09-01')
  })

  it('rolls the clamped end into the next year from December', () => {
    const dates = getDefaultPlanDates(
      { ...emptyProfile, birth_date: '1938-03-15' },
      new Date(2026, 11, 26),
    )
    expect(dates.start_date).toBe('2026-12-01')
    expect(dates.end_date).toBe('2027-01-01')
  })
})

describe('toInflationPercent', () => {
  it('does not leak float artifacts into an untouched round trip', () => {
    // 0.07 * 100 is 7.000000000000001, which saved back as /100 stored
    // 0.07000000000000001 after a Done the user never edited.
    expect(toInflationPercent(0.07)).toBe(7)
    expect(toInflationPercent(0.07) / 100).toBe(0.07)
    expect(toInflationPercent(0.29) / 100).toBe(0.29)
  })

  it('keeps a fractional percentage intact', () => {
    expect(toInflationPercent(0.025)).toBe(2.5)
    expect(toInflationPercent(0.0325)).toBe(3.25)
  })

  it('handles zero', () => {
    expect(toInflationPercent(0)).toBe(0)
  })
})

describe('getDefaultPlanName', () => {
  const format = (index: number) => `Alternative projection ${index}`

  it('numbers the first projection 1', () => {
    expect(getDefaultPlanName([], format)).toBe('Alternative projection 1')
  })

  it('numbers past the existing projections', () => {
    expect(getDefaultPlanName(['Alternative projection 1'], format)).toBe(
      'Alternative projection 2',
    )
  })

  it('reuses a number freed by a deletion instead of colliding', () => {
    // Counting from the list length produced "Alternative projection 2" again
    // once the first of two projections was deleted.
    expect(getDefaultPlanName(['Alternative projection 2'], format)).toBe(
      'Alternative projection 1',
    )
  })

  it('ignores names the user chose themselves', () => {
    expect(getDefaultPlanName(['Retirement', 'Alternative projection 1'], format)).toBe(
      'Alternative projection 2',
    )
  })
})

describe('buildPlanInclusions', () => {
  const profile: Profile = {
    ...emptyProfile,
    investments: [{ id: 'inv-1', name: 'ETF', balance: 10_000, apy: 5 }],
    tangible_assets: [{ id: 'ta-1', name: 'Flat', value: 200_000, status: 'fully_owned' }],
    liabilities: [
      {
        id: 'li-1',
        name: 'Mortgage',
        outstanding_balance: 120_000,
        installment_frequency: 'monthly',
        annual_rate: 3,
        installment_amount: 600,
        remaining_term: 20,
      },
    ],
    incomes: [
      {
        id: 'in-1',
        name: 'Salary',
        amount: 1000,
        frequency: 'monthly',
        withhold_taxes: false,
        start: 'now',
        end: 'never',
        change_over_time: 'none',
      },
    ],
    expenses: [
      {
        id: 'ex-1',
        name: 'Rent',
        amount: 500,
        frequency: 'monthly',
        start: 'now',
        end: 'never',
        change_over_time: 'none',
      },
    ],
    transfers: [
      {
        id: 'tr-1',
        name: 'Savings',
        from_asset_id: 'cash',
        to_asset_id: 'inv-1',
        amount: 100,
        schedule: 'recurring',
      },
    ],
  }

  it('includes cash and every profile item when starting from current finances', () => {
    expect(buildPlanInclusions(profile, true)).toEqual({
      include_cash: true,
      included_investment_ids: ['inv-1'],
      included_tangible_asset_ids: ['ta-1'],
      included_liability_ids: ['li-1'],
      included_income_ids: ['in-1'],
      included_expense_ids: ['ex-1'],
      included_transfer_ids: ['tr-1'],
    })
  })

  it('includes nothing when not starting from current finances', () => {
    expect(buildPlanInclusions(profile, false)).toEqual({
      include_cash: false,
      included_investment_ids: [],
      included_tangible_asset_ids: [],
      included_liability_ids: [],
      included_income_ids: [],
      included_expense_ids: [],
      included_transfer_ids: [],
    })
  })

  it('handles a profile with no lists at all', () => {
    expect(buildPlanInclusions(emptyProfile, true)).toEqual({
      include_cash: true,
      included_investment_ids: [],
      included_tangible_asset_ids: [],
      included_liability_ids: [],
      included_income_ids: [],
      included_expense_ids: [],
      included_transfer_ids: [],
    })
  })
})

describe('getPlanSpan', () => {
  it('splits a partial-year span into years and months', () => {
    expect(getPlanSpan('2026-04-01', '2068-06-01')).toEqual({ years: 42, months: 2 })
  })

  it('reports whole years with zero months', () => {
    expect(getPlanSpan('2026-04-01', '2068-04-01')).toEqual({ years: 42, months: 0 })
  })

  it('reports a sub-year span as zero years', () => {
    expect(getPlanSpan('2026-04-01', '2026-09-01')).toEqual({ years: 0, months: 5 })
  })

  it('clamps an end date before the start date to zero', () => {
    expect(getPlanSpan('2026-04-01', '2025-04-01')).toEqual({ years: 0, months: 0 })
  })
})

describe('seedPlanTimeline', () => {
  const today = new Date(2026, 7, 26)

  it('reads a start on the first of the current month as "now"', () => {
    const form = seedPlanTimeline({ start_date: '2026-08-01', end_date: '2070-03-01' }, {}, today)
    expect(form.startType).toBe('now')
    expect(form.startYear).toBe('2026')
    expect(form.startMonth).toBe('7')
  })

  it('reads a January start in the current month as "now"', () => {
    const form = seedPlanTimeline(
      { start_date: '2026-01-01', end_date: '2070-03-01' },
      emptyProfile,
      new Date(2026, 0, 14),
    )
    expect(form.startType).toBe('now')
    expect(form.startMonth).toBe('0')
  })

  it('reads the first of the current month in an earlier year as a specific date', () => {
    const form = seedPlanTimeline(
      { start_date: '2019-08-01', end_date: '2070-03-01' },
      emptyProfile,
      new Date(2026, 7, 26),
    )
    expect(form.startType).toBe('at_specific_date')
    expect(form.startYear).toBe('2019')
    expect(form.startMonth).toBe('7')
  })

  it('reads any other start as a specific date', () => {
    const form = seedPlanTimeline({ start_date: '2027-04-01', end_date: '2070-03-01' }, {}, today)
    expect(form.startType).toBe('at_specific_date')
    expect(form.startYear).toBe('2027')
    expect(form.startMonth).toBe('3')
  })

  it('reads an end landing on the birth month back as an age', () => {
    const form = seedPlanTimeline(
      { start_date: '2026-08-01', end_date: '2070-03-01' },
      { birth_date: '1985-03-15' },
      today,
    )
    expect(form.endType).toBe('when_age_is')
    expect(form.endAge).toBe(85)
  })

  it('reads an end off the birth month as a specific date', () => {
    const form = seedPlanTimeline(
      { start_date: '2026-08-01', end_date: '2070-06-01' },
      { birth_date: '1985-03-15' },
      today,
    )
    expect(form.endType).toBe('at_specific_date')
    expect(form.endYear).toBe('2070')
    expect(form.endMonth).toBe('5')
  })

  it('reads an end as a specific date when the profile has no birth date', () => {
    const form = seedPlanTimeline({ start_date: '2026-08-01', end_date: '2070-03-01' }, {}, today)
    expect(form.endType).toBe('at_specific_date')
  })
})

describe('planTimelineToDates', () => {
  const today = new Date(2026, 7, 26)
  const base = {
    startType: 'now',
    startYear: '2030',
    startMonth: '3',
    endType: 'when_age_is',
    endAge: 85,
    endYear: '2070',
    endMonth: '5',
  } as const

  it('turns "now" into the first of the current month', () => {
    expect(planTimelineToDates(base, { birth_date: '1985-03-15' }, today).start_date).toBe(
      '2026-08-01',
    )
  })

  it('turns a specific start into that year and month', () => {
    expect(
      planTimelineToDates({ ...base, startType: 'at_specific_date' }, {}, today).start_date,
    ).toBe('2030-04-01')
  })

  it('turns an age into the birth month of that year', () => {
    expect(planTimelineToDates(base, { birth_date: '1985-03-15' }, today).end_date).toBe(
      '2070-03-01',
    )
  })

  it('falls back to the start year plus the age when there is no birth date', () => {
    expect(planTimelineToDates(base, {}, today).end_date).toBe('2111-01-01')
  })

  it('turns a specific end into that year and month', () => {
    expect(planTimelineToDates({ ...base, endType: 'at_specific_date' }, {}, today).end_date).toBe(
      '2070-06-01',
    )
  })
})
