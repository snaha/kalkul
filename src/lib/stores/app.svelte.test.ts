import { addMessages, init } from 'svelte-i18n'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import en from '$lib/locales/en.json'
import storageKeys from '$lib/storage-keys'

import { appStore } from './app.svelte'
import { storageErrorStore } from './storage-error.svelte'

// Schema refinements resolve their error messages through svelte-i18n at
// parse time, so the locale must be initialized before any failing parse.
addMessages('en', en)
init({ fallbackLocale: 'en', initialLocale: 'en' })

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

describe('appStore.persist validation gate', () => {
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
    storageErrorStore.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function addValidPlan(): string {
    appStore.updateProfile({ name: 'Test' })
    return appStore.addPortfolio({
      name: 'Plan',
      start_date: '2026-01-01',
      end_date: '2040-01-01',
      inflation_rate: 0.02,
    })
  }

  it('persists valid portfolio writes and keeps the error store clear', () => {
    const id = addValidPlan()
    expect(storageErrorStore.hasError).toBe(false)
    const raw = backing.get(storageKeys.DATA)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw ?? '').portfolios[0].id).toBe(id)
  })

  it('refuses to persist a write the read path would reject', () => {
    const id = addValidPlan()
    const before = backing.get(storageKeys.DATA)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // A transfer with identical endpoints violates the transfer refinement;
    // portfolio.update() itself has no validation, so only the persist()
    // gate stands between this write and a dataset that bricks on reload.
    appStore.portfolios
      .find((p) => p.id === id)
      ?.update({
        transfers: [
          {
            id: 't1',
            name: 'Broken',
            from_asset_id: 'cash',
            to_asset_id: 'cash',
            amount: 100,
            schedule: 'one_time',
            transaction_year: 2030,
            transaction_month: 1,
          },
        ],
      })

    expect(storageErrorStore.kind).toBe('validation')
    // The stored payload is untouched — reloading still works.
    expect(backing.get(storageKeys.DATA)).toBe(before)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('clears the error once a subsequent valid write persists', () => {
    addValidPlan()
    storageErrorStore.setError('validation')
    appStore.updateProfile({ name: 'Renamed' })
    expect(storageErrorStore.hasError).toBe(false)
  })
})
