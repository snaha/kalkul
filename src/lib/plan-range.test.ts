import { describe, expect, it } from 'vitest'

import {
  dateWithinPlan,
  planRangeOf,
  planYearOptions,
  seedDateInPlan,
  timingWithinPlan,
} from './plan-range'

const range = planRangeOf(
  { start_date: '2026-09-01', end_date: '2030-03-01' },
  new Date(1980, 4, 27),
)

describe('planRangeOf', () => {
  it('reads the plan years, its start month and the birth year', () => {
    expect(range).toEqual({
      startYear: 2026,
      startMonth: 9,
      endYear: 2030,
      birthYear: 1980,
      birthMonth: 5,
    })
  })
})

describe('planYearOptions', () => {
  it('lists the plan years inclusive', () => {
    expect(planYearOptions(range)).toEqual(['2026', '2027', '2028', '2029', '2030'])
  })
})

describe('seedDateInPlan', () => {
  it('keeps today when the plan holds it', () => {
    expect(seedDateInPlan(range, new Date(2026, 10, 15))).toEqual({ year: 2026, month: 11 })
    expect(seedDateInPlan(range, new Date(2028, 0, 15))).toEqual({ year: 2028, month: 1 })
  })

  it('moves a date before the plan to its start month', () => {
    expect(seedDateInPlan(range, new Date(2026, 2, 15))).toEqual({ year: 2026, month: 9 })
    expect(seedDateInPlan(range, new Date(2020, 10, 15))).toEqual({ year: 2026, month: 9 })
  })

  it('moves a date after the plan into its last year', () => {
    expect(seedDateInPlan(range, new Date(2035, 4, 15))).toEqual({ year: 2030, month: 5 })
  })
})

describe('timingWithinPlan', () => {
  it('rejects a start after the plan ends, but not one before it starts', () => {
    expect(timingWithinPlan(range, 'start', 'at_specific_date', 2031, undefined)).toBe(false)
    expect(timingWithinPlan(range, 'start', 'at_specific_date', 2030, undefined)).toBe(true)
    // Clamped to the plan's first year by the projection: already held.
    expect(timingWithinPlan(range, 'start', 'at_specific_date', 2020, undefined)).toBe(true)
  })

  it('rejects an end before the plan starts, but not one after it ends', () => {
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2025, undefined)).toBe(false)
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2026, undefined)).toBe(true)
    // In the first year, the end month must not come before the start month.
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2026, undefined, 8)).toBe(false)
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2026, undefined, 9)).toBe(true)
    // Runs to the plan's last year.
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2045, undefined)).toBe(true)
  })

  it('resolves an age through the birth year', () => {
    expect(timingWithinPlan(range, 'start', 'when_age_is', undefined, 51)).toBe(false)
    expect(timingWithinPlan(range, 'start', 'when_age_is', undefined, 50)).toBe(true)
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, 45)).toBe(false)
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, 65)).toBe(true)
  })

  it('needs a month left in the first year for an end at an age reached then', () => {
    // The plan starts in September 2026. Born May 1980: 46 in May 2026, so the
    // flow would stop in April, before the plan starts.
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, 46)).toBe(false)
    // Born October: September 2026 runs.
    expect(
      timingWithinPlan({ ...range, birthMonth: 10 }, 'end', 'when_age_is', undefined, 46),
    ).toBe(true)
    // Born January: the flow would stop with 2025, before the plan.
    expect(timingWithinPlan({ ...range, birthMonth: 1 }, 'end', 'when_age_is', undefined, 46)).toBe(
      false,
    )
    expect(timingWithinPlan({ ...range, birthMonth: 1 }, 'end', 'when_age_is', undefined, 47)).toBe(
      true,
    )
  })

  it('leaves incomplete or undated timing to other checks', () => {
    expect(timingWithinPlan(range, 'start', 'at_specific_date', undefined, undefined)).toBe(true)
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, undefined)).toBe(true)
    expect(
      timingWithinPlan({ ...range, birthYear: undefined }, 'end', 'when_age_is', undefined, 1),
    ).toBe(true)
    expect(timingWithinPlan(range, 'start', 'immediately', 1999, 99)).toBe(true)
    expect(timingWithinPlan(range, 'end', 'never', 1999, 99)).toBe(true)
  })
})

describe('dateWithinPlan', () => {
  it('accepts the plan months and rejects the rest', () => {
    expect(dateWithinPlan(range, 2026, 9)).toBe(true)
    expect(dateWithinPlan(range, 2030, 12)).toBe(true)
    expect(dateWithinPlan(range, 2025, 12)).toBe(false)
    expect(dateWithinPlan(range, 2031, 1)).toBe(false)
  })

  it('rejects a month of the first year before the plan starts', () => {
    expect(dateWithinPlan(range, 2026, 8)).toBe(false)
  })

  it('leaves a missing year or month to the completeness check', () => {
    expect(dateWithinPlan(range, undefined, 3)).toBe(true)
    expect(dateWithinPlan(range, 2026, undefined)).toBe(true)
  })
})
