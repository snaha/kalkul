import { hasAnyFinancialData } from '$lib/financial-totals'
import type { Profile, Snapshot } from '$lib/schemas'
import { toDateOnlyString } from '$lib/utils'

/** Point-in-time record of every balance that makes up net worth. */
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
 * so a day's balances are recorded once. Returns a new, date-ascending list.
 */
export function upsertSnapshot(snapshots: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[] {
  const rest = (snapshots ?? []).filter((s) => s.date !== snapshot.date)
  return [...rest, snapshot].sort((a, b) => a.date.localeCompare(b.date))
}

export function latestSnapshot(snapshots: Snapshot[] | undefined): Snapshot | undefined {
  if (!snapshots || snapshots.length === 0) return undefined
  return snapshots.reduce((latest, s) => (s.date > latest.date ? s : latest))
}

/**
 * Whether two snapshots hold identical balances, ignoring their dates. Used to
 * skip recording a snapshot when an edit left every balance untouched.
 */
export function hasSameBalances(a: Snapshot | undefined, b: Snapshot | undefined): boolean {
  if (!a || !b) return false
  const balances = ({ date: _date, ...rest }: Snapshot) => JSON.stringify(rest)
  return balances(a) === balances(b)
}

/**
 * Gives a profile that predates snapshots a single baseline dated `asOf` (the
 * last time its data was written). Without it, balances saved months ago would
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
