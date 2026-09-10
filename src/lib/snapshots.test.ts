import { describe, expect, test } from 'vitest'

import { getNetWorth } from './financial-totals'
import type { Profile, Snapshot } from './schemas'
import {
  captureSnapshot,
  hasSameBalances,
  latestSnapshot,
  profileAtSnapshot,
  removeSnapshot,
  snapshotNetWorth,
  staleSince,
  upsertSnapshot,
  withDeletedSnapshot,
  withSavedSnapshot,
  withSeededSnapshot,
} from './snapshots'

const PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 15_000,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 100_000, apy: 5 },
    { id: 'inv2', name: 'Bonds', balance: 78_000, apy: 2 },
  ],
  tangible_assets: [
    { id: 't1', name: 'Car', value: 20_000, status: 'fully_owned' },
    {
      id: 't2',
      name: 'House',
      value: 170_000,
      status: 'financed',
      outstanding_balance: 80_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 700,
      remaining_term: 20,
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
      amount: 2_000,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
}

describe('captureSnapshot', () => {
  test('records every balance that makes up net worth', () => {
    expect(captureSnapshot(PROFILE, '2026-04-27')).toEqual({
      date: '2026-04-27',
      cash_amount: 15_000,
      investments: [
        { id: 'inv1', balance: 100_000 },
        { id: 'inv2', balance: 78_000 },
      ],
      tangible_assets: [
        { id: 't1', value: 20_000, outstanding_balance: undefined, remaining_term: undefined },
        { id: 't2', value: 170_000, outstanding_balance: 80_000, remaining_term: 20 },
      ],
      // The term is recorded with the balance it moves with.
      liabilities: [{ id: 'l1', outstanding_balance: 6_000, remaining_term: 3 }],
      incomes: [{ id: 'i1', amount: 4_000, frequency: 'monthly' }],
      expenses: [{ id: 'e1', amount: 2_000, frequency: 'monthly' }],
    })
  })

  test('captures an empty profile as zero cash and empty lists', () => {
    expect(captureSnapshot({ name: '', email: '' }, '2026-04-27')).toEqual({
      date: '2026-04-27',
      cash_amount: 0,
      investments: [],
      tangible_assets: [],
      liabilities: [],
      incomes: [],
      expenses: [],
    })
  })
})

describe('captureSnapshot and the holding window', () => {
  test('records nothing for a holding the profile does not have on that date', () => {
    // History has to plot the same net worth the dashboard shows, so what a
    // snapshot records and what `getNetWorth` counts have to be the same set.
    const profile: Profile = {
      ...PROFILE,
      investments: [
        PROFILE.investments![0],
        { ...PROFILE.investments![1], start: 'at_specific_date', start_year: 2035 },
      ],
      tangible_assets: [
        PROFILE.tangible_assets![0],
        { ...PROFILE.tangible_assets![1], purchase: 'at_specific_date', purchase_year: 2035 },
      ],
    }
    const snapshot = captureSnapshot(profile, '2026-04-27')
    expect(snapshot.investments).toEqual([{ id: 'inv1', balance: 100_000 }])
    expect(snapshot.tangible_assets).toEqual([
      { id: 't1', value: 20_000, outstanding_balance: undefined, remaining_term: undefined },
    ])
  })
})

describe('snapshotNetWorth', () => {
  test('sums assets and subtracts both standalone and financed-asset debt', () => {
    // 15,000 + 178,000 + 190,000 − (6,000 + 80,000)
    expect(snapshotNetWorth(captureSnapshot(PROFILE, '2026-04-27'))).toBe(297_000)
  })

  test('is zero for a snapshot with no balances', () => {
    expect(snapshotNetWorth({})).toBe(0)
  })
})

describe('upsertSnapshot', () => {
  const a: Snapshot = { date: '2026-01-01', cash_amount: 100 }
  const b: Snapshot = { date: '2026-03-01', cash_amount: 300 }

  test('appends a new date and keeps the list sorted by date', () => {
    const result = upsertSnapshot([b, a], { date: '2026-02-01', cash_amount: 200 })
    expect(result.map((s) => s.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  test('replaces an existing snapshot with the same date', () => {
    const result = upsertSnapshot([a, b], { date: '2026-03-01', cash_amount: 999 })
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ date: '2026-03-01', cash_amount: 999 })
  })

  test('treats a missing list as empty', () => {
    expect(upsertSnapshot(undefined, a)).toEqual([a])
  })

  test('does not mutate the input list', () => {
    const input = [a]
    upsertSnapshot(input, b)
    expect(input).toEqual([a])
  })
})

describe('latestSnapshot', () => {
  test('returns the snapshot with the most recent date', () => {
    const snapshots: Snapshot[] = [
      { date: '2026-01-01' },
      { date: '2026-03-01' },
      { date: '2026-02-01' },
    ]
    expect(latestSnapshot(snapshots)?.date).toBe('2026-03-01')
  })

  test('returns undefined when there are no snapshots', () => {
    expect(latestSnapshot(undefined)).toBeUndefined()
    expect(latestSnapshot([])).toBeUndefined()
  })
})

describe('staleSince', () => {
  const snapshots: Snapshot[] = [{ date: '2026-01-01' }, { date: '2026-03-01' }]

  test('names the date the figures were last recorded on', () => {
    expect(staleSince(snapshots, '2026-06-15')).toBe('2026-03-01')
  })

  test('is undefined when the newest snapshot is today', () => {
    expect(staleSince(snapshots, '2026-03-01')).toBeUndefined()
  })

  test('is undefined when nothing was ever recorded', () => {
    expect(staleSince(undefined, '2026-06-15')).toBeUndefined()
    expect(staleSince([], '2026-06-15')).toBeUndefined()
  })
})

describe('hasSameBalances', () => {
  test('ignores the date when comparing', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot(PROFILE, '2026-06-01')
    expect(hasSameBalances(one, two)).toBe(true)
  })

  test('detects a changed balance', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot({ ...PROFILE, cash_amount: 15_001 }, '2026-01-01')
    expect(hasSameBalances(one, two)).toBe(false)
  })

  test('detects an added item', () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two = captureSnapshot(
      {
        ...PROFILE,
        investments: [
          ...(PROFILE.investments ?? []),
          { id: 'inv3', name: 'x', balance: 1, apy: 0 },
        ],
      },
      '2026-01-01',
    )
    expect(hasSameBalances(one, two)).toBe(false)
  })

  test('reads a snapshot stored before cash flows were recorded as unchanged', () => {
    const legacy: Snapshot = {
      date: '2020-01-01',
      cash_amount: 15_000,
      investments: [
        { id: 'inv1', balance: 100_000 },
        { id: 'inv2', balance: 78_000 },
      ],
      tangible_assets: [
        { id: 't1', value: 20_000, outstanding_balance: undefined },
        { id: 't2', value: 170_000, outstanding_balance: 80_000 },
      ],
      liabilities: [{ id: 'l1', outstanding_balance: 6_000 }],
    }
    expect(hasSameBalances(legacy, captureSnapshot(PROFILE, '2026-06-15'))).toBe(true)
  })

  test('still detects a balance that moved since a legacy snapshot', () => {
    const legacy: Snapshot = { date: '2020-01-01', cash_amount: 15_000 }
    const moved = captureSnapshot({ ...PROFILE, cash_amount: 16_000 }, '2026-06-15')
    expect(hasSameBalances(legacy, moved)).toBe(false)
  })

  test('treats a missing snapshot as different', () => {
    expect(hasSameBalances(undefined, captureSnapshot(PROFILE, '2026-01-01'))).toBe(false)
  })

  // A snapshot restored from a backup only has to satisfy the schema, which
  // makes every balance field optional. Comparing the raw shapes reported such a
  // snapshot as changed, so a mere profile rename recorded a new snapshot and
  // ran carry-forward over the balances.
  test('treats omitted balance fields as the defaults captureSnapshot emits', () => {
    const sparse: Snapshot = { date: '2026-01-01', cash_amount: 15_000 }
    const captured = captureSnapshot(
      { name: 'Alice', email: 'a@example.com', cash_amount: 15_000 },
      '2026-01-01',
    )
    expect(hasSameBalances(sparse, captured)).toBe(true)
  })

  test('treats an omitted list as different from one holding a balance', () => {
    const sparse: Snapshot = { date: '2026-01-01', cash_amount: 15_000 }
    expect(hasSameBalances(sparse, captureSnapshot(PROFILE, '2026-01-01'))).toBe(false)
  })

  test("treats a financed asset's missing debt as zero", () => {
    const one: Snapshot = { date: '2026-01-01', tangible_assets: [{ id: 't1', value: 100 }] }
    const two: Snapshot = {
      date: '2026-01-01',
      tangible_assets: [{ id: 't1', value: 100, outstanding_balance: 0 }],
    }
    expect(hasSameBalances(one, two)).toBe(true)
  })

  test('ignores a cash flow whose amount moved', () => {
    // A raise moves no balance. Reading it as a change would re-date the
    // projection baseline: every untouched balance replaced by its projection,
    // today stamped onto them, and the staleness banner gone — all because the
    // user corrected their salary.
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const raised = { ...(PROFILE.incomes ?? [])[0], amount: 4_500 }
    const two = captureSnapshot({ ...PROFILE, incomes: [raised] }, '2026-01-01')
    expect(hasSameBalances(one, two)).toBe(true)
  })

  test('ignores a cash flow the profile gained or lost', () => {
    const none = captureSnapshot({ ...PROFILE, incomes: [] }, '2026-01-01')
    expect(hasSameBalances(none, captureSnapshot(PROFILE, '2026-01-01'))).toBe(true)
  })

  test("ignores a loan's term, which moves with the balance it is compared beside", () => {
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const two: Snapshot = {
      ...one,
      liabilities: [{ id: 'l1', outstanding_balance: 6_000, remaining_term: 2 }],
    }
    expect(hasSameBalances(one, two)).toBe(true)
  })

  test('ignores the order the items are stored in', () => {
    // Reordering a profile's lists moves no money. Reading it as a change
    // would record a snapshot and re-date the projection baseline.
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const reordered = captureSnapshot(
      { ...PROFILE, investments: [...(PROFILE.investments ?? [])].reverse() },
      '2026-01-01',
    )
    expect(hasSameBalances(one, reordered)).toBe(true)
  })

  test('detects an item swapped for another with the same balance', () => {
    // Matching by id, not by position: same length, same figures, different
    // holdings.
    const one = captureSnapshot(PROFILE, '2026-01-01')
    const swapped: Snapshot = {
      ...one,
      investments: [
        { id: 'inv1', balance: 100_000 },
        { id: 'inv3', balance: 78_000 },
      ],
    }
    expect(hasSameBalances(one, swapped)).toBe(false)
  })
})

