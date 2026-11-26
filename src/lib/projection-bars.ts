import type { BarData } from '$lib/components/stacked-bar-chart.svelte'
import type { YearlyProjection } from '$lib/plan-projection'

/**
 * A projection as chart bars. With `endYear`, a projection that stopped early
 * (see `projectionStopYear`) is padded with empty bars up to that year, so the
 * chart keeps the plan's whole time span and the stop shows as a gap.
 */
export function projectionBars(years: YearlyProjection[], endYear?: number): BarData[] {
  const bars: BarData[] = years.map((year) => ({
    year: year.year,
    cash: year.cash,
    investments: year.investments,
    tangibleAssets: year.tangibleAssets,
    liabilities: year.liabilities,
  }))
  const last = bars.at(-1)
  if (last === undefined || endYear === undefined) return bars
  for (let year = last.year + 1; year <= endYear; year++) {
    bars.push({ year, cash: 0, investments: 0, tangibleAssets: 0, liabilities: 0 })
  }
  return bars
}
