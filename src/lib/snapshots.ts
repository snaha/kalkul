import { isHeldOn, isOwnedOn, yearOf } from '$lib/plan-projection'
import {
  type Expense,
  type Income,
  type Profile,
  type ProfileInvestment,
  type ProfileLiability,
  type ProfileTangibleAsset,
  type Snapshot,
  normalizeSnapshots,
} from '$lib/schemas'
import { parseDateOnly, toDateOnlyString } from '$lib/utils'

/**
 * The figures a snapshot records, without the date it was recorded on. Net
 * worth, "did anything move?" and "is there anything to record?" are all
 * questions about the figures alone.
 */
export type SnapshotBalances = Omit<Snapshot, 'date'>

const byId = <T extends { id: string }>(items: T[] | undefined) =>
  new Map((items ?? []).map((item) => [item.id, item]))

/**
 * Every balance the profile records, whether or not it is held right now.
 *
 * Answers "has this profile any financial data at all?" — a purchase planned
 * for 2035 is data the user entered and has to keep the dashboard open, even
 * though it is not part of today's net worth. `heldBalances` is the one to
 * count with.
 */
export function snapshotBalances(profile: Profile): SnapshotBalances {
  return {
    cash_amount: profile.cash_amount ?? 0,
    investments: (profile.investments ?? []).map((i) => ({ id: i.id, balance: i.balance })),
    tangible_assets: (profile.tangible_assets ?? []).map((a) => ({
      id: a.id,
      value: a.value,
      // Only financed assets carry debt; `status` can flip back to fully owned
      // while a stale balance lingers on the item, so gate on the status.
      outstanding_balance: a.status === 'financed' ? a.outstanding_balance : undefined,
    })),
    liabilities: (profile.liabilities ?? []).map((l) => ({
      id: l.id,
      outstanding_balance: l.outstanding_balance,
    })),
  }
}

/**
 * The balances that make up net worth on `asOf` — what the profile actually
 * holds that day.
 *
 * Planned timing makes a balance a statement about a different date: a start
 * in the future is the amount the plan will buy out of cash that year, and an
 * exit in the past put it back into cash. Counting either today overstates net
 * worth, and puts the headline figure at odds with the Current projection card
 * beside it, which holds such a position at zero until its year arrives.
 *
 * A property that has not been bought drops its financing along with its
 * value: keeping the debt without the asset would read as a hole the size of
 * the mortgage. Standalone liabilities carry no timing of their own and always
 * count.
 */
export function heldBalances(profile: Profile, asOf: Date): SnapshotBalances {
  return snapshotBalances(heldProfile(profile, asOf))
}

/**
 * The profile with only what it holds on `asOf` — the same rule `heldBalances`
 * counts by, kept in one place so a total taken from the filtered profile and
 * one taken from the balances can never disagree.
 *
 * Handed to anything that reports what the user has right now: the net-worth
 * card totals its own breakdown, so filtering at that boundary keeps the pie,
 * the rows and the headline figure adding up. Anything that models the
 * *future* — the projections panel above all — needs the unfiltered profile,
 * because a planned purchase is exactly what it is there to draw.
 */
export function heldProfile(profile: Profile, asOf: Date): Profile {
  const birthYear = profile.birth_date ? yearOf(profile.birth_date) : undefined
  return {
    ...profile,
    investments: (profile.investments ?? []).filter((i) => isHeldOn(i, asOf, birthYear)),
    tangible_assets: (profile.tangible_assets ?? []).filter((a) => isOwnedOn(a, asOf, birthYear)),
  }
}

/**
 * Point-in-time record of a user's finances: every balance that makes up net
 * worth on the date — what the profile held that day — plus the recurring cash
 * flows that were running on it.
 */
export function captureSnapshot(profile: Profile, date: string): Snapshot {
  return {
    date,
    ...heldBalances(profile, parseDateOnly(date)),
    incomes: (profile.incomes ?? []).map((i) => ({
      id: i.id,
      amount: i.amount,
      frequency: i.frequency,
    })),
    expenses: (profile.expenses ?? []).map((e) => ({
      id: e.id,
      amount: e.amount,
      frequency: e.frequency,
    })),
  }
}