describe('withSeededSnapshot', () => {
  const asOf = new Date(2026, 3, 27) // 2026-04-27

  test('gives a profile with no history a baseline dated asOf', () => {
    const seeded = withSeededSnapshot(PROFILE, asOf)
    expect(seeded.snapshots).toEqual([captureSnapshot(PROFILE, '2026-04-27')])
  })

  test('leaves an existing history untouched', () => {
    const profile: Profile = { ...PROFILE, snapshots: [{ date: '2020-01-01' }] }
    expect(withSeededSnapshot(profile, asOf)).toBe(profile)
  })

  test('records nothing for a profile with no balances', () => {
    const profile: Profile = { name: '', email: '' }
    expect(withSeededSnapshot(profile, asOf).snapshots).toBeUndefined()
  })

  test('seeds a profile whose snapshot list is empty', () => {
    // An empty list means the same as no list: balances with no date attached.
    // Nothing can leave one behind on purpose — deleting the last snapshot
    // re-baselines onto today rather than clearing the history.
    const profile: Profile = { ...PROFILE, snapshots: [] }
    expect(withSeededSnapshot(profile, asOf).snapshots).toEqual([
      captureSnapshot(PROFILE, '2026-04-27'),
    ])
  })
})

describe('removeSnapshot', () => {
  const a: Snapshot = { date: '2026-01-01', cash_amount: 100 }
  const b: Snapshot = { date: '2026-03-01', cash_amount: 300 }

  test('drops the snapshot with the given date', () => {
    expect(removeSnapshot([a, b], '2026-01-01')).toEqual([b])
  })

  test('leaves the list alone when no snapshot has that date', () => {
    expect(removeSnapshot([a, b], '2026-02-01')).toEqual([a, b])
  })

  test('treats a missing list as empty', () => {
    expect(removeSnapshot(undefined, '2026-01-01')).toEqual([])
  })

  test('does not mutate the input list', () => {
    const input = [a, b]
    removeSnapshot(input, '2026-01-01')
    expect(input).toEqual([a, b])
  })
})

