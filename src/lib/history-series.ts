import { addDays, daysBetween } from '$lib/@snaha/kalkul-maths'
import { getCurrentProfile } from '$lib/current-values'
import { hasAnyFinancialData } from '$lib/financial-totals'
import { type Profile, normalizeSnapshots } from '$lib/schemas'
import { captureSnapshot, snapshotNetWorth } from '$lib/snapshots'
import { parseDateOnly, toDateOnlyString } from '$lib/utils'

export interface HistoryPoint {
  /** Date-only ISO string (`YYYY-MM-DD`). */
  date: string
  netWorth: number
  /**
   * True for points carried forward from the most recent snapshot rather than
   * recorded by the user. The History chart draws them as a dashed tail.
   */
  projected: boolean
}

/**
 * How many samples the projected tail is drawn with. Investments compound and
 * cash accrues, so the tail is a curve; a single segment to today would draw it
 * as a straight line and read as though nothing happened in between. Eight is
 * enough for the curve to be legible in a panel-width chart without running the
 * projection more times than it is worth.
 */
const PROJECTED_SAMPLES = 8

/** Net worth as the balances stand on `date`, projected from the last snapshot. */
function netWorthOn(profile: Profile, date: string): number {
  return snapshotNetWorth(captureSnapshot(getCurrentProfile(profile, parseDateOnly(date)), date))
}

/**
 * Net worth over time for the History chart: one point per recorded snapshot,
 * then a sampled projection running from the last of them to today.
 *
 * Pass the *stored* profile — the one holding balances as of its latest
 * snapshot. Each projected sample is computed by carrying those balances
 * forward to that sample's date, so the tail follows the same model the
 * dashboard's headline figures come from.
 *
 * The history is normalized here rather than assumed sorted: the last recorded
 * point is the baseline the projected tail runs from, so a hand-edited backup
 * or a file from another tool listing its snapshots out of order would
 * otherwise project from the wrong one and draw the area path zig-zagging back
 * through time.
 */
export function buildHistorySeries(profile: Profile, today: Date): HistoryPoint[] {
  const snapshots = normalizeSnapshots(profile.snapshots ?? [])
  if (snapshots.length === 0 && !hasAnyFinancialData(profile)) return []

  const todayDate = toDateOnlyString(today)
  const points: HistoryPoint[] = snapshots
    .filter((snapshot) => snapshot.date <= todayDate)
    .map((snapshot) => ({
      date: snapshot.date,
      netWorth: snapshotNetWorth(snapshot),
      projected: false,
    }))

  const lastRecorded = points.at(-1)?.date
  if (lastRecorded === todayDate) return points

  // No history to project from: today's balances are simply what they are.
  if (lastRecorded === undefined) {
    return [{ date: todayDate, netWorth: netWorthOn(profile, todayDate), projected: false }]
  }

  // At most one sample a day, so a tail spanning a couple of days doesn't
  // repeat the same date.
  const elapsed = daysBetween(lastRecorded, todayDate)
  const samples = Math.min(PROJECTED_SAMPLES, elapsed)
  for (let sample = 1; sample <= samples; sample++) {
    const date = addDays(lastRecorded, Math.round((elapsed * sample) / samples))
    points.push({ date, netWorth: netWorthOn(profile, date), projected: true })
  }
  return points
}
