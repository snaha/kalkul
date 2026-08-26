import { resolve } from '$app/paths'

import type { Profile } from '$lib/schemas'

import routes from './routes'

export type AppRoute = (typeof routes)[keyof typeof routes]

/**
 * Build the ordered list of onboarding step routes for a given profile.
 * Optional steps (investments / tangible assets / liabilities) are included
 * if the user opted into them OR if any items already exist.
 */
export function getOnboardingSteps(profile: Profile): AppRoute[] {
  const steps: AppRoute[] = [routes.PROFILE, routes.FINANCES_EDIT]
  if (profile.has_investments || (profile.investments?.length ?? 0) > 0) {
    steps.push(routes.FINANCES_EDIT_INVESTMENTS)
  }
  if (profile.has_tangible_assets || (profile.tangible_assets?.length ?? 0) > 0) {
    steps.push(routes.FINANCES_EDIT_TANGIBLE_ASSETS)
  }
  if (profile.has_liabilities || (profile.liabilities?.length ?? 0) > 0) {
    steps.push(routes.FINANCES_EDIT_LIABILITIES)
  }
  steps.push(
    routes.FINANCES_EDIT_INCOME,
    routes.FINANCES_EDIT_EXPENSES,
    routes.FINANCES_EDIT_TRANSFERS,
  )
  return steps
}

// `resolve()` is declared with per-literal overloads, so passing a union
// breaks type inference. This switch maps each literal back onto its own
// overload so callers can work with an AppRoute union.
function resolveAppRoute(route: AppRoute): string {
  switch (route) {
    case '/':
      return resolve('/')
    case '/profile':
      return resolve('/profile')
    case '/finances/edit':
      return resolve('/finances/edit')
    case '/finances/edit/investments':
      return resolve('/finances/edit/investments')
    case '/finances/edit/tangible-assets':
      return resolve('/finances/edit/tangible-assets')
    case '/finances/edit/liabilities':
      return resolve('/finances/edit/liabilities')
    case '/finances/edit/income':
      return resolve('/finances/edit/income')
    case '/finances/edit/expenses':
      return resolve('/finances/edit/expenses')
    case '/finances/edit/transfers':
      return resolve('/finances/edit/transfers')
    case '/dev':
      return resolve('/dev')
    default:
      return resolve('/')
  }
}

export function getNextStepUrl(current: AppRoute, profile: Profile): string {
  const steps = getOnboardingSteps(profile)
  const idx = steps.indexOf(current)
  const next = idx === -1 || idx >= steps.length - 1 ? routes.HOME : (steps[idx + 1] ?? routes.HOME)
  return resolveAppRoute(next)
}

export function getPrevStepUrl(current: AppRoute, profile: Profile): string {
  const steps = getOnboardingSteps(profile)
  const idx = steps.indexOf(current)
  const prev = idx <= 0 ? routes.HOME : (steps[idx - 1] ?? routes.HOME)
  return resolveAppRoute(prev)
}
