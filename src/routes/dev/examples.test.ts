import bence from '$examples/bence-toth-hu-25yo.kalkul.json'
import claire from '$examples/claire-moreau-fr-41yo.kalkul.json'
import jan from '$examples/jan-dvorak-cz-56yo.kalkul.json'
import peter from '$examples/peter-kovac-sk-29yo.kalkul.json'
import tereza from '$examples/tereza-svobodova-cz-20yo.kalkul.json'
import { describe, expect, test } from 'vitest'

import { buildCurrentProjectionPlan } from '$lib/current-projection'
import { type YearlyProjection, getYearlyPlanProjection, yearOf } from '$lib/plan-projection'
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

const SAMPLES = { tereza, bence, peter, claire, jan }

/**
 * Examples whose current projection runs out by design, with the first year it
 * does. Tereza: a flat café wage against rent rising 5% a year, with 500 CZK a
 * month still going into her ETF.
 */
const CURRENT_PROJECTION_RUNS_DRY: Record<string, number> = { tereza: 2031 }

function parse(json: unknown) {
  return storedDataSchema.pick({ profile: true, portfolios: true }).parse(json)
}

const unfundedYears = (years: YearlyProjection[]): number[] =>
  years
    .filter(
      (year) =>
        year.insufficientFundTransferIds.length > 0 ||
        year.insufficientFundAssetIds.length > 0 ||
        year.insufficientFundExpenseIds.length > 0 ||
        year.insufficientFundLiabilityIds.length > 0,
    )
    .map((year) => year.year)

describe.each(Object.entries(SAMPLES))('example profile: %s', (name, json) => {
  test('the current projection pays for every year, unless it is meant to run out', () => {
    const { profile } = parse(json)
    const years = getYearlyPlanProjection(buildCurrentProjectionPlan(profile, TODAY), profile)

    expect(years.length).toBeGreaterThan(0)
    const runsDry = CURRENT_PROJECTION_RUNS_DRY[name]
    if (runsDry !== undefined) {
      expect(unfundedYears(years)[0]).toBe(runsDry)
      return
    }
    expect(unfundedYears(years)).toEqual([])
    expect(years.filter((year) => year.cash <= 0).map((year) => year.year)).toEqual([])
  })

  // The landing page's comparison draws Claire's first plan, so a saved plan
  // that stops at a loan it cannot pay would show there as a broken card.
  test('saved plans pay for every year', () => {
    const { profile, portfolios } = parse(json)

    for (const plan of portfolios) {
      const years = getYearlyPlanProjection(plan, profile)
      expect(years.length).toBeGreaterThan(0)
      expect({ [plan.id]: unfundedYears(years) }).toEqual({ [plan.id]: [] })
      expect({ [plan.id]: years.at(-1)?.year }).toEqual({ [plan.id]: yearOf(plan.end_date) })
    }
  })
})
