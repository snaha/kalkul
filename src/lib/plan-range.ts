import type { CashFlowEnd, CashFlowStart, Portfolio } from '$lib/schemas'

/**
 * The years a plan covers, plus the birth year that turns an age into one.
 * Plan dialogs use it to keep every planned date and age where the projection
 * can act on it.
 */
export interface PlanRange {
  startYear: number
  endYear: number
  birthYear: number | undefined
  /** 1–12; an age is reached in this month (docs/product/projections.md). */
  birthMonth: number | undefined
}

export function planRangeOf(
  plan: Pick<Portfolio, 'start_date' | 'end_date'>,
  birthDate: Date | undefined,
): PlanRange {
  return {
    startYear: Number(plan.start_date.slice(0, 4)),
    endYear: Number(plan.end_date.slice(0, 4)),
    birthYear: birthDate?.getFullYear(),
    birthMonth: birthDate === undefined ? undefined : birthDate.getMonth() + 1,
  }
}

/** The plan's years, as year dropdown options. */
export function planYearOptions(range: PlanRange): string[] {
  const years: string[] = []
  for (let year = range.startYear; year <= range.endYear; year++) years.push(String(year))
  return years
}

/** The nearest plan year, to seed a new one-time date when today is outside the plan. */
export function clampYearToPlan(range: PlanRange, year: number): number {
  return Math.min(Math.max(year, range.startYear), range.endYear)
}

/** The year a timing resolves to; none while it has no date or is incomplete. */
function plannedYear(
  range: PlanRange,
  timing: CashFlowStart | CashFlowEnd,
  year: number | undefined,
  age: number | undefined,
): number | undefined {
  if (timing === 'at_specific_date') return year
  if (timing === 'when_age_is' && range.birthYear !== undefined && age !== undefined)
    return range.birthYear + age
  return undefined
}

/**
 * Whether a start or end timing can still take effect in the plan. A start
 * after the plan's last year or an end before its first never fires, so those
 * are rejected. A start before the plan is clamped to its first year and an
 * end after it runs to its last — the projection handles both as intended, so
 * they pass. Only a timing without a date ('immediately', 'never') follows the
 * plan's bounds when they move; a specific date stays put, so a value at the
 * edge of the plan is not nudged onto it. A missing value is reported as fine
 * so completeness stays `timingComplete`'s concern. Year precision: the
 * boundary years are accepted whole, except that an end at an age reached in
 * the plan's first year needs a month before the birthday to run in.
 */
export function timingWithinPlan(
  range: PlanRange,
  mode: 'start' | 'end',
  timing: CashFlowStart | CashFlowEnd,
  year: number | undefined,
  age: number | undefined,
): boolean {
  const resolved = plannedYear(range, timing, year, age)
  if (resolved === undefined) return true
  if (mode === 'start') return resolved <= range.endYear
  if (resolved !== range.startYear) return resolved > range.startYear
  return timing !== 'when_age_is' || (range.birthMonth ?? 1) > 1
}

/** Whether a one-time date (a transaction, a pay-off) falls inside the plan; outside it never fires. */
export function yearWithinPlan(range: PlanRange, year: number | undefined): boolean {
  return year === undefined || (year >= range.startYear && year <= range.endYear)
}
