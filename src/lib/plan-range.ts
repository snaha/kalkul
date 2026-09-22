import type { Portfolio } from '$lib/schemas'

/**
 * The years a plan covers, plus the birth year that turns an age into one.
 * Plan dialogs use it to keep every planned date and age inside the plan:
 * outside it the projection would silently ignore or clamp the timing.
 */
export interface PlanRange {
  startYear: number
  endYear: number
  birthYear: number | undefined
}

export function planRangeOf(
  plan: Pick<Portfolio, 'start_date' | 'end_date'>,
  birthDate: Date | undefined,
): PlanRange {
  return {
    startYear: Number(plan.start_date.slice(0, 4)),
    endYear: Number(plan.end_date.slice(0, 4)),
    birthYear: birthDate?.getFullYear(),
  }
}

/** Year dropdown options limited to the plan's years. */
export function planYearOptions(range: PlanRange): string[] {
  const count = Math.max(range.endYear - range.startYear + 1, 0)
  return Array.from({ length: count }, (_, i) => String(range.startYear + i))
}

/**
 * Whether a timing choice falls inside the plan. Only a specific year or an
 * age can fall outside; a missing value is reported as inside so that
 * completeness stays `timingComplete`'s concern. Year precision only: the
 * months stored by the timing selector and by the one-time pickers do not
 * share a convention yet, so the boundary years are accepted whole.
 */
export function timingWithinPlan(
  range: PlanRange,
  mode: string,
  year: number | undefined,
  age: number | undefined,
): boolean {
  let resolved: number | undefined
  if (mode === 'at_specific_date') resolved = year
  else if (mode === 'when_age_is' && range.birthYear !== undefined && age !== undefined)
    resolved = range.birthYear + age
  if (resolved === undefined) return true
  return resolved >= range.startYear && resolved <= range.endYear
}
