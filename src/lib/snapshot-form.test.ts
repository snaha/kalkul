import { describe, expect, test } from 'vitest'

import { getCurrentProfile } from '$lib/current-values'
import type { Profile, Snapshot } from '$lib/schemas'
import { captureSnapshot } from '$lib/snapshots'
import { parseDateOnly } from '$lib/utils'

import {
  buildSnapshotSections,
  openingDate,
  seedSnapshotOn,
  snapshotFromFields,
} from './snapshot-form'

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 20_000,
  investments: [{ id: 'inv1', name: 'ETF', balance: 80_000, apy: 5 }],
  tangible_assets: [
    { id: 't1', name: 'Car', value: 10_000, status: 'fully_owned' },
    {
      id: 't2',
      name: 'House',
      value: 200_000,
      status: 'financed',
      outstanding_balance: 100_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 1_000,
      remaining_term: 20,
    },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Card',
      outstanding_balance: 5_000,
      installment_frequency: 'monthly',
      annual_rate: 15,
      installment_amount: 250,
      remaining_term: 2,
    },
  ],
  incomes: [
    {
      id: 'i1',
      name: 'Salary',
      amount: 4_000,
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
      amount: 1_000,
      schedule: 'recurring',
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
}

const SOURCE = captureSnapshot(PROFILE, '2026-06-01')

const fieldsOf = (sections: ReturnType<typeof buildSnapshotSections>, id: string) =>
  sections.find((section) => section.id === id)?.fields ?? []

describe('buildSnapshotSections', () => {
  const sections = buildSnapshotSections(PROFILE, SOURCE, '2026-06-01')

  test('lays the sections out in the order the design draws them', () => {
    expect(sections.map((s) => s.id)).toEqual([
      'cash',
      'investments',
      'tangible_assets',
      'liabilities',
      'incomes',
      'expenses',
    ])
  })

  test('seeds each field from the snapshot', () => {
    expect(fieldsOf(sections, 'cash')).toEqual([
      { key: 'cash', itemId: 'cash', label: '', kind: 'cash', value: 20_000 },
    ])
    expect(fieldsOf(sections, 'investments')).toEqual([
      { key: 'investments:inv1', itemId: 'inv1', label: 'ETF', kind: 'balance', value: 80_000 },
    ])
    expect(fieldsOf(sections, 'liabilities')).toEqual([
      {
        key: 'liabilities:l1',
        itemId: 'l1',
        label: 'Card',
        kind: 'debt',
        // Carried through for the write-back, the way a cash flow's frequency is.
        remaining_term: 2,
        value: 5_000,
      },
    ])
  })

  test('gives a financed asset both a value and a debt field', () => {
    expect(fieldsOf(sections, 'tangible_assets')).toEqual([
      { key: 'tangible_assets:t1', itemId: 't1', label: 'Car', kind: 'value', value: 10_000 },
      { key: 'tangible_assets:t2', itemId: 't2', label: 'House', kind: 'value', value: 200_000 },
      {
        key: 'tangible_assets:t2:debt',
        itemId: 't2',
        label: 'House',
        kind: 'debt',
        remaining_term: 20,
        value: 100_000,
      },
    ])
  })

  test('keeps the debt field for an asset paid off since the snapshot', () => {
    const paidOff: Profile = {
      ...PROFILE,
      tangible_assets: [{ id: 't2', name: 'House', value: 200_000, status: 'fully_owned' }],
    }
    // The recorded debt is still the user's to correct — hiding the field
    // would drop it silently the next time they confirm.
    expect(
      fieldsOf(buildSnapshotSections(paidOff, SOURCE, '2026-06-01'), 'tangible_assets'),
    ).toHaveLength(2)
  })

  test('carries the frequency of a cash flow through untouched', () => {
    expect(fieldsOf(sections, 'incomes')[0]).toMatchObject({
      label: 'Salary',
      value: 4_000,
      frequency: 'monthly',
    })
  })

  test('opens a cash flow the snapshot has no entry for at zero', () => {
    // One meaning for an omission everywhere: nothing recorded. Snapshots
    // stored before cash flows were recorded are filled in from the profile at
    // the load boundary (`repairStoredData`), so they never reach the dialog
    // empty. The frequency still comes from the profile — a field opening at
    // zero has to carry some cadence in its suffix.
    //
    // This holds on the newest snapshot's own date too, where the estimate runs
    // on the profile's flows: a salary entered since records nothing, and an
    // untouched Confirm must not write it onto a day it was not recorded for.
    const partial: Snapshot = { ...SOURCE, incomes: [] }
    const history: Profile = { ...PROFILE, snapshots: [partial] }
    expect(
      fieldsOf(buildSnapshotSections(history, partial, '2026-06-01'), 'incomes')[0],
    ).toMatchObject({ value: 0, frequency: 'monthly' })
  })

  test('offers no field for a holding the profile does not have on the date', () => {
    // The dialog writes every field it offers back into the snapshot, and the
    // newest snapshot is overlaid onto the profile. A field for a position that
    // starts in 2030 would therefore let an untouched Confirm zero it — a
    // planned holding must never be confirmable away.
    const planned: Profile = {
      ...PROFILE,
      investments: [
        ...(PROFILE.investments ?? []),
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
    const source = captureSnapshot(planned, '2026-06-01')
    const sections = buildSnapshotSections(planned, source, '2026-06-01')
    expect(fieldsOf(sections, 'investments').map((f) => f.itemId)).toEqual(['inv1'])
  })

  test('offers no field for an asset the profile has not bought on the date', () => {
    const planned: Profile = {
      ...PROFILE,
      tangible_assets: [
        {
          ...(PROFILE.tangible_assets ?? [])[1],
          purchase: 'at_specific_date',
          purchase_year: 2030,
          purchase_month: 1,
        },
      ],
    }
    const source = captureSnapshot(planned, '2026-06-01')
    expect(
      fieldsOf(buildSnapshotSections(planned, source, '2026-06-01'), 'tangible_assets'),
    ).toEqual([])
  })

  test('offers no field for an item a plan owns or a one-time cash flow', () => {
    // A snapshot records neither — a plan's items are not the user's current
    // data, and a one-time expense is an event rather than a rate — so a field
    // for one would write into the snapshot what capturing it leaves out.
    const owned = { plan_id: 'plan-1' }
    const withExtras: Profile = {
      ...PROFILE,
      investments: [
        ...PROFILE.investments!,
        { id: 'inv9', name: 'Plan ETF', balance: 1, apy: 0, ...owned },
      ],
      liabilities: [...PROFILE.liabilities!, { ...PROFILE.liabilities![0], id: 'l9', ...owned }],
      incomes: [...PROFILE.incomes!, { ...PROFILE.incomes![0], id: 'i9', ...owned }],
      expenses: [
        ...PROFILE.expenses!,
        {
          id: 'trip',
          name: 'Trip',
          amount: 3_000,
          schedule: 'one_time',
          transaction_year: 2026,
          transaction_month: 8,
        },
      ],
    }
    const sections = buildSnapshotSections(
      withExtras,
      captureSnapshot(withExtras, '2026-06-01'),
      '2026-06-01',
    )
    const ids = (id: string) => fieldsOf(sections, id).map((field) => field.itemId)
    expect(ids('investments')).toEqual(['inv1'])
    expect(ids('liabilities')).toEqual(['l1'])
    expect(ids('incomes')).toEqual(['i1'])
    expect(ids('expenses')).toEqual(['e1'])
  })

  test('still offers a field for an item held on the date but never recorded', () => {
    // SOURCE predates Gold. With no history to say otherwise, the app's
    // estimate for the date is the profile's own figure.
    const withNewItem: Profile = {
      ...PROFILE,
      investments: [
        ...(PROFILE.investments ?? []),
        { id: 'inv2', name: 'Gold', balance: 9, apy: 1 },
      ],
    }
    expect(
      fieldsOf(buildSnapshotSections(withNewItem, SOURCE, '2026-06-01'), 'investments')[1],
    ).toMatchObject({ label: 'Gold', value: 9 })
  })

  test('leaves out a section the profile has no items for', () => {
    const bare: Profile = { name: '', email: '', cash_amount: 1 }
    const bareSections = buildSnapshotSections(
      bare,
      { date: '2026-06-01', cash_amount: 1 },
      '2026-06-01',
    )
    expect(fieldsOf(bareSections, 'investments')).toEqual([])
  })
})

describe('snapshotFromFields', () => {
  const sections = buildSnapshotSections(PROFILE, SOURCE, '2026-06-01')

  test('records the unedited values under the new date', () => {
    expect(snapshotFromFields(SOURCE, sections, {}, '2026-07-01')).toEqual({
      ...SOURCE,
      date: '2026-07-01',
    })
  })

  test('takes an edited value over the seeded one', () => {
    const result = snapshotFromFields(
      SOURCE,
      sections,
      { cash: 33, 'investments:inv1': 44 },
      '2026-06-01',
    )
    expect(result.cash_amount).toBe(33)
    expect(result.investments).toEqual([{ id: 'inv1', balance: 44 }])
  })

  test('writes a financed asset back as a value and a debt', () => {
    const result = snapshotFromFields(
      SOURCE,
      sections,
      { 'tangible_assets:t2': 1, 'tangible_assets:t2:debt': 2 },
      '2026-06-01',
    )
    expect(result.tangible_assets).toContainEqual({
      id: 't2',
      value: 1,
      outstanding_balance: 2,
      // The dialog draws no term control, so the recorded one rides along.
      remaining_term: 20,
    })
  })

  test('leaves a fully owned asset without a debt', () => {
    const result = snapshotFromFields(SOURCE, sections, {}, '2026-06-01')
    expect(result.tangible_assets?.[0]).toEqual({
      id: 't1',
      value: 10_000,
      outstanding_balance: undefined,
    })
  })

  test('falls back to the seeded value when a field is cleared', () => {
    // An empty box means "I have not said", exactly as in Quick update —
    // confirming a zero is still possible by typing 0.
    const result = snapshotFromFields(SOURCE, sections, { cash: undefined }, '2026-06-01')
    expect(result.cash_amount).toBe(20_000)
  })

  test('keeps a recorded entry the profile no longer has an item for', () => {
    const withGhost: Snapshot = {
      ...SOURCE,
      investments: [...(SOURCE.investments ?? []), { id: 'gone', balance: 7 }],
    }
    const result = snapshotFromFields(
      withGhost,
      buildSnapshotSections(PROFILE, withGhost, '2026-06-01'),
      {},
      'x',
    )
    expect(result.investments).toContainEqual({ id: 'gone', balance: 7 })
  })

  test('writes the edited amount and the carried frequency for a cash flow', () => {
    const result = snapshotFromFields(SOURCE, sections, { 'incomes:i1': 5_000 }, '2026-06-01')
    expect(result.incomes).toEqual([{ id: 'i1', amount: 5_000, frequency: 'monthly' }])
  })
})

describe('seedSnapshotOn', () => {
  // Nothing accrues or compounds, so carrying a snapshot forward changes no
  // figure and the seed can be compared exactly.
  const STATIC: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 9_000,
    investments: [
      { id: 'inv1', name: 'ETF', balance: 80_000, apy: 0 },
      { id: 'inv2', name: 'Gold', balance: 500, apy: 0 },
    ],
  }
  const JAN: Snapshot = {
    date: '2026-01-01',
    cash_amount: 1_000,
    investments: [{ id: 'inv1', balance: 50_000 }],
  }
  const JUN = captureSnapshot(STATIC, '2026-06-01')
  const HISTORY: Profile = { ...STATIC, snapshots: [JAN, JUN] }

  test('opens a date between two snapshots at the earlier one carried forward', () => {
    expect(seedSnapshotOn(HISTORY, '2026-03-01')).toEqual({
      ...JAN,
      date: '2026-03-01',
      tangible_assets: [],
      liabilities: [],
      incomes: [],
      expenses: [],
    })
  })

  test('leaves out an item the earlier snapshot never recorded', () => {
    // Gold was opened after January, so on a March date it opens at zero
    // rather than at today's balance.
    expect(seedSnapshotOn(HISTORY, '2026-03-01').investments?.map((i) => i.id)).toEqual(['inv1'])
  })

  test('opens a date before the first snapshot at that snapshot', () => {
    expect(seedSnapshotOn(HISTORY, '2025-06-01').cash_amount).toBe(1_000)
  })

  test('opens a date after the latest snapshot at the projection to that date', () => {
    // The same model the dashboard carries the latest snapshot to today with.
    const history: Profile = { ...PROFILE, snapshots: [SOURCE] }
    const seed = seedSnapshotOn(history, '2026-09-01')
    expect(seed).toEqual(
      captureSnapshot(getCurrentProfile(history, parseDateOnly('2026-09-01')), '2026-09-01'),
    )
    expect(seed.cash_amount).toBeGreaterThan(20_000)
  })

  test('opens a profile with no history at its own figures', () => {
    expect(seedSnapshotOn(STATIC, '2026-03-01')).toEqual(captureSnapshot(STATIC, '2026-03-01'))
  })

  test('opens a date after the latest snapshot with the cash flows running now', () => {
    // A raise entered since the latest snapshot records nothing, so that
    // snapshot still says 4,000. The seed is an estimate of today, and today's
    // estimate — the dashboard's — runs on the profile's own flows.
    const raised: Profile = {
      ...PROFILE,
      incomes: [{ ...PROFILE.incomes![0], amount: 5_000 }],
      snapshots: [SOURCE],
    }
    const seed = seedSnapshotOn(raised, '2026-09-01')
    expect(seed.incomes).toEqual([{ id: 'i1', amount: 5_000, frequency: 'monthly' }])
    expect(seed).toEqual(
      captureSnapshot(getCurrentProfile(raised, parseDateOnly('2026-09-01')), '2026-09-01'),
    )
  })
})

describe('buildSnapshotSections on a date the snapshot does not record', () => {
  // Nothing accrues, compounds or amortizes except the loan below, so the
  // estimates can be compared exactly.
  const GOLD = { id: 'inv2', name: 'Gold', balance: 500, apy: 0 }
  const STATIC: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 9_000,
    investments: [{ id: 'inv1', name: 'ETF', balance: 80_000, apy: 0 }, GOLD],
  }
  // January predates Gold; June records it.
  const JAN: Snapshot = {
    date: '2026-01-01',
    cash_amount: 1_000,
    investments: [{ id: 'inv1', balance: 50_000 }],
  }
  const HISTORY: Profile = { ...STATIC, snapshots: [JAN, captureSnapshot(STATIC, '2026-06-01')] }

  test('opens an item the snapshot never recorded at the estimate for the date', () => {
    // A copy of January dated after June — a Duplicate, or January re-dated.
    // Gold exists by then, and saving the copy re-baselines the profile onto
    // it, so a field opening at zero would wipe Gold on an untouched Confirm.
    const copy: Snapshot = { ...JAN, date: '2026-07-01' }
    expect(fieldsOf(buildSnapshotSections(HISTORY, copy, '2026-07-01'), 'investments')).toEqual([
      { key: 'investments:inv1', itemId: 'inv1', label: 'ETF', kind: 'balance', value: 50_000 },
      { key: 'investments:inv2', itemId: 'inv2', label: 'Gold', kind: 'balance', value: 500 },
    ])
  })

  test('still opens it at zero on a date before it was ever recorded', () => {
    // Editing January on its own date: as far as the history knows, Gold did
    // not exist yet, and an untouched Confirm must not change the row.
    expect(
      fieldsOf(buildSnapshotSections(HISTORY, JAN, '2026-01-01'), 'investments')[1],
    ).toMatchObject({ label: 'Gold', value: 0 })
  })

  test('opens a cash flow a copy never recorded at the one running on its new date', () => {
    const history: Profile = {
      ...PROFILE,
      snapshots: [JAN, captureSnapshot(PROFILE, '2026-06-01')],
    }
    const copy: Snapshot = { ...JAN, date: '2026-07-01' }
    expect(
      fieldsOf(buildSnapshotSections(history, copy, '2026-07-01'), 'incomes')[0],
    ).toMatchObject({ label: 'Salary', value: 4_000 })
  })

  test('records an estimated debt with the term it was estimated at', () => {
    // PROFILE's card and mortgage are unknown to January but running by
    // September. Their fields open at the carried-forward balances, and each
    // has to be written back with the term carried forward beside it —
    // restoring that balance against the original term would restart the
    // loan's clock.
    const history: Profile = {
      ...PROFILE,
      snapshots: [JAN, captureSnapshot(PROFILE, '2026-06-01')],
    }
    const copy: Snapshot = { ...JAN, date: '2026-09-01' }
    const saved = snapshotFromFields(
      copy,
      buildSnapshotSections(history, copy, '2026-09-01'),
      {},
      '2026-09-01',
    )
    const estimate = seedSnapshotOn(history, '2026-09-01')
    expect(saved.liabilities).toEqual(estimate.liabilities)
    expect(saved.tangible_assets).toEqual(estimate.tangible_assets)
    expect(estimate.liabilities?.[0].remaining_term).toBeLessThan(2)
  })
})

describe('openingDate', () => {
  test('keeps a free date', () => {
    expect(openingDate('2026-09-07', ['2026-08-01'])).toBe('2026-09-07')
  })

  test('opens blank rather than on an error when the date is already taken', () => {
    expect(openingDate('2026-09-07', ['2026-09-07'])).toBe('')
  })

  test("keeps the snapshot's own date when editing it", () => {
    expect(openingDate('2026-08-01', ['2026-08-01'], '2026-08-01')).toBe('2026-08-01')
  })
})
