// Axis maths for the dashboard History chart. Kept out of the component so the
// tick arithmetic is unit-testable on its own.

export interface AxisBounds {
  min: number
  max: number
  ticks: number[]
}

// Mantissas that read as "round" on a money axis: 100, 200, 250, 500, 1000…
const NICE_MANTISSAS = [1, 2, 2.5, 5, 10]

/** Smallest round step (1/2/2.5/5 × a power of ten) that is at least `value`. */
function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const mantissa = value / magnitude
  const nice = NICE_MANTISSAS.find((m) => m >= mantissa) ?? 10
  return nice * magnitude
}

/** The next round step up from `step`, used to grow an axis that came up short. */
function nextNiceStep(step: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(step))
  const mantissa = step / magnitude
  const nice = NICE_MANTISSAS.find((m) => m > mantissa + Number.EPSILON)
  return nice === undefined ? 10 * magnitude : nice * magnitude
}

/**
 * A round value axis covering `values`, always anchored so that zero sits on a
 * tick — the History chart fills the area between the line and the baseline, so
 * a floating baseline would misread. Returns exactly `tickCount` ticks.
 */
export function niceAxisBounds(values: number[], tickCount = 5): AxisBounds {
  const intervals = Math.max(tickCount - 1, 1)
  // Zero is always in range: an all-positive series reads from the baseline up,
  // and a negative net worth needs the axis to reach below it.
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const span = hi - lo || Math.abs(hi) || 1

  let step = niceCeil(span / intervals)
  let min = Math.floor(lo / step) * step
  // Flooring `lo` can push the bottom down far enough that the fixed number of
  // intervals no longer reaches `hi`; widen the step until it does.
  while (min + step * intervals < hi) {
    step = nextNiceStep(step)
    min = Math.floor(lo / step) * step
  }

  const ticks = Array.from({ length: tickCount }, (_, i) => min + step * i)
  return { min, max: min + step * intervals, ticks }
}

/**
 * First-of-month dates within `[from, to]`, as date-only ISO strings. These are
 * the History chart's X-axis gridline labels.
 */
export function monthTicks(from: string, to: string): string[] {
  if (from > to) return []
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)

  const ticks: string[] = []
  let year = fromYear
  let month = fromMonth
  // A range starting mid-month has its first tick in the following month.
  if (from.slice(8) !== '01') {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  while (year < toYear || (year === toYear && month <= toMonth)) {
    ticks.push(`${year}-${String(month).padStart(2, '0')}-01`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return ticks
}
