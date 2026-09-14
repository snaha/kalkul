import { init } from 'svelte-i18n'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getYearlyPlanProjection } from '$lib/plan-projection'
import type { Portfolio, Profile } from '$lib/schemas'
import { buildSnapshotSections, seedSnapshotOn, snapshotFromFields } from '$lib/snapshot-form'
import storageKeys from '$lib/storage-keys'
import { toDateOnlyString } from '$lib/utils'

import { appStore } from './app.svelte'

// The schema's conditional-requirement messages are translations, and one is
// formatted the moment a check fails.
init({ fallbackLocale: 'en', initialLocale: 'en' })

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
        schedule: 'recurring',
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
        schedule: 'recurring',
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
        incomes: [{ id: 'i1', amount: 5_000, frequency: 'monthly' }],
        expenses: [{ id: 'e1', amount: 3_000, frequency: 'monthly' }],
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
      // The term comes off with the balance: five installments paid, so 2.58
      // of the loan's three years are left.
      liabilities: [{ id: 'l1', outstanding_balance: 5_118, remaining_term: 2.58 }],
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

    expect(appStore.profile.liabilities?.[0].outstanding_balance).toBe(5_118)
    expect(appStore.profile.liabilities?.[0].remaining_term).toBe(2.58)
  })

  it('leaves the baseline alone when only a cash flow changed', () => {
    // A new expense moves no balance, so there is nothing to re-date: recording
    // one would replace the untouched balances with their projections, stamp
    // today onto them and clear a staleness banner the user never confirmed
    // away. The flows are still captured into whatever snapshot is recorded
    // next.
    appStore.updateProfile({
      expenses: [
        ...(STALE_PROFILE.expenses ?? []),
        {
          id: 'e2',
          name: 'Gym',
          amount: 500,
          frequency: 'monthly',
          start: 'immediately',
          end: 'never',
          change_over_time: 'none',
        },
      ],
    })

    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.cash_amount).toBe(15_000)
    expect(appStore.profile.investments?.[0].balance).toBe(100_000)
  })

  it('leaves the baseline alone when a salary is restated', () => {
    appStore.updateProfile({
      incomes: [{ ...(STALE_PROFILE.incomes ?? [])[0], amount: 6_000 }],
    })

    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.cash_amount).toBe(15_000)
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

describe('appStore.deletePortfolio plan-owned items', () => {
  it('removes every kind of item the plan owns and keeps the shared ones', () => {
    const owned = { plan_id: 'plan-1' }
    const flow = {
      name: 'Flow',
      amount: 100,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    }
    const loan = {
      name: 'Loan',
      outstanding_balance: 100,
      installment_frequency: 'monthly',
      annual_rate: 1,
      installment_amount: 1,
      remaining_term: 10,
    }
    appStore.importBackup(
      JSON.stringify({
        profile: {
          name: 'Jane',
          email: '',
          investments: [
            { id: 'shared', name: 'ETF', balance: 0, apy: 0 },
            { id: 'owned', name: 'ETF', balance: 0, apy: 0, ...owned },
          ],
          tangible_assets: [
            { id: 'shared', name: 'Flat', value: 1, status: 'fully_owned' },
            { id: 'owned', name: 'Flat', value: 1, status: 'fully_owned', ...owned },
          ],
          liabilities: [
            { ...loan, id: 'shared' },
            { ...loan, id: 'owned', ...owned },
          ],
          incomes: [
            { ...flow, id: 'shared' },
            { ...flow, id: 'owned', ...owned },
          ],
          expenses: [
            { ...flow, id: 'shared' },
            { ...flow, id: 'owned', ...owned },
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
    const ids = (items: { id: string }[] | undefined) => items?.map((i) => i.id)
    expect(ids(appStore.profile.investments)).toEqual(['shared'])
    expect(ids(appStore.profile.tangible_assets)).toEqual(['shared'])
    expect(ids(appStore.profile.liabilities)).toEqual(['shared'])
    expect(ids(appStore.profile.incomes)).toEqual(['shared'])
    expect(ids(appStore.profile.expenses)).toEqual(['shared'])
  })

  it('leaves the profile untouched when the plan owns nothing', () => {
    appStore.importBackup(
      JSON.stringify({
        profile: {
          name: 'Jane',
          email: '',
          investments: [{ id: 'shared', name: 'ETF', balance: 0, apy: 0 }],
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
    const before = appStore.profile
    appStore.portfolios[0].delete()
    expect(appStore.portfolios).toEqual([])
    expect(appStore.profile).toBe(before)
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

  it('rewinds onto a snapshot that predates an asset being paid off', () => {
    // The mirror case: financed when JAN was recorded, paid off since and
    // marked fully owned, which clears every financing field. Rewinding has to
    // restore the debt the snapshot records and still hand the schema a valid
    // financed asset, or the delete is rejected and silently does nothing.
    appStore.updateProfile({
      tangible_assets: [{ id: 't1', name: 'House', value: 300_000, status: 'fully_owned' }],
      snapshots: [
        { ...JAN, tangible_assets: [{ id: 't1', value: 250_000, outstanding_balance: 120_000 }] },
        { ...JUN, tangible_assets: [{ id: 't1', value: 300_000 }] },
      ],
    })
    appStore.deleteSnapshot('2026-06-01')
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01'])
    expect(appStore.profile.tangible_assets?.[0]).toMatchObject({
      value: 250_000,
      status: 'financed',
      outstanding_balance: 120_000,
    })
  })

  it('leaves the history empty when nothing is held today', () => {
    // A position that only starts in 2030 is data, but not a balance to
    // project from — recording an all-zero row for today would say otherwise.
    appStore.updateProfile({
      cash_amount: 0,
      investments: [
        {
          id: 'inv9',
          name: 'Planned',
          balance: 50_000,
          apy: 5,
          start: 'at_specific_date',
          start_year: 2030,
          start_month: 1,
        },
      ],
    })
    appStore.deleteSnapshot('2026-01-01')
    appStore.deleteSnapshot('2026-06-01')
    appStore.deleteSnapshot(TODAY)
    expect(appStore.profile.snapshots).toEqual([])
  })

  it('re-baselines onto today when the last snapshot is deleted', () => {
    // A profile holding balances with no baseline has nothing to project from:
    // no staleness banner, no projection, and the next unrelated edit stamps
    // today onto months-old figures. Deleting the last snapshot therefore
    // carries its figures forward to today and records them there — the user
    // sees exactly that as a row dated today, which they can edit or delete.
    appStore.deleteSnapshot('2026-01-01')
    appStore.deleteSnapshot('2026-06-01')

    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual([TODAY])
    expect(appStore.profile.cash_amount).toBe(9_000)
  })

  it('keeps that baseline across a reload and records nothing on the next edit', () => {
    appStore.deleteSnapshot('2026-01-01')
    appStore.deleteSnapshot('2026-06-01')
    const recorded = appStore.profile.snapshots

    appStore.load()
    expect(appStore.profile.snapshots).toEqual(recorded)

    appStore.updateProfile({ name: 'Renamed' })
    expect(appStore.profile.snapshots).toEqual(recorded)
  })

  it('leaves an empty history empty for a profile with no balances', () => {
    appStore.updateProfile({ cash_amount: 0 })
    appStore.deleteSnapshot('2026-01-01')
    appStore.deleteSnapshot('2026-06-01')
    appStore.deleteSnapshot(TODAY)
    expect(appStore.profile.snapshots).toEqual([])
  })

  it('persists the edited history', () => {
    appStore.saveSnapshot({ ...JAN, cash_amount: 2_000 })
    const stored: unknown = JSON.parse(backing.get(storageKeys.DATA) ?? '{}')
    expect(
      (stored as { profile: { snapshots: { cash_amount: number }[] } }).profile.snapshots[0],
    ).toMatchObject({ cash_amount: 2_000 })
  })

  describe('with a holding opened between the two snapshots', () => {
    // Gold has no timing, so it counts as held on every date — January's
    // included — but only June recorded it.
    const GOLD = { id: 'gold', name: 'Gold', balance: 5_000, apy: 0 }

    beforeEach(() => {
      appStore.updateProfile({
        investments: [GOLD],
        snapshots: [JAN, { ...JUN, investments: [{ id: 'gold', balance: 5_000 }] }],
      })
    })

    it('records nothing on an unrelated edit after rewinding onto January', () => {
      // Deleting June keeps Gold on the profile. Unless January records it too,
      // the profile holds more than the baseline it projects from and a rename
      // reads as a balance moving: it stamps today onto January's figures and
      // clears a staleness banner the user never confirmed away.
      appStore.deleteSnapshot('2026-06-01')
      expect(appStore.profile.investments).toEqual([GOLD])

      const rewound = appStore.profile.snapshots
      appStore.updateProfile({ name: 'Renamed' })
      expect(appStore.profile.snapshots).toEqual(rewound)
    })

    it('keeps Gold when January is duplicated onto today and confirmed untouched', () => {
      // Duplicate opens dated today, so the copy becomes the newest snapshot
      // and the profile is re-baselined onto it. January never recorded Gold;
      // its field has to open at what Gold is worth today, not at zero.
      const stored = appStore.profile.toJSON()
      const copy = { ...JAN, date: TODAY }
      appStore.saveSnapshot(
        snapshotFromFields(copy, buildSnapshotSections(stored, copy, TODAY), {}, TODAY),
      )
      expect(appStore.profile.investments?.[0].balance).toBe(5_000)
    })
  })
})

describe('appStore keeping a loan term changed since the newest snapshot', () => {
  // Refinancing a mortgage, correcting its term or restating it in months moves
  // no balance, so it records no snapshot — and the newest one goes on stating
  // the old term. Every History-page save re-baselines the profile onto that
  // snapshot, so none of them may put the old term back.
  const MORTGAGE = {
    id: 'l1',
    name: 'Mortgage',
    outstanding_balance: 200_000,
    installment_frequency: 'monthly' as const,
    annual_rate: 4,
    installment_amount: 1_100,
    remaining_term: 25,
    remaining_term_unit: 'years' as const,
  }
  const JAN = {
    date: '2026-01-01',
    cash_amount: 4_000,
    investments: [],
    tangible_assets: [],
    liabilities: [],
    incomes: [],
    expenses: [],
  }

  /** What the History dialog confirms after the user retypes one cash figure. */
  function editCash(date: string, cash: number): void {
    const stored = appStore.profile.toJSON()
    const snapshot = stored.snapshots?.find((s) => s.date === date)
    if (!snapshot) throw new Error(`No snapshot dated ${date}`)
    appStore.saveSnapshot(
      snapshotFromFields(snapshot, buildSnapshotSections(stored, snapshot, date), { cash }, date),
    )
  }

  const loan = () => appStore.profile.liabilities?.[0]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    // Records today's snapshot beside January's, the mortgage at 25 years.
    appStore.updateProfile({
      name: 'Alice',
      cash_amount: 5_000,
      liabilities: [MORTGAGE],
      snapshots: [JAN],
    })
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps a refinanced term through a save of the newest snapshot', () => {
    appStore.updateProfile({ liabilities: [{ ...MORTGAGE, remaining_term: 20 }] })
    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual(['2026-01-01', TODAY])

    editCash(TODAY, 6_000)
    expect(loan()?.remaining_term).toBe(20)
  })

  it('keeps it through a save of an older snapshot', () => {
    appStore.updateProfile({ liabilities: [{ ...MORTGAGE, remaining_term: 20 }] })
    editCash('2026-01-01', 4_500)
    expect(loan()?.remaining_term).toBe(20)
  })

  it('keeps a term restated in months', () => {
    // Left as it was, the snapshot's 25 would be read in the new unit: a
    // 25-year mortgage turned into a 25-month one.
    appStore.updateProfile({
      liabilities: [{ ...MORTGAGE, remaining_term: 300, remaining_term_unit: 'months' }],
    })
    editCash(TODAY, 6_000)
    expect(loan()).toMatchObject({ remaining_term: 300, remaining_term_unit: 'months' })
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

describe('appStore saving a snapshot dated past a planned sale', () => {
  // The ETF is held through March 2026 and sold in April: after January's
  // snapshot, before today. Nothing grows or accrues, so the sale is the only
  // thing that moves.
  const PROFILE: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 10_000,
    investments: [
      {
        id: 'etf',
        name: 'ETF',
        balance: 5_000,
        apy: 0,
        exit: 'at_specific_date',
        exit_year: 2026,
        exit_month: 3,
      },
    ],
    snapshots: [
      {
        date: '2026-01-01',
        cash_amount: 10_000,
        investments: [{ id: 'etf', balance: 5_000 }],
        tangible_assets: [],
        liabilities: [],
        incomes: [],
        expenses: [],
      },
    ],
  }
  const PLAN: Portfolio = {
    id: 'plan-1',
    name: 'Plan',
    start_date: TODAY,
    end_date: '2036-06-15',
    inflation_rate: 0,
  }

  /** What the History dialog confirms for a fresh snapshot nobody typed into. */
  function addUntouched(date: string): void {
    const stored = appStore.profile.toJSON()
    const seed = seedSnapshotOn(stored, date)
    appStore.saveSnapshot(
      snapshotFromFields(seed, buildSnapshotSections(stored, seed, date), {}, date),
    )
  }

  const etf = () => appStore.profile.investments?.[0]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    // Restored as given: saving it through updateProfile would record today's
    // snapshot before the test gets to.
    appStore.importBackup(JSON.stringify({ profile: PROFILE, portfolios: [] }))
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('empties the sold position, so the plan does not sell it a second time', () => {
    // The seeded cash already holds the sale's proceeds. Left at 5,000, the ETF
    // would be sold again in the plan's first year and the same money counted
    // twice — Quick update's Confirm empties it, and saving the same figures
    // from the History page has to as well.
    addUntouched(TODAY)
    expect(appStore.profile.cash_amount).toBe(15_000)
    expect(etf()?.balance).toBe(0)
    expect(getYearlyPlanProjection(PLAN, appStore.profile.toJSON())[0].netWorth).toBe(15_000)
  })

  it('puts the position back when that snapshot is deleted again', () => {
    // Rewinding onto January restores what January recorded, sale undone.
    addUntouched(TODAY)
    appStore.deleteSnapshot(TODAY)
    expect(appStore.profile.cash_amount).toBe(10_000)
    expect(etf()?.balance).toBe(5_000)
  })
})

describe('appStore deleting the only snapshot of a growing profile', () => {
  // 3,000 a month arriving since 2026-01-15, read on 2026-06-15: 151 days.
  const PROFILE: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 10_000,
    incomes: [
      {
        id: 'i1',
        name: 'Salary',
        amount: 3_000,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ],
    snapshots: [
      {
        date: '2026-01-15',
        cash_amount: 10_000,
        investments: [],
        tangible_assets: [],
        liabilities: [],
        incomes: [{ id: 'i1', amount: 3_000, frequency: 'monthly' }],
        expenses: [],
      },
    ],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubLocalStorage()
    appStore.clear()
    appStore.updateProfile(PROFILE)
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("records today's figures rather than the deleted snapshot's", () => {
    appStore.deleteSnapshot('2026-01-15')

    expect(appStore.profile.snapshots?.map((s) => s.date)).toEqual([TODAY])
    // Five months of salary arrived while the deleted baseline stood; stamping
    // January's 10,000 with today's date would give that money back.
    expect(appStore.profile.cash_amount).toBe(24_883)
    expect(appStore.profile.snapshots?.[0].cash_amount).toBe(24_883)
  })
})
