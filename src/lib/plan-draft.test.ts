import { describe, expect, it } from 'vitest'

import {
  type PlanDraftDetails,
  buildPlanCreationFields,
  getPlanEndDate,
  getPlanStartDate,
} from './plan-draft'

function makeDetails(overrides: Partial<PlanDraftDetails> = {}): PlanDraftDetails {
  return {
    name: 'My plan',
    notes: 'some notes',
    startType: 'at_specific_date',
    startYear: '2030',
    startMonth: '5', // June (0-indexed)
    endType: 'at_specific_date',
    endAge: undefined,
    endYear: '2050',
    endMonth: '0', // January
    currency: 'CZK',
    inflation: 2,
    ...overrides,
  }
}

describe('getPlanStartDate', () => {
  it('uses the first of the selected year/month for a specific start date', () => {
    expect(getPlanStartDate(makeDetails())).toBe('2030-06-01')
  })

  it('uses the first of the current month when starting now', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    expect(getPlanStartDate(makeDetails({ startType: 'now' }))).toBe(expected)
  })
})

describe('getPlanEndDate', () => {
  it('derives the end date from birth date + age when ending by age', () => {
    const details = makeDetails({ endType: 'when_age_is', endAge: 85 })
    const birthDate = new Date(1990, 2, 15) // March 1990
    // 1990 + 85 = 2075, month preserved (March, 0-indexed 2), first of month
    expect(getPlanEndDate(details, birthDate)).toBe('2075-03-01')
  })

  it('falls back to start year + age when birth date is unknown', () => {
    const details = makeDetails({
      startType: 'at_specific_date',
      startYear: '2030',
      endType: 'when_age_is',
      endAge: 85,
    })
    expect(getPlanEndDate(details, undefined)).toBe('2115-01-01')
  })

  it('uses the selected year/month for a specific end date', () => {
    expect(getPlanEndDate(makeDetails(), undefined)).toBe('2050-01-01')
  })
})

describe('buildPlanCreationFields', () => {
  it('trims the name, drops empty notes, and converts inflation to a rate', () => {
    const details = makeDetails({ name: '  Spaced  ', notes: '   ', inflation: 3 })
    const fields = buildPlanCreationFields(details, undefined)
    expect(fields.name).toBe('Spaced')
    expect(fields.notes).toBeUndefined()
    expect(fields.inflation_rate).toBe(0.03)
    expect(fields.currency).toBe('CZK')
    expect(fields.start_date).toBe('2030-06-01')
    expect(fields.end_date).toBe('2050-01-01')
  })

  it('defaults inflation to 2% when undefined', () => {
    const fields = buildPlanCreationFields(makeDetails({ inflation: undefined }), undefined)
    expect(fields.inflation_rate).toBe(0.02)
  })
})