describe('profileAtSnapshot', () => {
  const snapshot = captureSnapshot(PROFILE, '2026-04-27')

  test('round-trips a snapshot captured from the profile', () => {
    const at = profileAtSnapshot(PROFILE, snapshot)
    expect(at.cash_amount).toBe(15_000)
    expect(at.investments).toEqual(PROFILE.investments)
    expect(at.tangible_assets).toEqual(PROFILE.tangible_assets)
    expect(at.liabilities).toEqual(PROFILE.liabilities)
    expect(at.incomes).toEqual(PROFILE.incomes)
    expect(at.expenses).toEqual(PROFILE.expenses)
  })

  test('restores the recorded values over the profile ones', () => {
    const at = profileAtSnapshot(PROFILE, {
      ...snapshot,
      cash_amount: 1_000,
      investments: [{ id: 'inv1', balance: 50_000 }],
      incomes: [{ id: 'i1', amount: 3_000, frequency: 'monthly' }],
    })
    expect(at.cash_amount).toBe(1_000)
    // Only the recorded investment survives — inv2 did not exist on that date.
    expect(at.investments).toEqual([{ id: 'inv1', name: 'ETF', balance: 50_000, apy: 5 }])
    // Everything but the amount comes from the profile item.
    expect(at.incomes?.[0]).toMatchObject({ name: 'Salary', amount: 3_000, end: 'never' })
  })

  test('keeps its net worth equal to the snapshot it was built from', () => {
    expect(getNetWorth(profileAtSnapshot(PROFILE, snapshot))).toBe(snapshotNetWorth(snapshot))
  })

  test("follows the snapshot's financing status, not the profile's", () => {
    // The house was paid off since; the snapshot still records its debt, so
    // net worth on that date has to keep counting it.
    const paidOff: Profile = {
      ...PROFILE,
      tangible_assets: [
        { id: 't1', name: 'Car', value: 20_000, status: 'fully_owned' },
        { id: 't2', name: 'House', value: 170_000, status: 'fully_owned' },
      ],
    }
    const at = profileAtSnapshot(paidOff, snapshot)
    expect(at.tangible_assets?.[1]).toMatchObject({
      status: 'financed',
      outstanding_balance: 80_000,
    })
    expect(getNetWorth(at)).toBe(snapshotNetWorth(snapshot))
  })

  test('reads a missing cash-flow list the way it reads a missing balance', () => {
    // Undefined means "none recorded" in every section. Snapshots written
    // before cash flows were recorded are filled in from the profile at the
    // load boundary (`repairStoredData`), so nothing downstream has to guess.
    const legacy: Snapshot = { ...snapshot, incomes: undefined, expenses: undefined }
    const at = profileAtSnapshot(PROFILE, legacy)
    expect(at.incomes).toEqual([])
    expect(at.expenses).toEqual([])
  })

  test('reads a recorded but empty cash-flow list as no cash flow', () => {
    const at = profileAtSnapshot(PROFILE, { ...snapshot, incomes: [], expenses: [] })
    expect(at.incomes).toEqual([])
    expect(at.expenses).toEqual([])
  })

  test("restores a loan's recorded term alongside its balance", () => {
    const at = profileAtSnapshot(PROFILE, {
      ...snapshot,
      liabilities: [{ id: 'l1', outstanding_balance: 6_000, remaining_term: 12 }],
    })
    expect(at.liabilities?.[0]).toMatchObject({ outstanding_balance: 6_000, remaining_term: 12 })
  })

  test('still reads a missing balance list as nothing owned', () => {
    // Balances get no such fallback: `snapshotNetWorth` counts a missing list
    // as zero, and the two have to agree.
    const bare: Snapshot = { date: '2026-04-27', cash_amount: 5 }
    expect(getNetWorth(profileAtSnapshot(PROFILE, bare))).toBe(snapshotNetWorth(bare))
  })

  test('keeps a recorded item the profile no longer has', () => {
    const withoutInvestments: Profile = { ...PROFILE, investments: [] }
    const at = profileAtSnapshot(withoutInvestments, snapshot)
    expect(at.investments).toHaveLength(2)
    expect(getNetWorth(at)).toBe(snapshotNetWorth(snapshot))
  })
})

