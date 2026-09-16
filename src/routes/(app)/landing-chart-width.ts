/**
 * The narrowest `stacked-bar-chart` will draw a given number of bars at.
 *
 * The component clamps its own bar width at a minimum and then scales the
 * whole SVG to whatever box it is given, so a box narrower than this makes the
 * chart shrink vertically and float in white space. The landing passes this
 * width to the element around the chart instead, which turns the shortfall
 * into sideways scrolling and keeps the bars at full size.
 *
 * Mirrors the constants in `src/lib/components/stacked-bar-chart.svelte`.
 */
const MIN_BAR_WIDTH = 14
const BAR_GAP = 4
const PADDING_LEFT = 21
const PADDING_RIGHT = 8

export function minStackedChartWidth(barCount: number): number {
  if (barCount <= 0) return PADDING_LEFT + PADDING_RIGHT
  return PADDING_LEFT + barCount * (MIN_BAR_WIDTH + BAR_GAP) - BAR_GAP + PADDING_RIGHT
}

/** Centre of the `index`-th bar in a chart drawn at `chartWidth`. */
export function barCentreX(index: number, barCount: number, chartWidth: number): number {
  if (barCount <= 0) return PADDING_LEFT
  const available = chartWidth - PADDING_LEFT - PADDING_RIGHT - (barCount - 1) * BAR_GAP
  const barWidth = Math.max(available / barCount, MIN_BAR_WIDTH)
  return PADDING_LEFT + index * (barWidth + BAR_GAP) + barWidth / 2
}
