import { formatDate } from '$lib/@snaha/kalkul-maths'
import { DEFAULT_INFLATION_RATE } from '$lib/plan-defaults'
import type { Portfolio } from '$lib/schemas'

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
 * Starts on the first of the current month, like a new plan, and runs
 * {@link CURRENT_PROJECTION_YEARS} ahead unless `endDate` says otherwise.
 *
 * Every asset, liability and cash flow is in scope — the projection reads an
 * omitted `included_*_ids` list as "all of them".
 */
export function buildCurrentProjectionPlan(today: Date, endDate?: string): Portfolio {
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear() + CURRENT_PROJECTION_YEARS, today.getMonth(), 1)
  return {
    id: CURRENT_PROJECTION_ID,
    name: '',
    start_date: formatDate(start),
    end_date: endDate ?? formatDate(end),
    inflation_rate: DEFAULT_INFLATION_RATE,
  }
}
