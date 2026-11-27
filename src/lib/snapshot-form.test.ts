import { describe, expect, test } from 'vitest'

import { getCurrentProfile } from '$lib/current-values'
import type { Profile, Snapshot } from '$lib/schemas'
import { captureSnapshot, resolveSnapshots, withSavedSnapshot } from '$lib/snapshots'
import { parseDateOnly } from '$lib/utils'

import {
  buildSnapshotSections,
  editEstimateDate,
  openingDate,
  seedSnapshotOn,
  snapshotFromFields,
  snapshotWithEdits,
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
      { key: 'cash', itemId: 'cash', label: '', kind: 'cash', value: 20_000, unknown: false },
    ])
    expect(fieldsOf(sections, 'investments')).toEqual([
      {
        key: 'investments:inv1',
        itemId: 'inv1',
        label: 'ETF',
        kind: 'balance',
        value: 80_000,
        unknown: false,
      },
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
    // One meaning for an omission everywhere: nothing recorded. The frequency
    // still comes from the profile — a field opening at zero has to carry some
    // cadence in its suffix.
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

  test('offers no field for a one-time cash flow', () => {
    // A snapshot does not record one — a one-time expense is an event rather
    // than a rate — so a field for it would write into the snapshot what
    // capturing it leaves out.
    const withExtras: Profile = {
      ...PROFILE,
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

  describe('on a snapshot whose cash flows were never recorded', () => {
    const { incomes: _incomes, expenses: _expenses, ...unrecorded } = SOURCE
    const history: Profile = { ...PROFILE, snapshots: [unrecorded] }
    const ownDate = buildSnapshotSections(history, unrecorded, '2026-06-01')

    test('keeps them unrecorded when only another section is edited', () => {
      // Their fields open at zero, and saving those zeros would turn the
      // History row's dash back into a financial independence figure measured
      // against the loan payments alone.
      const result = snapshotFromFields(unrecorded, ownDate, { cash: 25_000 }, '2026-06-01')
      expect(result.cash_amount).toBe(25_000)
      expect(result.incomes).toBeUndefined()
      expect(result.expenses).toBeUndefined()
    })

    test('records a section once one of its fields is typed', () => {
      const result = snapshotFromFields(unrecorded, ownDate, { 'expenses:e1': 1_200 }, '2026-06-01')
      expect(result.expenses).toEqual([{ id: 'e1', amount: 1_200, frequency: 'monthly' }])
      expect(result.incomes).toBeUndefined()
    })

    test('records the flows a copy past the newest snapshot opened at', () => {
      // There the fields open at the flows running on the new date, which the
      // dialog showed and the user confirmed.
      const copy = buildSnapshotSections(history, unrecorded, '2026-09-01')
      const result = snapshotFromFields(unrecorded, copy, {}, '2026-09-01')
      expect(result.incomes).toEqual([{ id: 'i1', amount: 4_000, frequency: 'monthly' }])
      expect(result.expenses).toEqual([{ id: 'e1', amount: 1_000, frequency: 'monthly' }])
    })
  })
})

describe('editEstimateDate', () => {
  const taken = ['2026-01-01', '2026-03-01', '2026-06-01']

  test('reads unrecorded figures as on its own date while it stays behind a later snapshot', () => {
    expect(editEstimateDate('2026-03-01', '2026-03-01', taken, '2026-03-01')).toBe('2026-03-01')
    expect(editEstimateDate('2026-03-01', '2026-02-01', taken, '2026-03-01')).toBe('2026-03-01')
  })

  test('reads them for the new date once it is moved onto or past the newest', () => {
    expect(editEstimateDate('2026-03-01', '2026-07-01', taken, '2026-03-01')).toBe('2026-07-01')
    expect(editEstimateDate('2026-06-01', '2026-06-01', taken, '2026-06-01')).toBe('2026-06-01')
  })
})

describe('snapshotWithEdits', () => {
  // An older snapshot that recorded only some of what the profile holds today:
  // no Card liability and no Living expense yet.
  const RECORDED: Snapshot = {
    date: '2026-01-01',
    cash_amount: 15_000,
    investments: [{ id: 'inv1', balance: 70_000 }],
    tangible_assets: [
      { id: 't1', value: 11_000 },
      {
        id: 't2',
        value: 195_000,
        outstanding_balance: 104_000,
        remaining_term: 21,
        remaining_term_unit: 'years',
      },
    ],
    incomes: [{ id: 'i1', amount: 3_800, frequency: 'monthly' }],
  }
  const later = captureSnapshot(PROFILE, '2026-06-01')
  const profile: Profile = { ...PROFILE, snapshots: [RECORDED, later] }
  const sections = buildSnapshotSections(profile, RECORDED, RECORDED.date)

  test('leaves the snapshot exactly as it was when nothing is edited', () => {
    expect(snapshotWithEdits(RECORDED, sections, {})).toEqual(RECORDED)
  })

  test('a cleared field is not an edit', () => {
    expect(snapshotWithEdits(RECORDED, sections, { cash: undefined })).toEqual(RECORDED)
  })

  test('writes only the edited figure', () => {
    expect(snapshotWithEdits(RECORDED, sections, { 'investments:inv1': 72_500 })).toEqual({
      ...RECORDED,
      investments: [{ id: 'inv1', balance: 72_500 }],
    })
  })

  test('does not fill in items the snapshot never recorded', () => {
    const saved = snapshotWithEdits(RECORDED, sections, { cash: 16_000 })
    expect(saved.liabilities).toBeUndefined()
    expect(saved.expenses).toBeUndefined()
    expect(saved.cash_amount).toBe(16_000)
  })

  test("editing an asset's value keeps its recorded debt and term", () => {
    const saved = snapshotWithEdits(RECORDED, sections, { 'tangible_assets:t2': 198_000 })
    expect(saved.tangible_assets).toEqual([
      { id: 't1', value: 11_000 },
      {
        id: 't2',
        value: 198_000,
        outstanding_balance: 104_000,
        remaining_term: 21,
        remaining_term_unit: 'years',
      },
    ])
  })

  test('editing the value of an asset recorded as owned outright records no debt', () => {
    // The profile's t2 is financed today, so its debt field exists and opens at 0.
    const owned: Snapshot = { ...RECORDED, tangible_assets: [{ id: 't2', value: 190_000 }] }
    const ownedSections = buildSnapshotSections(PROFILE, owned, owned.date)
    expect(
      snapshotWithEdits(owned, ownedSections, { 'tangible_assets:t2': 195_000 }).tangible_assets,
    ).toEqual([{ id: 't2', value: 195_000 }])
    // Typing a debt records it.
    expect(
      snapshotWithEdits(owned, ownedSections, { 'tangible_assets:t2:debt': 50_000 })
        .tangible_assets?.[0],
    ).toMatchObject({ id: 't2', value: 190_000, outstanding_balance: 50_000 })
  })

  test('a re-dated edit opens an item the snapshot never recorded at zero, as it will be saved', () => {
    // January recorded the Card liability; RECORDED, here dated March, did not.
    const january: Snapshot = {
      date: '2026-01-01',
      liabilities: [{ id: 'l1', outstanding_balance: 4_000 }],
    }
    const march: Snapshot = { ...RECORDED, date: '2026-03-01' }
    const history: Profile = { ...PROFILE, snapshots: [january, march, later] }
    const card = (built: ReturnType<typeof buildSnapshotSections>) =>
      built.find((section) => section.id === 'liabilities')?.fields[0].value
    // Moved to February it would read January's 4,000 carried forward.
    expect(card(buildSnapshotSections(history, march, '2026-02-01'))).toBeGreaterThan(0)
    const estimateOn = editEstimateDate(
      march.date,
      '2026-02-01',
      ['2026-01-01', '2026-03-01', later.date],
      march.date,
    )
    expect(card(buildSnapshotSections(history, march, '2026-02-01', estimateOn))).toBe(0)
  })

  test("editing an asset's debt keeps its recorded value", () => {
    const saved = snapshotWithEdits(RECORDED, sections, { 'tangible_assets:t2:debt': 103_000 })
    expect(saved.tangible_assets?.[1]).toEqual({
      id: 't2',
      value: 195_000,
      outstanding_balance: 103_000,
      remaining_term: 21,
      remaining_term_unit: 'years',
    })
  })

  test('an edit to an item the snapshot never recorded adds it', () => {
    const saved = snapshotWithEdits(RECORDED, sections, { 'expenses:e1': 900 })
    expect(saved.expenses).toEqual([{ id: 'e1', amount: 900, frequency: 'monthly' }])
    expect(saved.incomes).toEqual(RECORDED.incomes)
  })

  test('typing a zero is an edit', () => {
    expect(snapshotWithEdits(RECORDED, sections, { cash: 0 }).cash_amount).toBe(0)
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
      {
        key: 'investments:inv1',
        itemId: 'inv1',
        label: 'ETF',
        kind: 'balance',
        value: 50_000,
        unknown: false,
      },
      {
        key: 'investments:inv2',
        itemId: 'inv2',
        label: 'Gold',
        kind: 'balance',
        value: 500,
        unknown: false,
      },
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

describe('unknown figures in the snapshot dialog', () => {
  const investment = { id: 'inv1', name: 'ETF', balance: 3_000, apy: 5 }
  const JAN: Snapshot = {
    date: '2026-01-01',
    cash_amount: 1_000,
    investments: [{ id: 'inv1', balance: 1_000 }],
  }
  const MAR: Snapshot = { date: '2026-03-01', investments: [{ id: 'inv1' }] }
  const MAY: Snapshot = {
    date: '2026-05-01',
    cash_amount: 2_200,
    investments: [{ id: 'inv1', balance: 3_000 }],
  }
  const profile: Profile = {
    name: 'Alice',
    email: 'a@example.com',
    cash_amount: 2_200,
    investments: [investment],
    snapshots: [JAN, MAR, MAY],
  }
  const fieldOf = (sections: ReturnType<typeof buildSnapshotSections>, key: string) =>
    sections.flatMap((section) => section.fields).find((field) => field.key === key)

  test('opens an unknown figure at its calculated value', () => {
    const sections = buildSnapshotSections(profile, MAR, MAR.date)
    expect(fieldOf(sections, 'cash')?.value).toBe(1_590)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(1_983)
  })

  test('keeps an untouched unknown figure unknown', () => {
    const sections = buildSnapshotSections(profile, MAR, MAR.date)
    const saved = snapshotFromFields(MAR, sections, {}, MAR.date)
    expect(saved.cash_amount).toBeUndefined()
    expect(saved.investments).toStrictEqual([{ id: 'inv1' }])
  })

  test('records a typed figure', () => {
    const sections = buildSnapshotSections(profile, MAR, MAR.date)
    const saved = snapshotFromFields(MAR, sections, { cash: 7, 'investments:inv1': 8 }, MAR.date)
    expect(saved.cash_amount).toBe(7)
    expect(saved.investments).toEqual([{ id: 'inv1', balance: 8 }])
  })

  test('seeds a date from the calculated value of the snapshot before it', () => {
    expect(seedSnapshotOn(profile, '2026-03-02').cash_amount).toBe(1_590)
  })

  /** The sections of an edit of `source` re-dated to `date`, as the dialog builds them. */
  const editSections = (history: Profile, source: Snapshot, date: string) =>
    buildSnapshotSections(
      history,
      source,
      date,
      editEstimateDate(
        source.date,
        date,
        (history.snapshots ?? []).map((snapshot) => snapshot.date),
        source.date,
      ),
      source.date,
    )

  /** What History reads on `date` once `saved` is recorded there. */
  const readsAfterSave = (saved: Snapshot, originalDate?: string) =>
    resolveSnapshots(withSavedSnapshot(profile, saved, originalDate)).find(
      (snapshot) => snapshot.date === saved.date,
    )

  test('opens a re-dated unknown figure at its calculated value on the new date', () => {
    const sections = editSections(profile, MAR, '2026-04-01')
    expect(fieldOf(sections, 'cash')?.value).toBe(1_900)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(2_500)
  })

  test('records a re-dated unknown figure as History reads it on the new date', () => {
    const sections = editSections(profile, MAR, '2026-04-01')
    const saved = { ...snapshotWithEdits(MAR, sections, {}), date: '2026-04-01' }
    expect(saved.cash_amount).toBeUndefined()
    expect(saved.investments).toStrictEqual([{ id: 'inv1' }])
    const read = readsAfterSave(saved, MAR.date)
    expect(read?.cash_amount).toBe(1_900)
    expect(read?.investments).toEqual([{ id: 'inv1', balance: 2_500 }])
  })

  test('opens an unknown figure re-dated past the newest snapshot at the profile figure', () => {
    const sections = editSections(profile, MAR, '2026-06-01')
    expect(fieldOf(sections, 'cash')?.value).toBe(2_200)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(3_000)
    const saved = { ...snapshotWithEdits(MAR, sections, {}), date: '2026-06-01' }
    const read = readsAfterSave(saved, MAR.date)
    expect(read?.cash_amount).toBe(2_200)
    expect(read?.investments).toEqual([{ id: 'inv1', balance: 3_000 }])
  })

  test('records a figure typed over an unknown one in an edit', () => {
    const sections = editSections(profile, MAR, MAR.date)
    const saved = snapshotWithEdits(MAR, sections, { cash: 7 })
    expect(saved.cash_amount).toBe(7)
    expect(saved.investments).toStrictEqual([{ id: 'inv1' }])
  })

  test('opens a copied unknown figure at the profile figure on a date past the newest snapshot', () => {
    const copy: Snapshot = { ...MAR, date: '2026-06-01' }
    const sections = buildSnapshotSections(profile, copy, '2026-06-01')
    expect(fieldOf(sections, 'cash')?.value).toBe(2_200)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(3_000)
    const read = readsAfterSave(snapshotFromFields(copy, sections, {}, '2026-06-01'))
    expect(read?.cash_amount).toBe(2_200)
    expect(read?.investments).toEqual([{ id: 'inv1', balance: 3_000 }])
  })

  test('opens a copied unknown figure at its calculated value on an earlier date', () => {
    const copy: Snapshot = { ...MAR, date: '2026-06-01' }
    const sections = buildSnapshotSections(profile, copy, '2026-04-01')
    expect(fieldOf(sections, 'cash')?.value).toBe(1_900)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(2_500)
  })

  test('vacates the original date when calculating a re-dated unknown figure', () => {
    const newest: Snapshot = { date: '2026-05-01', investments: [{ id: 'inv1' }] }
    const history: Profile = { ...profile, snapshots: [JAN, newest] }
    const sections = editSections(history, newest, '2026-02-01')
    expect(fieldOf(sections, 'cash')?.value).toBe(2_200)
    expect(fieldOf(sections, 'investments:inv1')?.value).toBe(3_000)
  })
})
