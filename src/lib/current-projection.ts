import { getDefaultPlanDates } from '$lib/plan-defaults'
import type { Portfolio, Profile } from '$lib/schemas'

/**
 * Id of the synthesized plan. Deliberately not a UUID so it can never be
 * mistaken for — or collide with — a plan the user saved.
 */
export const CURRENT_PROJECTION_ID = 'current-projection'

/**
 * The dashboard's always-present "Current projection": where the user's money
 * goes if nothing changes. It is derived on the fly rather than stored, so it
 * follows the profile automatically and never needs migrating.
 *
 * The timeline is the one a plan created from the Add projection dialog gets,
 * so the automatic projection and the user's first saved plan span the same
 * years unless they change them.
 *
 * Every asset, liability and cash flow is in scope — the projection reads an
 * omitted `included_*_ids` list as "all of them".
 */
export function buildCurrentProjectionPlan(profile: Profile, today: Date): Portfolio {
  return {
    id: CURRENT_PROJECTION_ID,
    name: '',
    ...getDefaultPlanDates(profile, today),
  }
}
