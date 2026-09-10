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
      { key: 'liabilities:l1', itemId: 'l1', label: 'Card', kind: 'debt', value: 5_000 },
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

  test('seeds a cash flow from the profile when the snapshot never recorded any', () => {
    // Legacy snapshots carry no cash flows at all. Opening one at zero would
    // invite the user to confirm an income they never earned nothing of.
    const legacy: Snapshot = { ...SOURCE, incomes: undefined }
    expect(
      fieldsOf(buildSnapshotSections(PROFILE, legacy, '2026-06-01'), 'incomes')[0],
    ).toMatchObject({
      value: 4_000,
      frequency: 'monthly',
    })
  })

  test('still seeds an item at zero when the snapshot recorded the others', () => {
    const partial: Snapshot = { ...SOURCE, incomes: [] }
    expect(
      fieldsOf(buildSnapshotSections(PROFILE, partial, '2026-06-01'), 'incomes')[0],
    ).toMatchObject({
      value: 0,
    })
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

  test('still offers a field at zero for an item held on the date but never recorded', () => {
    const withNewItem: Profile = {
      ...PROFILE,
      investments: [
        ...(PROFILE.investments ?? []),
        { id: 'inv2', name: 'Gold', balance: 9, apy: 1 },
      ],
    }
    expect(
      fieldsOf(buildSnapshotSections(withNewItem, SOURCE, '2026-06-01'), 'investments')[1],
    ).toMatchObject({ label: 'Gold', value: 0 })
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
