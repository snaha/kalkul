import { addMessages, init } from 'svelte-i18n'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import en from '$lib/locales/en.json'
import storageKeys from '$lib/storage-keys'

import { appStore } from './app.svelte'
import { loadErrorStore } from './load-error.svelte'
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

describe('appStore.load corrupt-data recovery', () => {
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
    loadErrorStore.dismiss()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function recoveryKeys(): string[] {
    return [...backing.keys()].filter((k) => k.startsWith(storageKeys.DATA_CORRUPT_PREFIX))
  }

  const validPortfolio = {
    id: 'p1',
    name: 'Plan',
    start_date: '2026-01-01',
    end_date: '2040-01-01',
    inflation_rate: 0.02,
  }

  it('loads defaults without a recovery state when no data is stored', () => {
    appStore.load()
    expect(appStore.profile.name).toBe('')
    expect(loadErrorStore.error).toBeUndefined()
    expect(recoveryKeys()).toEqual([])
  })

  it('quarantines unparseable JSON before it can be overwritten', () => {
    backing.set(storageKeys.DATA, '{definitely not json')
    appStore.load()

    // The raw payload survives under a recovery key and in the error store.
    expect(recoveryKeys()).toHaveLength(1)
    expect(backing.get(recoveryKeys()[0])).toBe('{definitely not json')
    expect(loadErrorStore.error?.raw).toBe('{definitely not json')
    expect(loadErrorStore.error?.recoveryKey).toBe(recoveryKeys()[0])

    // A subsequent persist overwrites the main key but not the quarantine.
    appStore.updateProfile({ name: 'After' })
    expect(backing.get(recoveryKeys()[0])).toBe('{definitely not json')
  })

  it('salvages the valid portfolios and drops only the invalid one', () => {
    backing.set(
      storageKeys.DATA,
      JSON.stringify({
        lastUpdated: 42,
        profile: { name: 'Jane', email: '' },
        portfolios: [validPortfolio, { id: 'p2', name: 'Broken' }],
      }),
    )
    appStore.load()

    expect(appStore.profile.name).toBe('Jane')
    expect(appStore.portfolios.map((p) => p.id)).toEqual(['p1'])
    expect(appStore.lastUpdated).toBe(42)
    expect(loadErrorStore.error).toBeDefined()
  })

  it('salvages the rest of the profile when a single list item is invalid', () => {
    backing.set(
      storageKeys.DATA,
      JSON.stringify({
        lastUpdated: 1,
        profile: {
          name: 'Jane',
          email: '',
          cash_amount: 100,
          incomes: [
            {
              id: 'i1',
              name: 'Salary',
              amount: 1000,
              frequency: 'monthly',
              withhold_taxes: false,
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
            { id: 'i2', name: 'Broken', amount: 'NaN' },
          ],
        },
        portfolios: [],
      }),
    )
    appStore.load()

    expect(appStore.profile.name).toBe('Jane')
    expect(appStore.profile.cash_amount).toBe(100)
    expect(appStore.profile.incomes?.map((i) => i.id)).toEqual(['i1'])
  })

  it('drops only the invalid transfer inside an otherwise valid portfolio', () => {
    backing.set(
      storageKeys.DATA,
      JSON.stringify({
        lastUpdated: 1,
        profile: { name: 'Jane', email: '' },
        portfolios: [
          {
            ...validPortfolio,
            transfers: [
              {
                id: 't1',
                name: 'Valid',
                from_asset_id: 'cash',
                to_asset_id: 'inv-1',
                amount: 100,
                schedule: 'one_time',
                transaction_year: 2030,
                transaction_month: 1,
              },
              { id: 't2', name: 'Broken', from_asset_id: 'cash' },
            ],
          },
        ],
      }),
    )
    appStore.load()

    expect(appStore.portfolios).toHaveLength(1)
    expect(appStore.portfolios[0].transfers?.map((t) => t.id)).toEqual(['t1'])
  })

  it('falls back to the default profile when scalar profile fields are broken', () => {
    backing.set(
      storageKeys.DATA,
      JSON.stringify({
        lastUpdated: 1,
        profile: { name: 42, email: [] },
        portfolios: [validPortfolio],
      }),
    )
    appStore.load()

    expect(appStore.profile.name).toBe('')
    // Valid portfolios still survive a broken profile.
    expect(appStore.portfolios.map((p) => p.id)).toEqual(['p1'])
  })

  it('salvages nothing but still quarantines a legacy pre-rewrite payload', () => {
    const legacy = JSON.stringify({ lastUpdated: 1, clients: [{ name: 'Old shape' }] })
    backing.set(storageKeys.DATA, legacy)
    appStore.load()

    expect(appStore.profile.name).toBe('')
    expect(appStore.portfolios).toEqual([])
    expect(loadErrorStore.error?.raw).toBe(legacy)
    expect(recoveryKeys()).toHaveLength(1)
  })
})
