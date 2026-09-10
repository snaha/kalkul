import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Profile } from '$lib/schemas'
import storageKeys from '$lib/storage-keys'
import { toDateOnlyString } from '$lib/utils'

import { appStore } from './app.svelte'

// The store stamps snapshots with its own `new Date()`, so a suite that read
// the real clock could straddle midnight between the two reads and compare
// against yesterday's date. Freezing it removes that race entirely.
const NOW = new Date(2026, 5, 15, 12, 0, 0)
const TODAY = toDateOnlyString(NOW)

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
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('records nothing while the profile has no financial data', () => {
    appStore.updateProfile({ name: 'Jane Doe' })
    expect(appStore.profile.snapshots).toBeUndefined()
  })

  it('records a snapshot dated today the first time balances are saved', () => {
    appStore.updateProfile({ name: 'Jane Doe', cash_amount: 15_000 })
    expect(appStore.profile.snapshots).toEqual([
      { date: TODAY, cash_amount: 15_000, investments: [], tangible_assets: [], liabilities: [] },
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
      { date: TODAY, cash_amount: 0, investments: [], tangible_assets: [], liabilities: [] },
    ])
  })

  it('keeps an older snapshot when a new balance is saved on a later date', () => {
    appStore.updateProfile({
      cash_amount: 15_000,
      snapshots: [{ date: '2020-01-01', cash_amount: 1 }],
    })
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2020-01-01', TODAY])
  })
})

describe('appStore.confirmBalances', () => {
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
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('re-dates the baseline to today even when no balance changed', () => {
    appStore.updateProfile({ cash_amount: 15_000, snapshots: [STALE] })
    // Nothing moved, so the plain update left the stale baseline alone.
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2020-01-01'])

    appStore.confirmBalances({ cash_amount: 15_000 })

    expect(appStore.profile.snapshots).toEqual([STALE, { ...STALE, date: TODAY }])
  })

  it('records edited values under today, replacing an existing entry for today', () => {
    appStore.updateProfile({ cash_amount: 15_000, snapshots: [STALE] })
    appStore.confirmBalances({ cash_amount: 15_000 })
    appStore.confirmBalances({ cash_amount: 16_000 })

    expect(appStore.profile.snapshots).toEqual([
      STALE,
      { ...STALE, date: TODAY, cash_amount: 16_000 },
    ])
    expect(appStore.profile.cash_amount).toBe(16_000)
  })
})

