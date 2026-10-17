import { describe, expect, it, vi } from 'vitest'

import {
  type AppRoute,
  getNextStepUrl,
  getOnboardingSteps,
  getPrevStepUrl,
} from './onboarding-steps'
import routes from './routes'
import type { Profile } from './schemas'

// `resolve()` needs client-side bundler state; this module only tests the
// step-ordering/navigation logic, so resolve to the literal path.
vi.mock('$app/paths', () => ({
  resolve: (path: string) => path,
}))

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: 'Test User',
    email: '',
    ...overrides,
  }
}

describe('getOnboardingSteps', () => {
  it('returns the four always-present steps first and last', () => {
    const steps = getOnboardingSteps(makeProfile())
    expect(steps).toContain(routes.PROFILE)
    expect(steps).toContain(routes.FINANCES_EDIT)
    expect(steps).toContain(routes.FINANCES_EDIT_INCOME)
    expect(steps).toContain(routes.FINANCES_EDIT_EXPENSES)
    expect(steps.at(-1)).toBe(routes.FINANCES_EDIT_TRANSFERS)
  })

  it('omits optional steps when the flags are off and no items exist', () => {
    const steps = getOnboardingSteps(makeProfile())
    expect(steps).not.toContain(routes.FINANCES_EDIT_INVESTMENTS)
    expect(steps).not.toContain(routes.FINANCES_EDIT_TANGIBLE_ASSETS)
    expect(steps).not.toContain(routes.FINANCES_EDIT_LIABILITIES)
  })

  it('includes an optional step when its has_* flag is set', () => {
    const steps = getOnboardingSteps(makeProfile({ has_investments: true }))
    expect(steps).toContain(routes.FINANCES_EDIT_INVESTMENTS)

    const assetsSteps = getOnboardingSteps(makeProfile({ has_tangible_assets: true }))
    expect(assetsSteps).toContain(routes.FINANCES_EDIT_TANGIBLE_ASSETS)

    const liabSteps = getOnboardingSteps(makeProfile({ has_liabilities: true }))
    expect(liabSteps).toContain(routes.FINANCES_EDIT_LIABILITIES)
  })

  it('includes an optional step when items already exist even if the flag is off', () => {
    const steps = getOnboardingSteps(
      makeProfile({
        has_investments: false,
        investments: [{ id: 'i1', name: 'IBKR', balance: 1000, apy: 5 }],
      }),
    )
    expect(steps).toContain(routes.FINANCES_EDIT_INVESTMENTS)
  })

  it('orders the optional steps between Current finances and Recurring income', () => {
    const steps = getOnboardingSteps(
      makeProfile({
        has_investments: true,
        has_tangible_assets: true,
        has_liabilities: true,
      }),
    )
    expect(steps).toEqual([
      routes.PROFILE,
      routes.FINANCES_EDIT,
      routes.FINANCES_EDIT_INVESTMENTS,
      routes.FINANCES_EDIT_TANGIBLE_ASSETS,
      routes.FINANCES_EDIT_LIABILITIES,
      routes.FINANCES_EDIT_INCOME,
      routes.FINANCES_EDIT_EXPENSES,
      routes.FINANCES_EDIT_TRANSFERS,
    ])
  })
})

describe('getNextStepUrl', () => {
  it('falls back to the home route on the final step', () => {
    expect(getNextStepUrl(routes.FINANCES_EDIT_TRANSFERS, makeProfile())).toBe(routes.HOME)
  })

  it('returns the following step for an unknown route', () => {
    expect(getNextStepUrl('/not-a-step' as AppRoute, makeProfile())).toBe(routes.HOME)
  })

  it('walks forward through the optional steps in order', () => {
    const profile = makeProfile({ has_investments: true })
    expect(getNextStepUrl(routes.FINANCES_EDIT, profile)).toBe(routes.FINANCES_EDIT_INVESTMENTS)
    expect(getNextStepUrl(routes.FINANCES_EDIT_INVESTMENTS, profile)).toBe(
      routes.FINANCES_EDIT_INCOME,
    )
  })
})

describe('getPrevStepUrl', () => {
  it('falls back to the home route on the first step', () => {
    expect(getPrevStepUrl(routes.PROFILE, makeProfile())).toBe(routes.HOME)
  })

  it('walks backward through the optional steps in order', () => {
    const profile = makeProfile({ has_investments: true })
    expect(getPrevStepUrl(routes.FINANCES_EDIT_INVESTMENTS, profile)).toBe(routes.FINANCES_EDIT)
    expect(getPrevStepUrl(routes.FINANCES_EDIT_INCOME, profile)).toBe(
      routes.FINANCES_EDIT_INVESTMENTS,
    )
  })
})
