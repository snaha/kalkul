import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import storageKeys from '$lib/storage-keys'

import { appStore } from './app.svelte'

describe('appStore.clear', () => {
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wipes in-memory data, persisted storage, and clears the loading flag', () => {
    appStore.importBackup(
      JSON.stringify({ profile: { name: 'Jane Doe', email: '' }, portfolios: [] }),
    )
    expect(appStore.profile.name).toBe('Jane Doe')
    expect(backing.has(storageKeys.DATA)).toBe(true)

    appStore.clear()

    expect(appStore.profile.name).toBe('')
    expect(appStore.portfolios).toEqual([])
    expect(appStore.loading).toBe(false)
    expect(backing.has(storageKeys.DATA)).toBe(false)
  })
})

describe('appStore.updateProfile persistence', () => {
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
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('keeps terms_accepted and tax rules when persisting', () => {
    appStore.importBackup(JSON.stringify({ profile: { name: 'Jane', email: '' }, portfolios: [] }))
    appStore.updateProfile({
      terms_accepted: true,
      investment_tax_rules: [{ id: 'r1', rate: 15, holding_period: 'less_than', holding_years: 3 }],
      tangible_asset_tax_rules: [{ id: 'r2', holding_period: 'more_than' }],
    })

    const persisted = JSON.parse(backing.get(storageKeys.DATA) ?? '{}').profile
    expect(persisted.terms_accepted).toBe(true)
    expect(persisted.investment_tax_rules).toEqual([
      { id: 'r1', rate: 15, holding_period: 'less_than', holding_years: 3 },
    ])
    expect(persisted.tangible_asset_tax_rules).toEqual([{ id: 'r2', holding_period: 'more_than' }])
  })
})
