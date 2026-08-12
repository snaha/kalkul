import { formatDate } from '$lib/@snaha/kalkul-maths'
import { yearOf } from '$lib/plan-projection'
import type { Portfolio, Profile } from '$lib/schemas'

/** Mirrors the defaults the add-plan flow starts from. */
const DEFAULT_END_AGE = 85
const DEFAULT_INFLATION_RATE = 0.02

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
 * Every asset, liability and cash flow is in scope — the projection reads an
 * omitted `included_*_ids` list as "all of them".
 */
export function buildCurrentProjectionPlan(profile: Profile, today: Date): Portfolio {
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return {
    id: CURRENT_PROJECTION_ID,
    name: '',
    start_date: formatDate(start),
    end_date: formatDate(endDate(profile, start)),
    inflation_rate: DEFAULT_INFLATION_RATE,
  }
}

function endDate(profile: Profile, start: Date): Date {
  if (profile.birth_date) {
    const birthMonth = Number(profile.birth_date.slice(5, 7)) - 1
    const end = new Date(yearOf(profile.birth_date) + DEFAULT_END_AGE, birthMonth, 1)
    // Someone already past the default end age still gets a projection to look
    // at rather than an empty chart.
    if (end > start) return end
  }
  return new Date(start.getFullYear() + DEFAULT_END_AGE, 0, 1)
}
