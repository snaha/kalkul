import { addDays, daysBetween } from '$lib/@snaha/kalkul-maths'
import { getCurrentProfile } from '$lib/current-values'
import { getFiPercent, hasAnyFinancialData } from '$lib/financial-totals'
import { getRunwayYears } from '$lib/runway'
import { type Profile, type Snapshot, normalizeSnapshots } from '$lib/schemas'
import {
  type SnapshotTotals,
  captureSnapshot,
  profileAtSnapshot,
  snapshotNetWorth,
  snapshotTotals,
} from '$lib/snapshots'
import { parseDateOnly, toDateOnlyString } from '$lib/utils'

/** The figures the History chart reports for one date. */
export interface HistoryMetrics extends SnapshotTotals {
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
 * carry the balances alone, which is all the lines need.
 */
function metricsOn(profile: Profile, date: string, balancesOnly = false): HistoryMetrics {
  const current = getCurrentProfile(profile, parseDateOnly(date))
  const snapshot = captureSnapshot(current, date)
  const balances = { netWorth: snapshotNetWorth(snapshot), ...snapshotTotals(snapshot) }
  if (balancesOnly) return balances
  return { ...balances, runwayYears: getRunwayYears(current), fiPercent: getFiPercent(current) }
}

/** The figures as a snapshot recorded them. */
function metricsOf(profile: Profile, snapshot: Snapshot): HistoryMetrics {
  const then = profileAtSnapshot(profile, snapshot)
  return {
    netWorth: snapshotNetWorth(snapshot),
    ...snapshotTotals(snapshot),
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

/** How far back the History chart looks; `all` shows everything recorded. */
export type HistoryRange = 'all' | '1m' | '3m' | '6m' | '1y' | '2y'

const RANGE_MONTHS: Record<Exclude<HistoryRange, 'all'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
  '2y': 24,
}

/**
 * The points dated within `range` of `todayDate`, both ends included. The
 * series always ends on today, so a range is never empty.
 */
export function historyInRange(
  points: HistoryPoint[],
  range: HistoryRange,
  todayDate: string,
): HistoryPoint[] {
  if (range === 'all') return points
  const today = parseDateOnly(todayDate)
  // ponytail: a day the earlier month lacks (31 March less a month) rolls over
  // into the next one, a few days short of a full month; clamp if it matters.
  const cutoff = toDateOnlyString(
    new Date(today.getFullYear(), today.getMonth() - RANGE_MONTHS[range], today.getDate()),
  )
  return points.filter((point) => point.date >= cutoff)
}

/**
 * How much `value` moved between the first and the last point, as a percentage
 * of where it started. Undefined when it started at zero, or with no points:
 * there is nothing to measure a change against.
 */
export function historyChangePercent(
  points: HistoryPoint[],
  value: (point: HistoryPoint) => number,
): number | undefined {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return undefined
  const start = value(first)
  if (start === 0) return undefined
  // Against the magnitude, so a negative net worth climbing reads as a gain.
  return ((value(last) - start) / Math.abs(start)) * 100
}
