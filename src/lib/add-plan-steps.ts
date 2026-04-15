import { resolve } from '$app/paths'

import type { Profile } from '$lib/schemas'

import routes from './routes'

export type AddPlanRoute =
  | typeof routes.PLAN_ADD_INTRO
  | typeof routes.PLAN_ADD_DETAILS
  | typeof routes.PLAN_ADD_DATA

/**
 * Build the ordered list of add plan step routes for a given profile.
 * The intro step is skipped if the user has opted to hide it.
 */
export function getAddPlanSteps(profile: Profile): AddPlanRoute[] {
  const steps: AddPlanRoute[] = []
  if (!profile.hide_plan_intro) {
    steps.push(routes.PLAN_ADD_INTRO)
  }
  steps.push(routes.PLAN_ADD_DETAILS, routes.PLAN_ADD_DATA)
  return steps
}

/**
 * Get the first step URL for adding a plan based on user preferences.
 */
export function getFirstAddPlanStepUrl(profile: Profile): string {
  const steps = getAddPlanSteps(profile)
  return resolveAddPlanRoute(steps[0] ?? routes.PLAN_ADD_DETAILS)
}

// `resolve()` is declared with per-literal overloads, so passing a union
// breaks type inference. This switch maps each literal back onto its own
// overload so callers can work with an AddPlanRoute union.
function resolveAddPlanRoute(route: AddPlanRoute): string {
  switch (route) {
    case '/plan/add/intro':
      return resolve('/plan/add/intro')
    case '/plan/add/details':
      return resolve('/plan/add/details')
    case '/plan/add/data':
      return resolve('/plan/add/data')
    default:
      return resolve('/plan/add/details')
  }
}

export function getNextAddPlanStepUrl(current: AddPlanRoute, profile: Profile): string {
  const steps = getAddPlanSteps(profile)
  const idx = steps.indexOf(current)
  const next =
    idx === -1 || idx >= steps.length - 1
      ? routes.PLAN_ADD_DATA
      : (steps[idx + 1] ?? routes.PLAN_ADD_DATA)
  return resolveAddPlanRoute(next)
}

export function getPrevAddPlanStepUrl(current: AddPlanRoute, profile: Profile): string {
  const steps = getAddPlanSteps(profile)
  const idx = steps.indexOf(current)
  if (idx <= 0) {
    return resolve(routes.HOME)
  }
  const prev = steps[idx - 1] ?? routes.PLAN_ADD_INTRO
  return resolveAddPlanRoute(prev)
}