/**
 * Net worth as recorded: assets less every debt, including the debt secured
 * against a financed asset.
 *
 * The single definition of net worth in the app — `getNetWorth` in
 * `financial-totals.ts` runs a profile's balances through this same sum, so the
 * History chart's recorded points and the dashboard's headline figure cannot
 * drift apart.
 */
export function snapshotNetWorth(snapshot: SnapshotBalances): number {
  const assets =
    (snapshot.cash_amount ?? 0) +
    (snapshot.investments ?? []).reduce((sum, i) => sum + i.balance, 0) +
    (snapshot.tangible_assets ?? []).reduce((sum, a) => sum + a.value, 0)
  const liabilities =
    (snapshot.liabilities ?? []).reduce((sum, l) => sum + l.outstanding_balance, 0) +
    (snapshot.tangible_assets ?? []).reduce((sum, a) => sum + (a.outstanding_balance ?? 0), 0)
  return assets - liabilities
}

/**
 * Whether any recorded balance is non-zero. Asset debt does not count on its
 * own: it is the counterpart of a value that already does.
 */
export function hasAnyBalance(snapshot: SnapshotBalances): boolean {
  if ((snapshot.cash_amount ?? 0) > 0) return true
  if ((snapshot.investments ?? []).some((i) => i.balance > 0)) return true
  if ((snapshot.tangible_assets ?? []).some((a) => a.value > 0)) return true
  if ((snapshot.liabilities ?? []).some((l) => l.outstanding_balance > 0)) return true
  return false
}

/**
 * Adds `snapshot` to the list, replacing any existing entry with the same date
 * so a day's figures are recorded once. Returns a new, date-ascending list.
 */
