<script lang="ts">
  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import type { BarData } from '$lib/components/stacked-bar-chart.svelte'
  import { cn } from '$lib/utils'

  interface Props {
    data: BarData[]
    ariaLabel: string
    class?: string
  }

  let { data, ariaLabel, class: className }: Props = $props()

  // Decorative miniature of the full plan chart: same stacking and palette, no
  // axes, labels or interaction. Drawn in a fixed viewBox and stretched to the
  // card's thumbnail box.
  const WIDTH = 144
  const HEIGHT = 81
  // Matches BASELINE_RATIO in stacked-bar-chart so the two read alike.
  const BASELINE_Y = HEIGHT * 0.75

  const barWidth = $derived(data.length > 0 ? WIDTH / data.length : 0)

  const maxPositive = $derived(
    Math.max(...data.map((d) => d.cash + d.investments + d.tangibleAssets), 1),
  )
  const maxNegative = $derived(Math.max(...data.map((d) => d.liabilities), 1))

  const bars = $derived(
    data.map((d, i) => {
      const scaleUp = (value: number) => (value / maxPositive) * BASELINE_Y
      const tangibleAssets = scaleUp(d.tangibleAssets)
      const investments = scaleUp(d.investments)
      const cash = scaleUp(d.cash)
      const liabilities = (d.liabilities / maxNegative) * (HEIGHT - BASELINE_Y)
      const tangibleY = BASELINE_Y - tangibleAssets
      const investmentsY = tangibleY - investments
      return {
        x: i * barWidth,
        segments: [
          { id: 'cash', y: investmentsY - cash, height: cash, color: CATEGORY_COLORS.cash },
          {
            id: 'investments',
            y: investmentsY,
            height: investments,
            color: CATEGORY_COLORS.investments[1],
          },
          {
            id: 'tangibleAssets',
            y: tangibleY,
            height: tangibleAssets,
            color: CATEGORY_COLORS.tangibleAssets[2],
          },
          {
            id: 'liabilities',
            y: BASELINE_Y,
            height: liabilities,
            color: CATEGORY_COLORS.liabilities[0],
          },
        ].filter((segment) => segment.height > 0),
      }
    }),
  )
</script>

<svg
  class={cn('h-full w-full', className)}
  viewBox="0 0 {WIDTH} {HEIGHT}"
  preserveAspectRatio="none"
  role="img"
  aria-label={ariaLabel}
>
  {#each bars as bar, i (i)}
    {#each bar.segments as segment (segment.id)}
      <rect x={bar.x} y={segment.y} width={barWidth} height={segment.height} fill={segment.color} />
    {/each}
  {/each}
</svg>
