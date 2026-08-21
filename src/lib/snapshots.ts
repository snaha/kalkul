import { hasAnyFinancialData } from '$lib/financial-totals'
import type {
  Expense,
  Income,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
  Snapshot,
} from '$lib/schemas'
import { toDateOnlyString } from '$lib/utils'

/**
 * Point-in-time record of a user's finances: every balance that makes up net
 * worth, plus the recurring cash flows that were running on the date.
 */
export function captureSnapshot(profile: Profile, date: string): Snapshot {
  return {
    date,
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

/** Mirrors `getNetWorth` for a recorded snapshot instead of the live profile. */
export function snapshotNetWorth(snapshot: Snapshot): number {
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
 * Adds `snapshot` to the list, replacing any existing entry with the same date
 * so a day's figures are recorded once. Returns a new, date-ascending list.
 */
export function upsertSnapshot(snapshots: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[] {
  const rest = (snapshots ?? []).filter((s) => s.date !== snapshot.date)
  return [...rest, snapshot].sort((a, b) => a.date.localeCompare(b.date))
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
 * Whether `next` holds the same figures `previous` recorded, ignoring their
 * dates. Used to skip recording a snapshot when an edit left every figure
 * untouched.
 *
 * A section `previous` never recorded is unknown, not zero, so it counts as no
 * evidence of a change. Without that, the first edit a returning user makes
 * after cash flows were added to the schema would compare a legacy snapshot
 * (which has none) against a fresh capture (which has them), decide something
 * moved, and stamp today's date onto months-old balances — silently clearing
 * the staleness banner the user never confirmed away.
 */
export function hasSameValues(previous: Snapshot | undefined, next: Snapshot | undefined): boolean {
  if (!previous || !next) return false
  const { date: _previousDate, ...recorded } = previous
  const { date: _nextDate, ...current } = next as Record<string, unknown>
  return Object.entries(recorded).every(
    ([section, value]) =>
      value === undefined || JSON.stringify(value) === JSON.stringify(current[section]),
  )
}

const byId = <T extends { id: string }>(items: T[] | undefined) =>
  new Map((items ?? []).map((item) => [item.id, item]))

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
            withhold_taxes: false,
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
      // contradict its status.
      outstanding_balance: a.status === 'financed' ? e.outstanding_balance : a.outstanding_balance,
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
 * A no-op once any snapshot exists, or when there are no balances to record.
 */
export function withSeededSnapshot(profile: Profile, asOf: Date): Profile {
  if ((profile.snapshots ?? []).length > 0) return profile
  if (!hasAnyFinancialData(profile)) return profile
  return { ...profile, snapshots: [captureSnapshot(profile, toDateOnlyString(asOf))] }
}
