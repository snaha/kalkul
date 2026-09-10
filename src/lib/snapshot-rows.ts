import { getFiPercent, getLiabilitiesTotal, getTotalAssets } from '$lib/financial-totals'
import type { Profile } from '$lib/schemas'
import { profileAtSnapshot, snapshotNetWorth } from '$lib/snapshots'

/** One row of the History page's Snapshots table. */
export interface SnapshotRow {
  /** Date-only ISO string (`YYYY-MM-DD`) — the row's identity. */
  date: string
  totalAssets: number
  liabilities: number
  netWorth: number
  /** Undefined when the recorded day had no outflows to measure against. */
  fiPercent: number | undefined
}

/**
 * Every recorded snapshot as a table row, newest first.
 *
 * Each row is derived from the profile *as it stood on that date* rather than
 * from today's figures, so a row reports the day it was taken: the assets owned
 * then, the debt outstanding then, and financial independence measured against
 * the outflows that were running then.
 *
 * Net worth is taken from the snapshot itself rather than through `getNetWorth`,
 * which filters by what the profile holds *today*: a position sold since would
 * otherwise be counted in the row's total assets and left out of its net worth,
 * so the row would not add up and would disagree with the point the chart plots
 * for the same date.
 */
export function buildSnapshotRows(profile: Profile): SnapshotRow[] {
  return (profile.snapshots ?? [])
    .map((snapshot) => {
      const at = profileAtSnapshot(profile, snapshot)
      return {
        date: snapshot.date,
        totalAssets: getTotalAssets(at),
        liabilities: getLiabilitiesTotal(at),
        netWorth: snapshotNetWorth(snapshot),
        fiPercent: getFiPercent(at),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