export function upsertSnapshot(snapshots: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[] {
  // Last entry wins on a shared date, so appending is what replaces.
  return normalizeSnapshots([...(snapshots ?? []), snapshot])
}

/** Drops the snapshot dated `date`, if there is one. Returns a new list. */
export function removeSnapshot(snapshots: Snapshot[] | undefined, date: string): Snapshot[] {
  return (snapshots ?? []).filter((s) => s.date !== date)
}

export function latestSnapshot(snapshots: Snapshot[] | undefined): Snapshot | undefined {
  if (!snapshots || snapshots.length === 0) return undefined
  return snapshots.reduce((latest, s) => (s.date > latest.date ? s : latest))
}

/**
 * Whether two recorded sections hold the same entries. Matched by id rather
 * than by position: reordering a profile's list — a drag, an import, a future
 * refactor — moves no money, so it must not read as a change and re-date the
 * projection baseline.
 */
function sameEntries<T extends { id: string }>(
  a: T[] | undefined,
  b: T[] | undefined,
  same: (x: T, y: T) => boolean,
): boolean {
  const left = a ?? []
  const right = byId(b)
  if (left.length !== right.size) return false
  return left.every((item) => {
    const other = right.get(item.id)
    return other !== undefined && same(item, other)
  })
}

/**
 * Whether `next` holds the same figures `previous` recorded, ignoring their
 * dates. Used to skip recording a snapshot when an edit left every figure
 * untouched.
 *
 * Compared field by field rather than by serialized shape: only
 * `captureSnapshot` emits the canonical form, while the schema makes every
 * field optional, so a snapshot restored from a backup can legitimately omit a
 * balance that is simply zero or an empty list. Reading those omissions as
 * "changed" made a rename record a snapshot and re-date the projection
 * baseline.
 *
 * Cash flows are the one section an omission cannot be read that way. A
 * snapshot `previous` never recorded them on leaves them unknown, not none, so
 * they count as no evidence of a change. Without that, the first edit a
 * returning user makes after cash flows were added to the schema would compare
 * a legacy snapshot (which has none) against a fresh capture (which has them),
 * decide something moved, and stamp today's date onto months-old balances —
 * silently clearing the staleness banner they never confirmed away. Balances
 * get no such fallback: undefined has to keep counting as zero there, the way
 * `snapshotNetWorth` counts it.
 */
export function hasSameValues(
  previous: SnapshotBalances | undefined,
  next: SnapshotBalances | undefined,
): boolean {
  if (!previous || !next) return false
  if ((previous.cash_amount ?? 0) !== (next.cash_amount ?? 0)) return false
  if (!sameEntries(previous.investments, next.investments, (x, y) => x.balance === y.balance))
    return false
  if (
    !sameEntries(
      previous.tangible_assets,
      next.tangible_assets,
      (x, y) =>
        x.value === y.value && (x.outstanding_balance ?? 0) === (y.outstanding_balance ?? 0),
    )
  )
    return false
  if (
    !sameEntries(
      previous.liabilities,
      next.liabilities,
      (x, y) => x.outstanding_balance === y.outstanding_balance,
    )
  )
    return false

  const sameFlow = (x: { amount: number; frequency: string }, y: typeof x) =>
    x.amount === y.amount && x.frequency === y.frequency
  if (previous.incomes && !sameEntries(previous.incomes, next.incomes, sameFlow)) return false
  if (previous.expenses && !sameEntries(previous.expenses, next.expenses, sameFlow)) return false
  return true
}

/**
 * The profile as it stood on a snapshot's date: the snapshot's figures wearing
 * the profile's descriptive fields (names, APYs, tax rates, loan terms).
 *
 * The snapshot decides which items exist — one the profile has since gained is
 * dropped, one it has since lost is kept with a placeholder name — so that
 * `getNetWorth` of the result always equals `snapshotNetWorth` of the input.
 * That makes every profile-level total in `financial-totals.ts` (total assets,
 * liabilities, FI %) available per snapshot without a second implementation.
 *
 * Cash flows are the one exception. A snapshot written before they were
 * recorded leaves the arrays undefined, and reading that as "earned and spent
 * nothing" would state every legacy row's financial independence against debt
 * service alone. Undefined therefore falls back to the profile's flows — the
 * best estimate available for a date nothing was recorded on — while an empty
 * array stays what it says it is. Balances get no such fallback: undefined has
 * to keep counting as zero there, or the equality above would not hold.
 */
export function profileAtSnapshot(profile: Profile, snapshot: Snapshot): Profile {
  const investments = byId(profile.investments)
  const assets = byId(profile.tangible_assets)
  const liabilities = byId(profile.liabilities)
  const incomes = byId(profile.incomes)
  const expenses = byId(profile.expenses)

  return {
    ...profile,
    cash_amount: snapshot.cash_amount ?? 0,
    investments: (snapshot.investments ?? []).map(
      ({ id, balance }): ProfileInvestment => ({
        ...(investments.get(id) ?? { id, name: '', apy: 0 }),
        balance,
      }),
    ),
    tangible_assets: (snapshot.tangible_assets ?? []).map(
      ({ id, value, outstanding_balance }): ProfileTangibleAsset => ({
        ...(assets.get(id) ?? { id, name: '' }),
        value,
        // The recorded debt decides the status: an asset paid off since would
        // otherwise stop counting against net worth on a date it still did.
        status: outstanding_balance === undefined ? 'fully_owned' : 'financed',
        outstanding_balance,
      }),
    ),
    liabilities: (snapshot.liabilities ?? []).map(
      ({ id, outstanding_balance }): ProfileLiability => ({
        ...(liabilities.get(id) ?? {
          id,
          name: '',
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 0,
          remaining_term: 0,
        }),
        outstanding_balance,
      }),
    ),
    incomes:
      snapshot.incomes?.map(
        ({ id, amount, frequency }): Income => ({
          ...(incomes.get(id) ?? {
            id,
            name: '',
            start: 'immediately',
            end: 'never',
            change_over_time: 'none',
          }),
          amount,
          frequency,
        }),
      ) ?? profile.incomes,
    expenses:
      snapshot.expenses?.map(
        ({ id, amount, frequency }): Expense => ({
          ...(expenses.get(id) ?? {
            id,
            name: '',
            start: 'immediately',
            end: 'never',
            change_over_time: 'none',
          }),
          amount,
          frequency,
        }),
      ) ?? profile.expenses,
  }
}

/**
 * The profile re-baselined onto a snapshot: every figure the snapshot records
 * replaces the profile's, and everything it does not record is left alone.
 *
 * Deliberately not `profileAtSnapshot`, which drops items the snapshot has no
 * entry for. That is right for reporting a past date, but wrong here: an
 * investment opened after the snapshot was taken is still owned today, and
 * re-baselining must not delete it from the profile.
 */
function withSnapshotValues(profile: Profile, snapshot: Snapshot): Profile {
  const overlay = <P extends { id: string }, S extends { id: string }>(
    items: P[] | undefined,
    recorded: S[] | undefined,
    merge: (item: P, entry: S) => P,
  ): P[] | undefined => {
    if (!items) return items
    const entries = byId(recorded)
    return items.map((item) => {
      const entry = entries.get(item.id)
      return entry ? merge(item, entry) : item
    })
  }

  return {
    ...profile,
    cash_amount: snapshot.cash_amount ?? profile.cash_amount,
    investments: overlay(profile.investments, snapshot.investments, (i, e) => ({
      ...i,
      balance: e.balance,
    })),
    tangible_assets: overlay(profile.tangible_assets, snapshot.tangible_assets, (a, e) => ({
      ...a,
      value: e.value,
      // A fully owned asset has no debt to restore, and writing one back would
      // contradict its status. A financed one keeps its own balance when the
      // snapshot recorded none (it was owned outright on that date): the schema
      // requires a balance on a financed asset, so clearing it would fail the
      // write.
      outstanding_balance:
        a.status === 'financed'
          ? (e.outstanding_balance ?? a.outstanding_balance)
          : a.outstanding_balance,
    })),
    liabilities: overlay(profile.liabilities, snapshot.liabilities, (l, e) => ({
      ...l,
      outstanding_balance: e.outstanding_balance,
    })),
    incomes: overlay(profile.incomes, snapshot.incomes, (i, e) => ({
      ...i,
      amount: e.amount,
      frequency: e.frequency,
    })),
    expenses: overlay(profile.expenses, snapshot.expenses, (x, e) => ({
      ...x,
      amount: e.amount,
      frequency: e.frequency,
    })),
  }
}

/**
 * Attaches a new history to the profile, keeping the invariant the rest of the
 * app relies on: the profile holds the figures as they stood on its most recent
 * snapshot's date. `getCurrentProfile` projects forward from exactly that pair,
 * so a history whose newest entry disagrees with the profile would show the
 * dashboard compounding a value the user has already replaced.
 */
function withHistory(profile: Profile, snapshots: Snapshot[]): Profile {
  const latest = latestSnapshot(snapshots)
  return { ...(latest ? withSnapshotValues(profile, latest) : profile), snapshots }
}

/**
 * Records an edited or newly added snapshot. Pass `originalDate` when editing
 * one whose date the user changed, so the entry does not survive at both dates.
 */
export function withSavedSnapshot(
  profile: Profile,
  snapshot: Snapshot,
  originalDate?: string,
): Profile {
  const kept =
    originalDate && originalDate !== snapshot.date
      ? removeSnapshot(profile.snapshots, originalDate)
      : profile.snapshots
  return withHistory(profile, upsertSnapshot(kept, snapshot))
}

/**
 * Deletes the snapshot dated `date`. Deleting the most recent one rewinds the
 * profile's baseline to the one before it — the figures the user last recorded
 * that still stand.
 */
export function withDeletedSnapshot(profile: Profile, date: string): Profile {
  return withHistory(profile, removeSnapshot(profile.snapshots, date))
}

/**
 * Gives a profile that predates snapshots a single baseline dated `asOf` (the
 * last time its data was written). Without it, figures saved months ago would
 * read as confirmed-today: no staleness banner, no projection, and a History
 * chart with one point.
 *
 * Only a profile with no snapshot list at all is legacy data. An empty list is
 * one the user cleared on the History page, and seeding it back on the next
 * load would undo that — so it stays empty, and the figures count as current
 * until the next edit records a snapshot. Also a no-op when there are no
 * balances to record.
 */
export function withSeededSnapshot(profile: Profile, asOf: Date): Profile {
  if (profile.snapshots !== undefined) return profile
  if (!hasAnyBalance(heldBalances(profile, asOf))) return profile
  return { ...profile, snapshots: [captureSnapshot(profile, toDateOnlyString(asOf))] }
}