describe('withSavedSnapshot', () => {
  const JAN = captureSnapshot({ ...PROFILE, cash_amount: 1_000 }, '2026-01-01')
  const JUN = captureSnapshot({ ...PROFILE, cash_amount: 9_000 }, '2026-06-01')
  const HISTORY: Profile = { ...PROFILE, cash_amount: 9_000, snapshots: [JAN, JUN] }

  test('adds a snapshot and keeps the list date-ascending', () => {
    const saved = withSavedSnapshot(HISTORY, { ...JAN, date: '2026-03-01', cash_amount: 5_000 })
    expect(saved.snapshots?.map((s) => s.date)).toEqual(['2026-01-01', '2026-03-01', '2026-06-01'])
  })

  test('re-dates a snapshot, leaving nothing behind at the old date', () => {
    const saved = withSavedSnapshot(HISTORY, { ...JAN, date: '2026-02-01' }, '2026-01-01')
    expect(saved.snapshots?.map((s) => s.date)).toEqual(['2026-02-01', '2026-06-01'])
  })

  test("carries the latest snapshot's figures onto the profile", () => {
    // The profile holds the balances as of its newest snapshot, so editing
    // that snapshot has to move the profile with it — otherwise the dashboard
    // keeps projecting from the value the user just replaced.
    const saved = withSavedSnapshot(HISTORY, { ...JUN, cash_amount: 12_345 })
    expect(saved.cash_amount).toBe(12_345)
  })

  test('leaves the profile alone when an older snapshot is edited', () => {
    const saved = withSavedSnapshot(HISTORY, { ...JAN, cash_amount: 2 })
    expect(saved.cash_amount).toBe(9_000)
  })

  test('re-baselines the profile when the new snapshot becomes the latest', () => {
    const saved = withSavedSnapshot(HISTORY, { ...JUN, date: '2026-08-01', cash_amount: 20_000 })
    expect(saved.cash_amount).toBe(20_000)
  })

  test('keeps a profile item the snapshot never recorded', () => {
    // An investment added after the snapshot was taken has no recorded value
    // in it. Re-baselining must not delete it from the profile.
    const extra = { id: 'inv3', name: 'Gold', balance: 500, apy: 1 }
    const withExtra: Profile = { ...HISTORY, investments: [...(PROFILE.investments ?? []), extra] }
    const saved = withSavedSnapshot(withExtra, { ...JUN, cash_amount: 1 })
    expect(saved.investments).toContainEqual(extra)
  })
})

