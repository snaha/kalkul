import { formatDate } from '$lib/@snaha/kalkul-maths'

import type { PlanEndType, PlanStartType, Portfolio, Profile } from './schemas'
import { parseDateOnly } from './utils'

/** Inflation a new plan starts with when the user isn't asked for one. */
const DEFAULT_INFLATION_RATE = 0.02
/** Age a new plan runs until when the user isn't asked for an end. */
const DEFAULT_END_AGE = 85

type PlanDates = Pick<Portfolio, 'start_date' | 'end_date' | 'inflation_rate'>
type PlanInclusions = Required<Omit<Portfolio, 'id' | 'name' | 'notes' | keyof PlanDates>>

/**
 * Timeline defaults for a plan created from the Add projection dialog, which
 * only asks for a name and a note. Start is the first of the current month;
 * the plan runs until the user turns {@link DEFAULT_END_AGE}, or — with no
 * birth date on the profile — that many years from now.
 *
 * Someone already past that age would otherwise get an end before the start,
 * and the dialog has no date fields to fix it with, so the end is clamped to
 * one month after the start. The projection is then trivially short rather
 * than silently inverted, which is visible in the plan-span hint.
 */
export function getDefaultPlanDates(profile: Profile, today = new Date()): PlanDates {
  const birthDate = profile.birth_date ? parseDateOnly(profile.birth_date) : undefined
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = birthDate
    ? new Date(birthDate.getFullYear() + DEFAULT_END_AGE, birthDate.getMonth(), 1)
    : new Date(today.getFullYear() + DEFAULT_END_AGE, 0, 1)
  const earliestEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1)

  return {
    start_date: formatDate(start),
    end_date: formatDate(end > earliestEnd ? end : earliestEnd),
    inflation_rate: DEFAULT_INFLATION_RATE,
  }
}

/**
 * A default name for a new projection: the lowest index that is not already
 * taken. Counting from the list length collided after a deletion — one plan
 * left called "Alternative projection 2" produced that same name again.
 */
export function getDefaultPlanName(
  existingNames: string[],
  format: (index: number) => string,
): string {
  const used = new Set(existingNames)
  let index = 1
  while (used.has(format(index))) index++
  return format(index)
}

/**
 * A plan stores inflation as a rate; the settings form edits it as a
 * percentage. The naive `rate * 100` leaks float artifacts (0.07 becomes
 * 7.000000000000001), which a Done the user never edited would then store
 * back as 0.07000000000000001. Dividing by 100 is exact enough to need no
 * counterpart.
 */
export function toInflationPercent(rate: number): number {
  return Number((rate * 100).toPrecision(12))
}

/**
 * Turn the "Start from your current finances" switch into the plan's
 * `include_*` references: everything the profile holds, or nothing at all.
 */
export function buildPlanInclusions(
  profile: Profile,
  startFromCurrentFinances: boolean,
): PlanInclusions {
  const ids = (items: { id: string }[] | undefined) =>
    startFromCurrentFinances ? (items ?? []).map((i) => i.id) : []

  return {
    include_cash: startFromCurrentFinances,
    included_investment_ids: ids(profile.investments),
    included_tangible_asset_ids: ids(profile.tangible_assets),
    included_liability_ids: ids(profile.liabilities),
    included_income_ids: ids(profile.incomes),
    included_expense_ids: ids(profile.expenses),
    included_transfer_ids: ids(profile.transfers),
  }
}

/** How long a plan runs, for the "Your plan spans X years and Y months" hint. */
export function getPlanSpan(startDate: string, endDate: string): { years: number; months: number } {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  const total = Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()),
  )
  return { years: Math.floor(total / 12), months: total % 12 }
}

/** Start/end as the settings form edits them, before they collapse to dates. */
export interface PlanTimelineForm {
  startType: PlanStartType
  startYear: string
  startMonth: string
  endType: PlanEndType
  endAge: number | undefined
  endYear: string
  endMonth: string
}

/**
 * Seed the settings form from a plan's stored dates. A plan only stores dates,
 * so the "Now" and "When your age is" choices are inferred: a start on the
 * first of the current month reads back as "Now", and an end landing on the
 * profile's birth month reads back as that age.
 *
 * The age inference is a guess — a specific end date that happens to fall in
 * the birth month is indistinguishable from an age. It is cosmetic: both
 * choices collapse to the same stored date, so the round trip is lossless
 * either way. Telling them apart would mean storing the choice on the plan,
 * which is not worth a schema field for a label.
 */
export function seedPlanTimeline(
  plan: Pick<Portfolio, 'start_date' | 'end_date'>,
  profile: Pick<Profile, 'birth_date'>,
  today = new Date(),
): PlanTimelineForm {
  const start = parseDateOnly(plan.start_date)
  const end = parseDateOnly(plan.end_date)
  const birthDate = profile.birth_date ? parseDateOnly(profile.birth_date) : undefined
  const isAge = birthDate !== undefined && end.getMonth() === birthDate.getMonth()

  return {
    startType:
      start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()
        ? 'now'
        : 'at_specific_date',
    startYear: String(start.getFullYear()),
    startMonth: String(start.getMonth()),
    endType: isAge ? 'when_age_is' : 'at_specific_date',
    endAge: isAge ? end.getFullYear() - birthDate.getFullYear() : undefined,
    endYear: String(end.getFullYear()),
    endMonth: String(end.getMonth()),
  }
}

/** Collapse the settings form's start/end choices back into stored dates. */
export function planTimelineToDates(
  form: PlanTimelineForm,
  profile: Pick<Profile, 'birth_date'>,
  today = new Date(),
): Pick<Portfolio, 'start_date' | 'end_date'> {
  const start =
    form.startType === 'now'
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : new Date(Number(form.startYear), Number(form.startMonth), 1)

  const birthDate = profile.birth_date ? parseDateOnly(profile.birth_date) : undefined
  const age = form.endAge ?? DEFAULT_END_AGE
  const end =
    form.endType === 'when_age_is'
      ? birthDate
        ? new Date(birthDate.getFullYear() + age, birthDate.getMonth(), 1)
        : new Date(start.getFullYear() + age, 0, 1)
      : new Date(Number(form.endYear), Number(form.endMonth), 1)

  return { start_date: formatDate(start), end_date: formatDate(end) }
}
