import { describe, expect, it } from 'vitest'

import routes, { routeFromId } from './routes'

describe('routeFromId', () => {
  it('drops layout-group segments so ids match route constants', () => {
    expect(routeFromId('/(app)/financial-data/cash')).toBe(routes.FINANCIAL_DATA_CASH)
    expect(routeFromId('/(onboarding)/profile')).toBe(routes.PROFILE)
    expect(routeFromId('/(onboarding)/finances/edit/investments')).toBe(
      routes.FINANCES_EDIT_INVESTMENTS,
    )
    expect(routeFromId('/(app)/financial-data/transfers')).toBe(routes.FINANCIAL_DATA_TRANSFERS)
  })

  it('maps a group-only id to the root route', () => {
    expect(routeFromId('/(app)')).toBe(routes.HOME)
  })

  it('keeps dynamic segments intact', () => {
    expect(routeFromId('/(app)/plan/[id]')).toBe('/plan/[id]')
  })

  it('returns an empty string for a missing route id', () => {
    expect(routeFromId(undefined)).toBe('')
  })
})