describe('appStore.updateProfile on a stale profile', () => {
  // Balances confirmed on 2026-01-01 and untouched since, read on 2026-06-15:
  // 165 elapsed days for cash to accrue, the ETF to compound and five monthly
  // installments to come off the loan.
  const STALE_PROFILE: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 15_000,
    has_investments: true,
    investments: [{ id: 'inv1', name: 'ETF', balance: 100_000, apy: 10 }],
    incomes: [
      {
        id: 'i1',
        name: 'Salary',
        amount: 5_000,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ],
    expenses: [
      {
        id: 'e1',
        name: 'Living',
        amount: 3_000,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ],
    liabilities: [
      {
        id: 'l1',
        name: 'Car loan',
        outstanding_balance: 6_000,
        installment_frequency: 'monthly',
        annual_rate: 5,
        installment_amount: 200,
        remaining_term: 3,
      },
    ],
    snapshots: [
      {
        date: '2026-01-01',
        cash_amount: 15_000,
        investments: [{ id: 'inv1', balance: 100_000 }],
        tangible_assets: [],
        liabilities: [{ id: 'l1', outstanding_balance: 6_000 }],
      },
    ],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    appStore.updateProfile(STALE_PROFILE)
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('carries the balances an edit did not mention forward to today', () => {
    // Adding an investment re-dates the baseline to today. Cash, the existing
    // ETF and the loan have to arrive there as the dashboard was showing them —
    // left at their January values they would give back five months of accrual,
    // growth and amortization the moment an unrelated edit landed.
    appStore.updateProfile({
      investments: [
        ...(STALE_PROFILE.investments ?? []),
        { id: 'inv2', name: 'Bonds', balance: 5_000, apy: 3 },
      ],
    })

    expect(appStore.profile.cash_amount).toBe(24_758)
    expect(appStore.profile.investments?.[0].balance).toBe(104_400)
    expect(appStore.profile.investments?.[1].balance).toBe(5_000)
    expect(appStore.profile.liabilities?.[0].outstanding_balance).toBe(5_118)
  })

  it('records the carried-forward balances in the new snapshot', () => {
    appStore.updateProfile({ cash_amount: 20_000 })

    expect(appStore.profile.snapshots?.at(-1)).toEqual({
      date: TODAY,
      // The edited value stands; everything else arrives projected to today.
      cash_amount: 20_000,
      investments: [{ id: 'inv1', balance: 104_400 }],
      tangible_assets: [],
      liabilities: [{ id: 'l1', outstanding_balance: 5_118 }],
    })
  })

  it('persists a confirmed balance that matches the stored one', () => {
    // The user looked at the Quick update suggestion, decided their cash really
    // is still 15,000 and typed it back. That is a statement about today, so it
    // has to be persisted verbatim rather than replaced by the projection.
    appStore.confirmBalances({
      cash_amount: 15_000,
      investments: [{ id: 'inv1', name: 'ETF', balance: 100_000, apy: 10 }],
    })

    expect(appStore.profile.cash_amount).toBe(15_000)
    expect(appStore.profile.investments?.[0].balance).toBe(100_000)
    expect(appStore.profile.snapshots?.at(-1)?.cash_amount).toBe(15_000)
  })

  it('amortizes loans the confirmation does not mention with its own clock', () => {
    appStore.confirmBalances({
      cash_amount: 15_000,
      investments: [{ id: 'inv1', name: 'ETF', balance: 100_000, apy: 10 }],
    })

    expect(appStore.profile.liabilities?.[0].outstanding_balance).toBe(5_118)
    expect(appStore.profile.liabilities?.[0].remaining_term).toBe(2.58)
  })

  it('leaves the stored balances and the baseline alone when no balance moved', () => {
    // A rename records nothing, so the January baseline still stands — and the
    // stored balances have to keep matching it, or the dashboard would project
    // today's values forward a second time from a date they never applied to.
    appStore.updateProfile({ name: 'Renamed' })

    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.cash_amount).toBe(15_000)
    expect(appStore.profile.investments?.[0].balance).toBe(100_000)
  })
})

describe('appStore.updateProfile persistence', () => {
  beforeEach(stubLocalStorage)

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

describe('appStore.deletePortfolio', () => {
  beforeEach(stubLocalStorage)

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('removes the transfers the plan owns and keeps the profile ones', () => {
    const transfer = {
      name: 'Buy',
      from_asset_id: 'cash',
      to_asset_id: 'inv1',
      amount: 100,
      schedule: 'one_time',
      transaction_year: 2027,
      transaction_month: 1,
    }
    appStore.importBackup(
      JSON.stringify({
        profile: {
          name: 'Jane',
          email: '',
          investments: [{ id: 'inv1', name: 'ETF', balance: 0, apy: 0 }],
          transfers: [
            { ...transfer, id: 'shared' },
            { ...transfer, id: 'owned', plan_id: 'plan-1' },
          ],
        },
        portfolios: [
          {
            id: 'plan-1',
            name: 'Plan',
            start_date: '2026-01-01',
            end_date: '2060-01-01',
            inflation_rate: 2,
          },
        ],
      }),
    )
    appStore.portfolios[0].delete()
    expect(appStore.portfolios).toEqual([])
    expect(appStore.profile.transfers?.map((t) => t.id)).toEqual(['shared'])
  })
})
