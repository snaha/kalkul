import bence from '$examples/bence-toth-hu-25yo.kalkul.json'
import claire from '$examples/claire-moreau-fr-40yo.kalkul.json'
import martin from '$examples/martin-kovac-sk-30yo.kalkul.json'
import pavel from '$examples/pavel-dvorak-cz-50yo.kalkul.json'
import tereza from '$examples/tereza-svobodova-cz-20yo.kalkul.json'
import { describe, expect, test } from 'vitest'

import { buildCurrentProjectionPlan } from '$lib/current-projection'
import { type YearlyProjection, getYearlyPlanProjection } from '$lib/plan-projection'
import { storedDataSchema } from '$lib/schemas'

/**
 * The shipped sample profiles have to project cleanly: the landing page draws
 * Claire's projection as the product's own screenshot, and every sample is
 * offered as "Try the demo" or a dev preset. A sample whose current finances
 * run out of money is a broken advertisement, not a realistic persona.
 *
 * A fixed date so the run is deterministic; the same reference date as the dev
 * preset tests.
 */
const TODAY = new Date(2026, 7, 12) // 2026-08-12

const SAMPLES = { tereza, bence, martin, claire, pavel }

/**
 * Plans that are *meant* to run out, with the first year they do. The landing
 * page's comparison shows one deliberately tight plan so the warning marker and
 * the caption naming that year have something real to point at; pinning the
 * year here stops the copy and the data drifting apart.
 */
const DELIBERATELY_TIGHT: Record<string, { firstUnfundedYear: number; maxUnfundedYears: number }> =
  {
    'plan-2': { firstUnfundedYear: 2030, maxUnfundedYears: 1 },
  }

function parse(json: unknown) {
  return storedDataSchema.pick({ profile: true, portfolios: true }).parse(json)
}

const unfundedYears = (years: YearlyProjection[]): number[] =>
  years
    .filter(
      (year) =>
        year.insufficientFundTransferIds.length > 0 ||
        year.insufficientFundAssetIds.length > 0 ||
        year.insufficientFundExpenseIds.length > 0,
    )
    .map((year) => year.year)

describe.each(Object.entries(SAMPLES))('example profile: %s', (_name, json) => {
  test('the current projection pays for every year', () => {
    const { profile } = parse(json)
    const years = getYearlyPlanProjection(buildCurrentProjectionPlan(TODAY), profile)

    expect(years.length).toBeGreaterThan(0)
    expect(unfundedYears(years)).toEqual([])
    expect(years.filter((year) => year.cash <= 0).map((year) => year.year)).toEqual([])
  })

  test('saved plans pay for every year, bar the deliberately tight one', () => {
    const { profile, portfolios } = parse(json)

    for (const plan of portfolios) {
      const years = getYearlyPlanProjection(plan, profile)
      expect(years.length).toBeGreaterThan(0)

      const tight = DELIBERATELY_TIGHT[plan.id]
      const unfunded = unfundedYears(years)
      if (!tight) {
        expect({ [plan.id]: unfunded }).toEqual({ [plan.id]: [] })
        continue
      }
      // Tight on purpose, but only just: one named year the landing points at,
      // not a plan that never recovers.
      expect(unfunded[0]).toBe(tight.firstUnfundedYear)
      expect(unfunded.length).toBeLessThanOrEqual(tight.maxUnfundedYears)
    }
  })
})
