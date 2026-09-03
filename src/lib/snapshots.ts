import { type Profile, type Snapshot, normalizeSnapshots } from '$lib/schemas'
import { toDateOnlyString } from '$lib/utils'

/**
 * The balances a snapshot records, without the date it was recorded on. Net
 * worth, "did anything move?" and "is there anything to record?" are all
 * questions about the balances alone.
 */
export type SnapshotBalances = Omit<Snapshot, 'date'>

/** Every balance that makes up net worth, as it stands on `profile`. */
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

/** Point-in-time record of every balance that makes up net worth. */
export function captureSnapshot(profile: Profile, date: string): Snapshot {
  return { date, ...snapshotBalances(profile) }
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
 * so a day's balances are recorded once. Returns a new, date-ascending list.
 */
export function upsertSnapshot(snapshots: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[] {
  // Last entry wins on a shared date, so appending is what replaces.
  return normalizeSnapshots([...(snapshots ?? []), snapshot])
}

export function latestSnapshot(snapshots: Snapshot[] | undefined): Snapshot | undefined {
  if (!snapshots || snapshots.length === 0) return undefined
  return snapshots.reduce((latest, s) => (s.date > latest.date ? s : latest))
}

function sameItems<T>(
  a: T[] | undefined,
  b: T[] | undefined,
  same: (x: T, y: T) => boolean,
): boolean {
  const left = a ?? []
  const right = b ?? []
  return left.length === right.length && left.every((item, i) => same(item, right[i]))
}

/**
 * Whether two snapshots hold identical balances, ignoring their dates. Used to
 * skip recording a snapshot when an edit left every balance untouched.
 *
 * Compared field by field rather than by serialized shape: only `captureSnapshot`
 * emits the canonical form, while the schema makes every balance field
 * optional, so a snapshot restored from a backup can legitimately omit a value
 * that is simply zero or an empty list. Reading those omissions as "changed"
 * made a rename record a snapshot and re-date the projection baseline.
 *
 * Items are matched positionally, as they were before: both sides are captured
 * from the same profile's lists, which an edit rebuilds in order.
 */
export function hasSameBalances(
  a: SnapshotBalances | undefined,
  b: SnapshotBalances | undefined,
): boolean {
  if (!a || !b) return false
  if ((a.cash_amount ?? 0) !== (b.cash_amount ?? 0)) return false
  if (!sameItems(a.investments, b.investments, (x, y) => x.id === y.id && x.balance === y.balance))
    return false
  if (
    !sameItems(
      a.tangible_assets,
      b.tangible_assets,
      (x, y) =>
        x.id === y.id &&
        x.value === y.value &&
        (x.outstanding_balance ?? 0) === (y.outstanding_balance ?? 0),
    )
  )
    return false
  return sameItems(
    a.liabilities,
    b.liabilities,
    (x, y) => x.id === y.id && x.outstanding_balance === y.outstanding_balance,
  )
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
  const balances = snapshotBalances(profile)
  if (!hasAnyBalance(balances)) return profile
  return { ...profile, snapshots: [{ date: toDateOnlyString(asOf), ...balances }] }
}
