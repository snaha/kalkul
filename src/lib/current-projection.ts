import { formatDate } from '$lib/@snaha/kalkul-maths'
import { getDefaultPlanDates } from '$lib/plan-defaults'
import type { Portfolio, Profile } from '$lib/schemas'

/**
 * Id of the synthesized plan. Deliberately not a UUID so it can never be
 * mistaken for — or collide with — a plan the user saved.
 */
export const CURRENT_PROJECTION_ID = 'current-projection'

/**
 * How far the automatic projection looks ahead. Today's income and expenses
 * say little about the decades after that; a saved plan, where they can be
 * changed, is the place to look further.
 */
export const CURRENT_PROJECTION_YEARS = 20

/**
 * The dashboard's always-present "Current projection": where the user's money
 * goes if nothing changes. It is derived on the fly rather than stored, so it
 * follows the profile automatically and never needs migrating.
 *
 * Starts on the first of the current month, like a new plan, and runs
 * {@link CURRENT_PROJECTION_YEARS} ahead unless `endDate` says otherwise.
 *
 * Every asset, liability and cash flow is in scope — the projection reads an
 * omitted `included_*_ids` list as "all of them".
 */
export function buildCurrentProjectionPlan(
  profile: Profile,
  today: Date,
  endDate?: string,
): Portfolio {
  const dates = getDefaultPlanDates(profile, today)
  const end = new Date(today.getFullYear() + CURRENT_PROJECTION_YEARS, today.getMonth(), 1)
  return {
    id: CURRENT_PROJECTION_ID,
    name: '',
    ...dates,
    end_date: endDate ?? formatDate(end),
  }
}
