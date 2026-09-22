import { describe, expect, it } from 'vitest'

import { planRangeOf, planYearOptions, timingWithinPlan } from './plan-range'

const range = planRangeOf(
  { start_date: '2026-09-01', end_date: '2030-03-01' },
  new Date(1980, 4, 27),
)

describe('planRangeOf', () => {
  it('reads the plan years and the birth year', () => {
    expect(range).toEqual({ startYear: 2026, endYear: 2030, birthYear: 1980 })
  })
})

describe('planYearOptions', () => {
  it('lists the plan years inclusive', () => {
    expect(planYearOptions(range)).toEqual(['2026', '2027', '2028', '2029', '2030'])
  })
})

describe('timingWithinPlan', () => {
  it('accepts a specific year inside the plan and rejects past or future ones', () => {
    expect(timingWithinPlan(range, 'at_specific_date', 2026, undefined)).toBe(true)
    expect(timingWithinPlan(range, 'at_specific_date', 2030, undefined)).toBe(true)
    expect(timingWithinPlan(range, 'at_specific_date', 2025, undefined)).toBe(false)
    expect(timingWithinPlan(range, 'at_specific_date', 2031, undefined)).toBe(false)
  })

  it('resolves an age through the birth year', () => {
    expect(timingWithinPlan(range, 'when_age_is', undefined, 46)).toBe(true)
    expect(timingWithinPlan(range, 'when_age_is', undefined, 50)).toBe(true)
    expect(timingWithinPlan(range, 'when_age_is', undefined, 45)).toBe(false)
    expect(timingWithinPlan(range, 'when_age_is', undefined, 51)).toBe(false)
  })

  it('leaves incomplete or non-dated timing to other checks', () => {
    expect(timingWithinPlan(range, 'at_specific_date', undefined, undefined)).toBe(true)
    expect(timingWithinPlan(range, 'when_age_is', undefined, undefined)).toBe(true)
    expect(timingWithinPlan({ ...range, birthYear: undefined }, 'when_age_is', undefined, 99)).toBe(
      true,
    )
    expect(timingWithinPlan(range, 'immediately', 1999, 99)).toBe(true)
    expect(timingWithinPlan(range, 'never', 1999, 99)).toBe(true)
  })
})
