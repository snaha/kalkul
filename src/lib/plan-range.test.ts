import { describe, expect, it } from 'vitest'

import {
  clampYearToPlan,
  planRangeOf,
  planYearOptions,
  timingWithinPlan,
  yearWithinPlan,
} from './plan-range'

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

  it('keeps a stored year outside the plan in the list, in order', () => {
    expect(planYearOptions(range, 2045)).toEqual(['2026', '2027', '2028', '2029', '2030', '2045'])
    expect(planYearOptions(range, 2020)).toEqual(['2020', '2026', '2027', '2028', '2029', '2030'])
  })

  it('adds nothing for a year inside the plan or none at all', () => {
    expect(planYearOptions(range, 2028, undefined)).toEqual(planYearOptions(range))
  })
})

describe('clampYearToPlan', () => {
  it('moves a year outside the plan to its nearest edge', () => {
    expect(clampYearToPlan(range, 2020)).toBe(2026)
    expect(clampYearToPlan(range, 2035)).toBe(2030)
    expect(clampYearToPlan(range, 2028)).toBe(2028)
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
    // Runs to the plan's last year.
    expect(timingWithinPlan(range, 'end', 'at_specific_date', 2045, undefined)).toBe(true)
  })

  it('resolves an age through the birth year', () => {
    expect(timingWithinPlan(range, 'start', 'when_age_is', undefined, 51)).toBe(false)
    expect(timingWithinPlan(range, 'start', 'when_age_is', undefined, 50)).toBe(true)
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, 45)).toBe(false)
    expect(timingWithinPlan(range, 'end', 'when_age_is', undefined, 65)).toBe(true)
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

describe('yearWithinPlan', () => {
  it('accepts the plan years and rejects the rest', () => {
    expect(yearWithinPlan(range, 2026)).toBe(true)
    expect(yearWithinPlan(range, 2030)).toBe(true)
    expect(yearWithinPlan(range, 2025)).toBe(false)
    expect(yearWithinPlan(range, 2031)).toBe(false)
  })

  it('leaves a missing year to the completeness check', () => {
    expect(yearWithinPlan(range, undefined)).toBe(true)
  })
})
