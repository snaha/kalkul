import { addDays, daysBetween } from '$lib/@snaha/kalkul-maths'
import { getCurrentProfile } from '$lib/current-values'
import { getFiPercent, hasAnyFinancialData } from '$lib/financial-totals'
import { getRunwayYears } from '$lib/runway'
import { type Profile, type Snapshot, normalizeSnapshots } from '$lib/schemas'
import { captureSnapshot, profileAtSnapshot, snapshotNetWorth } from '$lib/snapshots'
import { parseDateOnly, toDateOnlyString } from '$lib/utils'

/** The figures the History chart reports for one date. */
export interface HistoryMetrics {
  netWorth: number
  /** Undefined with nothing to pay; `Infinity` past the runway cap. */
  runwayYears?: number
  /** Undefined with nothing to pay. */
  fiPercent?: number
}

export interface HistoryPoint extends HistoryMetrics {
  /** Date-only ISO string (`YYYY-MM-DD`). */
  date: string
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

/**
 * The figures as the balances stand on `date`, projected from the last
 * snapshot. Only the last sample of the tail is ever shown, so the others
 * carry the net worth alone, which is all the line needs.
 */
function metricsOn(profile: Profile, date: string, netWorthOnly = false): HistoryMetrics {
  const current = getCurrentProfile(profile, parseDateOnly(date))
  const netWorth = snapshotNetWorth(captureSnapshot(current, date))
  if (netWorthOnly) return { netWorth }
  return { netWorth, runwayYears: getRunwayYears(current), fiPercent: getFiPercent(current) }
}

/** The figures as a snapshot recorded them. */
function metricsOf(profile: Profile, snapshot: Snapshot): HistoryMetrics {
  const then = profileAtSnapshot(profile, snapshot)
  return {
    netWorth: snapshotNetWorth(snapshot),
    runwayYears: getRunwayYears(then),
    fiPercent: getFiPercent(then),
  }
}

/**
 * Whether there is a History to show at all: figures on the profile, or dates
 * recorded for figures it no longer has.
 *
 * A profile that spent its way to zero has no balances left but a history worth
 * reading — the drop to zero is recorded deliberately — so gating on balances
 * alone would make it unreachable at exactly the moment it became interesting.
 */
export function hasHistoryToShow(profile: Profile): boolean {
  return hasAnyFinancialData(profile) || (profile.snapshots ?? []).length > 0
}

/**
 * Net worth, runway and FI over time for the History chart: one point per
 * recorded snapshot, then a sampled projection running from the last of them
 * to today.
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
  if (!hasHistoryToShow(profile)) return []
  const snapshots = normalizeSnapshots(profile.snapshots ?? [])

  const todayDate = toDateOnlyString(today)
  const points: HistoryPoint[] = []
  const push = (date: string, metrics: HistoryMetrics, projected: boolean) => {
    points.push({ date, ...metrics, projected })
  }

  for (const snapshot of snapshots) {
    if (snapshot.date <= todayDate) push(snapshot.date, metricsOf(profile, snapshot), false)
  }

  const lastRecorded = points.at(-1)?.date
  if (lastRecorded === todayDate) return points

  // No history to project from: today's balances are simply what they are.
  if (lastRecorded === undefined) {
    push(todayDate, metricsOn(profile, todayDate), false)
    return points
  }

  // At most one sample a day, so a tail spanning a couple of days doesn't
  // repeat the same date.
  const elapsed = daysBetween(lastRecorded, todayDate)
  const samples = Math.min(PROJECTED_SAMPLES, elapsed)
  for (let sample = 1; sample <= samples; sample++) {
    const date = addDays(lastRecorded, Math.round((elapsed * sample) / samples))
    push(date, metricsOn(profile, date, sample < samples), true)
  }
  return points
}
