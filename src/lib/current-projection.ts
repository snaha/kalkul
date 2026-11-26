import { formatDate } from '$lib/@snaha/kalkul-maths'
import { getCurrentProfile } from '$lib/current-values'
import { snapshotFinancialData } from '$lib/plan-base'
import { DEFAULT_INFLATION_RATE, defaultPlanStart } from '$lib/plan-defaults'
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
const CURRENT_PROJECTION_YEARS = 20

/**
 * The dashboard's always-present "Current projection": where the user's money
 * goes if nothing changes. It is derived on the fly rather than stored, so it
 * follows the profile automatically and never needs migrating.
 *
 * Starts where a new plan does (`defaultPlanStart`) and runs
 * {@link CURRENT_PROJECTION_YEARS} ahead unless `endDate` says otherwise.
 *
 * Every asset, liability and cash flow of `profile` is in scope: the plan is
 * a copy of it, like a saved plan is at creation.
 *
 * `profile` is the stored one, with the balances as last recorded. They are
 * carried forward to the start here, so the projection opens with what the
 * user will have on that day and no day falls between the balances and the
 * first month it pays. Passing a profile already carried to today would carry
 * it twice.
 */
export function buildCurrentProjectionPlan(
  profile: Profile,
  today: Date,
  endDate?: string,
): Portfolio {
  const start = defaultPlanStart(today)
  const atStart = getCurrentProfile(profile, start)
  const end = new Date(start.getFullYear() + CURRENT_PROJECTION_YEARS, start.getMonth(), 1)
  return {
    id: CURRENT_PROJECTION_ID,
    name: '',
    start_date: formatDate(start),
    end_date: endDate ?? formatDate(end),
    inflation_rate: DEFAULT_INFLATION_RATE,
    ...snapshotFinancialData(atStart),
    base: snapshotFinancialData(atStart),
  }
}
