import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import storageKeys from '$lib/storage-keys'
import { toDateOnlyString } from '$lib/utils'

import { appStore } from './app.svelte'

let backing: Map<string, string>

function stubLocalStorage(): void {
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
}

describe('appStore.clear', () => {
  beforeEach(stubLocalStorage)

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

describe('appStore.updateProfile snapshot recording', () => {
  const today = toDateOnlyString(new Date())

  beforeEach(() => {
    stubLocalStorage()
    appStore.clear()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('records nothing while the profile has no financial data', () => {
    appStore.updateProfile({ name: 'Jane Doe' })
    expect(appStore.profile.snapshots).toBeUndefined()
  })

  it('records a snapshot dated today the first time balances are saved', () => {
    appStore.updateProfile({ name: 'Jane Doe', cash_amount: 15_000 })
    expect(appStore.profile.snapshots).toEqual([
      { date: today, cash_amount: 15_000, investments: [], tangible_assets: [], liabilities: [] },
    ])
  })

  it("replaces today's snapshot rather than appending a second one", () => {
    appStore.updateProfile({ cash_amount: 15_000 })
    appStore.updateProfile({ cash_amount: 16_000 })
    expect(appStore.profile.snapshots).toHaveLength(1)
    expect(appStore.profile.snapshots?.[0].cash_amount).toBe(16_000)
  })

  it('leaves history alone when an edit does not touch a balance', () => {
    appStore.updateProfile({ cash_amount: 15_000 })
    const recorded = appStore.profile.snapshots
    appStore.updateProfile({ name: 'Renamed' })
    expect(appStore.profile.snapshots).toEqual(recorded)
  })

  it('records the drop to zero once a profile that had balances spends them', () => {
    appStore.updateProfile({
      cash_amount: 15_000,
      snapshots: [{ date: '2020-01-01', cash_amount: 15_000 }],
    })
    appStore.updateProfile({ cash_amount: 0 })
    expect(appStore.profile.snapshots).toEqual([
      { date: '2020-01-01', cash_amount: 15_000 },
      { date: today, cash_amount: 0, investments: [], tangible_assets: [], liabilities: [] },
    ])
  })

  it('keeps an older snapshot when a new balance is saved on a later date', () => {
    appStore.updateProfile({
      cash_amount: 15_000,
      snapshots: [{ date: '2020-01-01', cash_amount: 1 }],
    })
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2020-01-01', today])
  })
})

describe('appStore.confirmBalances', () => {
  const today = toDateOnlyString(new Date())
  // A stale baseline whose balances still match the profile: the case where
  // `updateProfile` records nothing because no balance moved.
  const STALE = {
    date: '2020-01-01',
    cash_amount: 15_000,
    investments: [],
    tangible_assets: [],
    liabilities: [],
  }

  beforeEach(() => {
    stubLocalStorage()
    appStore.clear()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('re-dates the baseline to today even when no balance changed', () => {
    appStore.updateProfile({ cash_amount: 15_000, snapshots: [STALE] })
    // Nothing moved, so the plain update left the stale baseline alone.
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2020-01-01'])

    appStore.confirmBalances({ cash_amount: 15_000 })

    expect(appStore.profile.snapshots).toEqual([STALE, { ...STALE, date: today }])
  })

  it('records edited values under today, replacing an existing entry for today', () => {
    appStore.updateProfile({ cash_amount: 15_000, snapshots: [STALE] })
    appStore.confirmBalances({ cash_amount: 15_000 })
    appStore.confirmBalances({ cash_amount: 16_000 })

    expect(appStore.profile.snapshots).toEqual([
      STALE,
      { ...STALE, date: today, cash_amount: 16_000 },
    ])
    expect(appStore.profile.cash_amount).toBe(16_000)
  })
})
