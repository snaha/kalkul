import { getFiPercent, getNetWorth, getSavingsRate } from '$lib/financial-totals'
import { getRunwayYears } from '$lib/runway'
import { type Profile, normalizeSnapshots } from '$lib/schemas'
import { profileAtSnapshot, snapshotNetWorth } from '$lib/snapshots'

/**
 * How each dashboard headline moved since the user's previous update: today's
 * figure less the same figure as it stood on the snapshot before the latest
 * one. A figure is undefined when either side has nothing to compare (no
 * expenses recorded then, no income now, ...).
 */
export interface MetricChanges {
  /** Date of the snapshot the changes are measured from. */
  since: string
  /** In the profile's currency. */
  netWorth?: number
  /** In percentage points. */
  savingsRate?: number
  runwayYears?: number
  /** In percentage points. */
  fiPercent?: number
}

/**
 * `current − previous`, rounded to the precision the dashboard shows the
 * change at, so a sub-unit move reads as unchanged rather than as "+0".
 * Runway can be `Infinity` on either side: still infinite is no change, and
 * a jump to or from infinite has no finite size to show.
 */
function diff(
  previous: number | undefined,
  current: number | undefined,
  decimals: number,
): number | undefined {
  if (previous === undefined || current === undefined) return undefined
  if (previous === current) return 0
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return undefined
  const scale = 10 ** decimals
  // `+ 0` turns the -0 a tiny negative rounds to into plain 0.
  return Math.round((current - previous) * scale) / scale + 0
}

/**
 * Pass the *stored* profile (balances as of its latest snapshot) and the
 * *current* one (those balances carried forward to today) — the same pair the
 * dashboard already works from. Undefined until there are two snapshots.
 */
export function getMetricChanges(
  stored: Profile,
  current: Profile,
  todayDate: string,
): MetricChanges | undefined {
  const previous = normalizeSnapshots(stored.snapshots ?? [])
    .filter((snapshot) => snapshot.date <= todayDate)
    .at(-2)
  if (!previous) return undefined
  const baseline = profileAtSnapshot(stored, previous)
  return {
    since: previous.date,
    netWorth: diff(snapshotNetWorth(previous), getNetWorth(current), 0),
    savingsRate: diff(getSavingsRate(baseline)?.percent, getSavingsRate(current)?.percent, 0),
    runwayYears: diff(getRunwayYears(baseline), getRunwayYears(current), 1),
    fiPercent: diff(getFiPercent(baseline), getFiPercent(current), 0),
  }
}