describe('withDeletedSnapshot', () => {
  const JAN = captureSnapshot({ ...PROFILE, cash_amount: 1_000 }, '2026-01-01')
  const JUN = captureSnapshot({ ...PROFILE, cash_amount: 9_000 }, '2026-06-01')
  const HISTORY: Profile = { ...PROFILE, cash_amount: 9_000, snapshots: [JAN, JUN] }

  test('drops the snapshot', () => {
    expect(withDeletedSnapshot(HISTORY, '2026-01-01').snapshots?.map((s) => s.date)).toEqual([
      '2026-06-01',
    ])
  })

  test('rewinds the profile to the snapshot that becomes the latest', () => {
    expect(withDeletedSnapshot(HISTORY, '2026-06-01').cash_amount).toBe(1_000)
  })

  test('leaves the profile alone when an older snapshot goes', () => {
    expect(withDeletedSnapshot(HISTORY, '2026-01-01').cash_amount).toBe(9_000)
  })

  test('leaves the profile alone when the last snapshot goes', () => {
    const only: Profile = { ...PROFILE, snapshots: [JUN] }
    const deleted = withDeletedSnapshot(only, '2026-06-01')
    expect(deleted.snapshots).toEqual([])
    expect(deleted.cash_amount).toBe(PROFILE.cash_amount)
  })

  test("drops a financed asset's debt when the older snapshot recorded none", () => {
    // The house was fully owned when JAN was taken and financed since.
    // Rewinding onto JAN restores that state: keeping today's mortgage against
    // January's value would leave the profile disagreeing with the very
    // snapshot it was just re-baselined onto, so the dashboard would report a
    // net worth the History chart never plots. Financing fields left on the
    // item are harmless — the schema only requires them while it is financed.
    const ownedOutright = PROFILE.tangible_assets?.map((a) =>
      a.id === 't2' ? { ...a, status: 'fully_owned' as const, outstanding_balance: undefined } : a,
    )
    const jan = captureSnapshot({ ...PROFILE, tangible_assets: ownedOutright }, '2026-01-01')
    const deleted = withDeletedSnapshot({ ...PROFILE, snapshots: [jan, JUN] }, '2026-06-01')
    const house = deleted.tangible_assets?.find((a) => a.id === 't2')
    expect(house?.status).toBe('fully_owned')
    expect(house?.outstanding_balance).toBeUndefined()
    // Which leaves the profile matching its newest snapshot again.
    expect(getNetWorth(deleted)).toBe(snapshotNetWorth(jan))
  })
})
