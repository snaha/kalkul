/** How a figure moved against the year before. */
export interface YearChange {
  /** This year minus the previous one. */
  delta: number
  /**
   * The delta as a percent of the previous year's magnitude, so a figure that
   * climbs from −200 to −100 reads +50%. Undefined when the previous year was
   * 0, where no percentage means anything.
   */
  percent?: number
}

/** Undefined when there is no year to compare with. */
export function yearChange(current: number, previous: number | undefined): YearChange | undefined {
  if (previous === undefined) return undefined
  const delta = current - previous
  if (previous === 0) return { delta }
  return { delta, percent: (delta / Math.abs(previous)) * 100 }
}
