import type { CashFlowEnd, CashFlowStart, Portfolio } from '$lib/schemas'

/**
 * The years a plan covers, plus the birth year that turns an age into one.
 * Plan dialogs use it to keep every planned date and age where the projection
 * can act on it.
 */
export interface PlanRange {
  startYear: number
  /** 1–12; the first year runs from this month (docs/product/projections.md). */
  startMonth: number
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
    startMonth: Number(plan.start_date.slice(5, 7)),
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

/**
 * The date a new one-time item starts at: today, or the nearest month of the
 * plan when today is outside it.
 */
export function seedDateInPlan(range: PlanRange, today: Date): { year: number; month: number } {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  if (year < range.startYear || (year === range.startYear && month < range.startMonth)) {
    return { year: range.startYear, month: range.startMonth }
  }
  return { year: Math.min(year, range.endYear), month }
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
 * so completeness stays `timingComplete`'s concern. In the plan's first year an
 * end must leave a month to run in from the plan's start month: a specific
 * date at or after it, or an age whose birthday comes after it.
 */
export function timingWithinPlan(
  range: PlanRange,
  mode: 'start' | 'end',
  timing: CashFlowStart | CashFlowEnd,
  year: number | undefined,
  age: number | undefined,
  /** The month of a specific-date end, checked against the plan's start month. */
  month?: number,
): boolean {
  const resolved = plannedYear(range, timing, year, age)
  if (resolved === undefined) return true
  if (mode === 'start') return resolved <= range.endYear
  if (resolved !== range.startYear) return resolved > range.startYear
  if (timing === 'when_age_is') return (range.birthMonth ?? 1) > range.startMonth
  return month === undefined || month >= range.startMonth
}

/**
 * Whether a one-time date falls inside the plan: within its years, and not in
 * a month of its first year before it starts. Outside it never happens.
 */
export function dateWithinPlan(
  range: PlanRange,
  year: number | undefined,
  month: number | undefined,
): boolean {
  if (year === undefined) return true
  if (year < range.startYear || year > range.endYear) return false
  return year !== range.startYear || month === undefined || month >= range.startMonth
}
