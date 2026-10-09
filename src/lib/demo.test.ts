import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import routes from '$lib/routes'
import storageKeys from '$lib/storage-keys'
import { appStore } from '$lib/stores/app.svelte'

import {
  DEMO_PERSONAS,
  DEMO_PLAN_ID,
  buildDemoData,
  exitDemo,
  personaLabel,
  restoreDemo,
  startDemo,
} from './demo'

const TODAY = new Date(2026, 8, 17) // 2026-09-17

const persona = (id: string) => {
  const found = DEMO_PERSONAS.find((p) => p.id === id)
  if (!found) throw new Error(`no persona ${id}`)
  return found
}

describe('personaLabel', () => {
  test('first name and age on the given day, as the chooser shows them', () => {
    expect(DEMO_PERSONAS.map((p) => personaLabel(p, TODAY))).toEqual([
      'Tereza, 20',
      'Peter, 29',
      'Claire, 41',
      'Jan, 56',
    ])
  })
})

describe('buildDemoData', () => {
  test('puts an editable plan of the whole profile in front of the persona plans', () => {
    const claire = persona('claire')
    const { profile, portfolios } = buildDemoData(claire, TODAY)

    expect(profile).toBe(claire.data.profile)
    expect(portfolios.length).toBe(claire.data.portfolios.length + 1)
    expect(portfolios[0]).toMatchObject({
      id: DEMO_PLAN_ID,
      name: 'Claire, 41',
      start_date: '2026-09-01',
      included_investment_ids: ['inv-1', 'inv-2', 'inv-3'],
      // ta-4 is the chalet a saved plan owns, so it is not part of the current situation.
      included_tangible_asset_ids: ['ta-1', 'ta-2', 'ta-3'],
      included_liability_ids: ['li-1'],
    })
  })

  test('leaves the persona data untouched', () => {
    const jan = persona('jan')
    const before = JSON.stringify(jan.data)
    buildDemoData(jan, TODAY)
    expect(JSON.stringify(jan.data)).toBe(before)
  })
})

describe('demo lifecycle', () => {
  let backing: Map<string, string>

  beforeEach(() => {
    backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (backing.has(key) ? backing.get(key) : undefined),
      setItem: (key: string, value: string) => {
        backing.set(key, value)
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
    appStore.clear()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  test('startDemo loads the persona in memory and remembers only its id', () => {
    startDemo(persona('claire'), TODAY)
    expect(appStore.demo).toBe(true)
    expect(appStore.profile.name).toBe('Claire Moreau')
    expect(appStore.portfolios[0]?.id).toBe(DEMO_PLAN_ID)
    expect(backing.get(storageKeys.DEMO)).toBe('claire')
    expect(backing.has(storageKeys.DATA)).toBe(false)
  })

  test('restoreDemo picks the remembered persona up again after a reload', () => {
    backing.set(storageKeys.DEMO, 'jan')
    restoreDemo(TODAY)
    expect(appStore.demo).toBe(true)
    expect(appStore.profile.name).toBe('Jan Dvořák')
  })

  test('restoreDemo lets stored data win and forgets the persona', () => {
    backing.set(storageKeys.DEMO, 'jan')
    appStore.importBackup(JSON.stringify({ profile: { name: 'Jane', email: '' }, portfolios: [] }))
    restoreDemo(TODAY)
    expect(appStore.demo).toBe(false)
    expect(appStore.profile.name).toBe('Jane')
    expect(backing.has(storageKeys.DEMO)).toBe(false)
  })

  test('restoreDemo does nothing without a key', () => {
    restoreDemo(TODAY)
    expect(appStore.demo).toBe(false)
  })

  test('exitDemo forgets the persona and sends an empty browser to onboarding', () => {
    startDemo(persona('tereza'), TODAY)
    expect(exitDemo()).toBe(routes.PROFILE)
    expect(appStore.demo).toBe(false)
    expect(appStore.profile.name).toBe('')
    expect(backing.has(storageKeys.DEMO)).toBe(false)
  })

  test('exitDemo sends a browser with data to the dashboard', () => {
    startDemo(persona('tereza'), TODAY)
    backing.set(
      storageKeys.DATA,
      JSON.stringify({ lastUpdated: 1, profile: { name: 'Jane', email: '' }, portfolios: [] }),
    )
    expect(exitDemo()).toBe(routes.HOME)
    expect(appStore.profile.name).toBe('Jane')
  })
})
