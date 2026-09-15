import type { YearlyProjection } from '$lib/plan-projection'

/**
 * The three figures the landing page compares two projections by, derived from
 * the projection output the engine already produced. Nothing here is money
 * maths — these are readings off a finished projection — so plain numbers are
 * fine and Decimal would only add noise.
 */

/** The age the headline "net worth at" figure is read off at. */
export const HEADLINE_AGE = 65

/** Percent of the target that counts as financially independent. */
const INDEPENDENT_PERCENT = 100

export interface ProjectionStats {
  /**
   * Net worth in the year the person turns {@link HEADLINE_AGE}. Undefined
   * when the projection stops before that year.
   */
  netWorthAtHeadlineAge?: number
  /**
   * Age in the first year `fiPercent` reaches 100. Undefined when the
   * projection never gets there.
   */
  independentAtAge?: number
  /** The lowest cash balance in the projection, and the year it falls in. */
  lowestCash?: { year: number; value: number }
}

/** Differences between two `ProjectionStats`, each undefined unless both sides have the figure. */
export interface ProjectionStatsDelta {
  netWorthAtHeadlineAge?: number
  /** Positive means independence comes later, negative earlier. */
  independentAtAge?: number
  lowestCash?: number
}

export function getProjectionStats(years: YearlyProjection[], birthYear: number): ProjectionStats {
  const headlineYear = birthYear + HEADLINE_AGE
  const atHeadlineAge = years.find((year) => year.year === headlineYear)

  const independent = years.find(
    (year) => year.fiPercent !== undefined && year.fiPercent >= INDEPENDENT_PERCENT,
  )

  const lowest = years.reduce<YearlyProjection | undefined>(
    // Strictly lower, so the earliest of equally low years wins — the year the
    // dip is first reached is the one worth naming.
    (best, year) => (best === undefined || year.cash < best.cash ? year : best),
    undefined,
  )

  return {
    netWorthAtHeadlineAge: atHeadlineAge?.netWorth,
    independentAtAge: independent ? independent.year - birthYear : undefined,
    lowestCash: lowest ? { year: lowest.year, value: lowest.cash } : undefined,
  }
}

/**
 * First year the projection could not pay for — any year the engine flagged,
 * whatever the reason. The chart marks it with its own warning triangle, and
 * the comparison names it as the year the plan runs tight.
 */
export function getFirstUnfundedYear(years: YearlyProjection[]): number | undefined {
  return years.find(
    (year) =>
      year.insufficientFundTransferIds.length > 0 ||
      year.insufficientFundAssetIds.length > 0 ||
      year.insufficientFundExpenseIds.length > 0,
  )?.year
}

/** `plan` measured against `base`: what changes if the plan is followed. */
export function getStatsDelta(plan: ProjectionStats, base: ProjectionStats): ProjectionStatsDelta {
  const diff = (a: number | undefined, b: number | undefined): number | undefined =>
    a === undefined || b === undefined ? undefined : a - b

  return {
    netWorthAtHeadlineAge: diff(plan.netWorthAtHeadlineAge, base.netWorthAtHeadlineAge),
    independentAtAge: diff(plan.independentAtAge, base.independentAtAge),
    lowestCash: diff(plan.lowestCash?.value, base.lowestCash?.value),
  }
}
