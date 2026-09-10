import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Profile } from '$lib/schemas'
import storageKeys from '$lib/storage-keys'
import { toDateOnlyString } from '$lib/utils'

import { seedSnapshotOn } from '../../routes/(app)/history/snapshot-form'
import { buildSnapshotSections, snapshotFromFields } from '../../routes/(app)/history/snapshot-form'
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
      {
        date: TODAY,
        cash_amount: 15_000,
        investments: [],
        tangible_assets: [],
        liabilities: [],
        incomes: [],
        expenses: [],
      },
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
      {
        date: TODAY,
        cash_amount: 0,
        investments: [],
        tangible_assets: [],
        liabilities: [],
        incomes: [],
        expenses: [],
      },
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
    incomes: [],
    expenses: [],
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

    expect(appStore.profile.cash_amount).toBe(24_757.7)
    expect(appStore.profile.investments?.[0].balance).toBe(104_399.63)
    expect(appStore.profile.investments?.[1].balance).toBe(5_000)
    expect(appStore.profile.liabilities?.[0].outstanding_balance).toBe(5_117.68)
  })

  it('records the carried-forward balances in the new snapshot', () => {
    appStore.updateProfile({ cash_amount: 20_000 })

    expect(appStore.profile.snapshots?.at(-1)).toEqual({
      date: TODAY,
      // The edited value stands; everything else arrives projected to today.
      cash_amount: 20_000,
      investments: [{ id: 'inv1', balance: 104_399.63 }],
      tangible_assets: [],
      // The term comes off with the balance: five installments paid, so 2.58
      // of the loan's three years are left.
      liabilities: [{ id: 'l1', outstanding_balance: 5_117.68, remaining_term: 2.58 }],
      // Cash flows are recorded alongside the balances, untouched by the
      // carry-forward — they are rates, not values that accrue.
      incomes: [{ id: 'i1', amount: 5_000, frequency: 'monthly' }],
      expenses: [{ id: 'e1', amount: 3_000, frequency: 'monthly' }],
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

    expect(appStore.profile.liabilities?.[0].outstanding_balance).toBe(5_117.68)
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

describe('appStore snapshot editing', () => {
  const JAN = {
    date: '2026-01-01',
    cash_amount: 1_000,
    investments: [],
    tangible_assets: [],
    liabilities: [],
    incomes: [],
    expenses: [],
  }
  const JUN = { ...JAN, date: '2026-06-01', cash_amount: 9_000 }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    appStore.updateProfile({ cash_amount: 9_000, snapshots: [JAN, JUN] })
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('saves an edited snapshot without stamping a second one for today', () => {
    appStore.saveSnapshot({ ...JAN, cash_amount: 2_000 })
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01', '2026-06-01'])
    expect(appStore.profile.snapshots?.[0].cash_amount).toBe(2_000)
  })

  it('moves a snapshot to a new date', () => {
    appStore.saveSnapshot({ ...JAN, date: '2026-02-01' }, '2026-01-01')
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-02-01', '2026-06-01'])
  })

  it("carries the newest snapshot's figures onto the profile", () => {
    appStore.saveSnapshot({ ...JUN, cash_amount: 12_345 })
    expect(appStore.profile.cash_amount).toBe(12_345)
  })

  it('deletes a snapshot and rewinds the profile when it was the newest', () => {
    appStore.deleteSnapshot('2026-06-01')
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.cash_amount).toBe(1_000)
  })

  it('rewinds onto a snapshot that predates an asset being financed', () => {
    // The house was owned outright when JAN was recorded and financed since.
    // Rewinding restores the state the snapshot records: the debt the profile
    // carries today did not exist on that date, so the asset goes back to being
    // owned outright rather than keeping a balance the baseline never held.
    const house = {
      id: 't1',
      name: 'House',
      value: 300_000,
      status: 'financed' as const,
      outstanding_balance: 120_000,
      installment_frequency: 'monthly' as const,
      annual_rate: 3,
      installment_amount: 900,
      remaining_term: 20,
    }
    appStore.updateProfile({
      tangible_assets: [house],
      snapshots: [
        { ...JAN, tangible_assets: [{ id: 't1', value: 250_000 }] },
        { ...JUN, tangible_assets: [{ id: 't1', value: 300_000, outstanding_balance: 120_000 }] },
      ],
    })
    appStore.deleteSnapshot('2026-06-01')
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.tangible_assets?.[0]).toMatchObject({
      value: 250_000,
      status: 'fully_owned',
      outstanding_balance: undefined,
    })

    // And the profile now matches its newest snapshot again, so an unrelated
    // edit records nothing rather than stamping today onto January's figures.
    const rewound = appStore.profile.snapshots
    appStore.updateProfile({ name: 'Bob' })
    expect(appStore.profile.snapshots).toEqual(rewound)
  })

  it('keeps a cleared history empty across a reload', () => {
    // Legacy data (no snapshot list) is seeded a baseline on load; a history the
    // user emptied on purpose must not come back as a snapshot dated the
    // deletion.
    appStore.deleteSnapshot('2026-01-01')
    appStore.deleteSnapshot('2026-06-01')
    expect(appStore.profile.snapshots).toEqual([])
    appStore.load()
    expect(appStore.profile.snapshots).toEqual([])
    expect(appStore.profile.cash_amount).toBe(9_000)
  })

  it('persists the edited history', () => {
    appStore.saveSnapshot({ ...JAN, cash_amount: 2_000 })
    const stored: unknown = JSON.parse(backing.get(storageKeys.DATA) ?? '{}')
    expect(
      (stored as { profile: { snapshots: { cash_amount: number }[] } }).profile.snapshots[0],
    ).toMatchObject({ cash_amount: 2_000 })
  })
})

describe('appStore saving a snapshot the History dialog produced', () => {
  // What the dialog does end to end: seed a fresh snapshot for a date, build
  // its fields, and confirm without touching one.
  function confirmUntouched(date: string): void {
    const stored = appStore.profile.toJSON()
    const seed = seedSnapshotOn(stored, date)
    appStore.saveSnapshot(
      snapshotFromFields(seed, buildSnapshotSections(stored, seed, date), {}, date),
    )
  }

  const PLANNED: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 10_000,
    investments: [
      { id: 'inv1', name: 'ETF', balance: 20_000, apy: 0 },
      // Bought in 2030: not held today, so nothing about it is today's to state.
      {
        id: 'inv9',
        name: 'Future ETF',
        balance: 50_000,
        apy: 5,
        start: 'at_specific_date',
        start_year: 2030,
        start_month: 1,
      },
    ],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    appStore.updateProfile(PLANNED)
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('leaves a planned holding at its planned amount', () => {
    confirmUntouched(TODAY)
    expect(appStore.profile.investments?.find((i) => i.id === 'inv9')?.balance).toBe(50_000)
  })

  it('records a snapshot the next edit has nothing to add to', () => {
    // The saved snapshot has to be the one `captureSnapshot` would take of the
    // profile it leaves behind, or an unrelated rename reads as a change and
    // stamps a second snapshot on the same day.
    confirmUntouched(TODAY)
    const recorded = appStore.profile.snapshots
    appStore.updateProfile({ name: 'Renamed' })
    expect(appStore.profile.snapshots).toEqual(recorded)
  })
})

describe('appStore re-baselining a loan', () => {
  // 12 monthly installments of 1,000 against 12,000 at 0%: the balance and the
  // term come off together, one for one. Recorded on 2026-01-15 and read on
  // 2026-06-15 — 151 days, four whole installments.
  const LOAN_PROFILE: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 5_000,
    liabilities: [
      {
        id: 'l1',
        name: 'Car loan',
        outstanding_balance: 12_000,
        installment_frequency: 'monthly',
        annual_rate: 0,
        installment_amount: 1_000,
        remaining_term: 12,
        remaining_term_unit: 'months',
      },
    ],
    snapshots: [
      {
        date: '2026-01-15',
        cash_amount: 5_000,
        investments: [],
        tangible_assets: [],
        liabilities: [{ id: 'l1', outstanding_balance: 12_000, remaining_term: 12 }],
        incomes: [],
        expenses: [],
      },
    ],
  }

  const loan = () => appStore.profile.liabilities?.[0]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    appStore.updateProfile(LOAN_PROFILE)
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('shortens the term with the balance when Quick update confirms today', () => {
    appStore.confirmBalances({ cash_amount: 5_000 })
    expect(loan()?.outstanding_balance).toBe(8_000)
    expect(loan()?.remaining_term).toBe(8)
  })

  it('shortens it the same way when the History page saves a snapshot for today', () => {
    // 'manage' mode bypasses the carry-forward, so the term has to travel in
    // the snapshot itself. Leaving it at 12 against a balance of 8,000 would
    // restart the loan's clock on every snapshot the user records.
    const stored = appStore.profile.toJSON()
    const seed = seedSnapshotOn(stored, TODAY)
    appStore.saveSnapshot(
      snapshotFromFields(seed, buildSnapshotSections(stored, seed, TODAY), {}, TODAY),
    )
    expect(loan()?.outstanding_balance).toBe(8_000)
    expect(loan()?.remaining_term).toBe(8)
  })

  it('puts the term back with the balance when the newest snapshot is deleted', () => {
    // The inverse: rewinding to January restores 12,000 outstanding, so it has
    // to restore the twelve installments that pay it off — a rewound balance
    // against a shortened term would end the loan on a balloon payment.
    appStore.confirmBalances({ cash_amount: 5_000 })
    appStore.deleteSnapshot(TODAY)
    expect(loan()?.outstanding_balance).toBe(12_000)
    expect(loan()?.remaining_term).toBe(12)
  })
})
