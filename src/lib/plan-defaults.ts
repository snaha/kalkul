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
 */
export function getDefaultPlanDates(profile: Profile, today = new Date()): PlanDates {
  const birthDate = profile.birth_date ? parseDateOnly(profile.birth_date) : undefined
  const end = birthDate
    ? new Date(birthDate.getFullYear() + DEFAULT_END_AGE, birthDate.getMonth(), 1)
    : new Date(today.getFullYear() + DEFAULT_END_AGE, 0, 1)

  return {
    start_date: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    end_date: formatDate(end),
    inflation_rate: DEFAULT_INFLATION_RATE,
  }
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
