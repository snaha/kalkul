import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Portfolio, Profile, ProfileInvestment } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

import {
  PROFILE_LISTS,
  duplicateProfileItem,
  isIncludedInPlan,
  removeProfileItem,
  toggleIncludedInPlan,
  upsertProfileItem,
} from './profile-lists'

// The helpers read and write the real appStore singleton; a module mock keeps
// them exercisable without booting the store (and its localStorage persist).
const profile: Partial<Profile> = {}
const updateProfile = vi.fn((updates: Partial<Profile>) => Object.assign(profile, updates))

vi.mock('$lib/stores/app.svelte', () => ({
  appStore: {
    get profile() {
      return profile
    },
    updateProfile: (updates: Partial<Profile>) => updateProfile(updates),
  },
}))

function makeInvestment(id: string, name = id): ProfileInvestment {
  return { id, name, balance: 100, apy: 5 }
}

/** Minimal PortfolioStore stand-in: the helpers only touch include lists. */
function makePlan(overrides: Partial<Portfolio> = {}): PortfolioStore {
  const state: Record<string, unknown> = { ...overrides }
  return new Proxy(
    {
      update: (updates: Partial<Omit<Portfolio, 'id'>>) => Object.assign(state, updates),
    },
    {
      get: (target, prop) =>
        prop in target ? target[prop as keyof typeof target] : state[prop as string],
    },
  ) as unknown as PortfolioStore
}

beforeEach(() => {
  for (const key of Object.keys(profile)) delete profile[key as keyof Profile]
  updateProfile.mockClear()
})

describe('upsertProfileItem', () => {
  it('appends a new item and syncs the has_* flag', () => {
    upsertProfileItem(PROFILE_LISTS.investment, makeInvestment('i1'), makePlan())
    expect(updateProfile).toHaveBeenCalledWith({
      investments: [makeInvestment('i1')],
      has_investments: true,
    })
  })

  it('replaces in place by id rather than appending a second copy', () => {
    profile.investments = [makeInvestment('i1'), makeInvestment('i2')]
    upsertProfileItem(PROFILE_LISTS.investment, makeInvestment('i1', 'renamed'), makePlan())
    expect(profile.investments?.map((i) => i.name)).toEqual(['renamed', 'i2'])
  })

  it('adds a new id to the plan include list when the plan has one', () => {
    profile.investments = [makeInvestment('i1')]
    const plan = makePlan({ included_investment_ids: ['i1'] })
    upsertProfileItem(PROFILE_LISTS.investment, makeInvestment('i2'), plan)
    expect(plan.included_investment_ids).toEqual(['i1', 'i2'])
  })

  it('leaves an undefined include list alone — that already means "all included"', () => {
    const plan = makePlan()
    upsertProfileItem(PROFILE_LISTS.investment, makeInvestment('i1'), plan)
    expect(plan.included_investment_ids).toBeUndefined()
  })

  it('does not re-add the id when updating an existing item', () => {
    profile.investments = [makeInvestment('i1')]
    const plan = makePlan({ included_investment_ids: ['i1'] })
    upsertProfileItem(PROFILE_LISTS.investment, makeInvestment('i1', 'renamed'), plan)
    expect(plan.included_investment_ids).toEqual(['i1'])
  })
})

describe('duplicateProfileItem', () => {
  it('inserts the renamed copy directly after the original', () => {
    profile.investments = [makeInvestment('i1'), makeInvestment('i2')]
    const copyId = duplicateProfileItem(
      PROFILE_LISTS.investment,
      'i1',
      (name) => `${name} copy`,
      makePlan(),
    )
    expect(profile.investments?.map((i) => i.name)).toEqual(['i1', 'i1 copy', 'i2'])
    expect(copyId).toBeDefined()
    expect(copyId).not.toBe('i1')
  })

  it('includes the copy when the plan has an explicit include list', () => {
    profile.investments = [makeInvestment('i1'), makeInvestment('i2')]
    // i2 excluded, so the list is explicit.
    const plan = makePlan({ included_investment_ids: ['i1'] })
    const copyId = duplicateProfileItem(
      PROFILE_LISTS.investment,
      'i1',
      (name) => `${name} copy`,
      plan,
    )
    expect(plan.included_investment_ids).toEqual(['i1', copyId])
  })

  it('returns undefined and changes nothing for an unknown id', () => {
    profile.investments = [makeInvestment('i1')]
    const plan = makePlan({ included_investment_ids: ['i1'] })
    expect(duplicateProfileItem(PROFILE_LISTS.investment, 'nope', (n) => n, plan)).toBeUndefined()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(plan.included_investment_ids).toEqual(['i1'])
  })
})

describe('removeProfileItem', () => {
  it('drops the item and clears the has_* flag when the list empties', () => {
    profile.investments = [makeInvestment('i1')]
    removeProfileItem(PROFILE_LISTS.investment, 'i1')
    expect(updateProfile).toHaveBeenCalledWith({ investments: [], has_investments: false })
  })
})

describe('isIncludedInPlan', () => {
  it('treats an undefined include list as everything included', () => {
    expect(isIncludedInPlan(PROFILE_LISTS.investment, 'i1', makePlan())).toBe(true)
  })

  it('honours an explicit include list', () => {
    const plan = makePlan({ included_investment_ids: ['i1'] })
    expect(isIncludedInPlan(PROFILE_LISTS.investment, 'i1', plan)).toBe(true)
    expect(isIncludedInPlan(PROFILE_LISTS.investment, 'i2', plan)).toBe(false)
  })
})

describe('toggleIncludedInPlan', () => {
  it('seeds from all current ids when the plan has no include list yet', () => {
    profile.investments = [makeInvestment('i1'), makeInvestment('i2')]
    const plan = makePlan()
    toggleIncludedInPlan(PROFILE_LISTS.investment, 'i2', plan)
    expect(plan.included_investment_ids).toEqual(['i1'])
  })

  it('adds the id back when it is currently excluded', () => {
    const plan = makePlan({ included_investment_ids: ['i1'] })
    toggleIncludedInPlan(PROFILE_LISTS.investment, 'i2', plan)
    expect(plan.included_investment_ids).toEqual(['i1', 'i2'])
  })
})

describe('cash-flow lists', () => {
  it('carries no has_* flag, so incomes only update the list', () => {
    upsertProfileItem(
      PROFILE_LISTS.income,
      {
        id: 'inc1',
        name: 'Salary',
        amount: 100,
        frequency: 'monthly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
      makePlan(),
    )
    expect(updateProfile).toHaveBeenCalledWith({
      incomes: [expect.objectContaining({ id: 'inc1' })],
    })
  })
})
