<script lang="ts" module>
  export type BarData = {
    year: number
    cash: number
    investments: number
    tangibleAssets: number
    liabilities: number // Positive number, rendered as negative
  }

  export type HoverPosition = {
    x: number
    y: number
    barCenterX: number
  }

  /**
   * Creates an SVG path for a rectangle with optional rounded corners
   * on top and/or bottom
   */
  function createRoundedRectPath(
    x: number,
    y: number,
    width: number,
    height: number,
    topRadius: number,
    bottomRadius: number,
  ): string {
    // Clamp radii to half the height to prevent overlap
    const maxRadius = height / 2
    const tr = Math.min(topRadius, maxRadius)
    const br = Math.min(bottomRadius, maxRadius)

    if (tr === 0 && br === 0) {
      // No rounding, simple rectangle
      return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`
    }

    // Path with rounded corners
    return [
      // Start at top-left (after top-left corner)
      `M ${x + tr} ${y}`,
      // Top edge to top-right corner
      `h ${width - tr * 2}`,
      // Top-right corner
      tr > 0 ? `a ${tr} ${tr} 0 0 1 ${tr} ${tr}` : '',
      // Right edge to bottom-right corner
      `v ${height - tr - br}`,
      // Bottom-right corner
      br > 0 ? `a ${br} ${br} 0 0 1 ${-br} ${br}` : '',
      // Bottom edge to bottom-left corner
      `h ${-(width - br * 2)}`,
      // Bottom-left corner
      br > 0 ? `a ${br} ${br} 0 0 1 ${-br} ${-br}` : '',
      // Left edge to top-left corner
      `v ${-(height - tr - br)}`,
      // Top-left corner
      tr > 0 ? `a ${tr} ${tr} 0 0 1 ${tr} ${-tr}` : '',
      // Close path
      'Z',
    ]
      .filter(Boolean)
      .join(' ')
  }
</script>

<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import * as Tooltip from '$lib/components/ui/tooltip'

  type Props = {
    data: BarData[]
    selectedYear?: number
    hoveredYear?: number
    height?: number
    width?: number
    ariaLabel?: string
    showSelectedIndicator?: boolean
    // First year in the projection where the calculation surfaced an
    // insufficient-funds warning. Marked with a destructive triangle below the
    // corresponding bar so the user can spot when things start going wrong.
    firstErrorYear?: number
    firstErrorTooltip?: string
    onYearClick?: (year: number) => void
    onYearHover?: (year: number | undefined, position?: HoverPosition) => void
  }

  const {
    data,
    selectedYear,
    hoveredYear,
    height = 284,
    width,
    ariaLabel,
    showSelectedIndicator = true,
    firstErrorYear,
    firstErrorTooltip,
    onYearClick,
    onYearHover,
  }: Props = $props()

  let svgElement: SVGSVGElement | undefined = $state()

  // Chart layout constants
  const MIN_BAR_WIDTH = 14
  const BAR_GAP = 4
  const PADDING_LEFT = 21
  const PADDING_RIGHT = 8
  const PADDING_TOP = 20
  const PADDING_BOTTOM = 20
  const CORNER_RADIUS = 2
  const GRID_LINE_COUNT = 5

  // Calculate the baseline position (where positive/negative values meet)
  // Baseline is positioned so roughly 25% of chart is for liabilities (below baseline)
  const BASELINE_RATIO = 0.75

  // Derived values
  const chartHeight = $derived(height - PADDING_TOP - PADDING_BOTTOM)
  const positiveHeight = $derived(chartHeight * BASELINE_RATIO)
  const negativeHeight = $derived(chartHeight * (1 - BASELINE_RATIO))
  const baselineY = $derived(PADDING_TOP + positiveHeight)

  // Use provided width or calculate minimum based on data
  const minChartWidth = $derived(
    PADDING_LEFT + data.length * (MIN_BAR_WIDTH + BAR_GAP) - BAR_GAP + PADDING_RIGHT,
  )
  const chartWidth = $derived(width ? Math.max(width, minChartWidth) : minChartWidth)

  // Calculate dynamic bar width to fill available space
  const barWidth = $derived.by(() => {
    if (data.length === 0) return MIN_BAR_WIDTH
    const availableWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT
    const totalGapWidth = (data.length - 1) * BAR_GAP
    const calculatedWidth = (availableWidth - totalGapWidth) / data.length
    return Math.max(calculatedWidth, MIN_BAR_WIDTH)
  })

  // Scale corner radius with bar width
  const cornerRadius = $derived(Math.min(CORNER_RADIUS, barWidth / 4))

  // Find max values for scaling
  const maxPositive = $derived.by(() => {
    if (data.length === 0) return 1
    const max = Math.max(
      ...data.map((d) => d.cash + d.investments + d.tangibleAssets),
      1, // Ensure at least 1 to avoid division by zero
    )
    return max
  })

  const maxNegative = $derived.by(() => {
    if (data.length === 0) return 1
    const max = Math.max(...data.map((d) => d.liabilities), 1)
    return max
  })

  // Scale functions
  const scalePositive = $derived((value: number) => (value / maxPositive) * positiveHeight)
  const scaleNegative = $derived((value: number) => (value / maxNegative) * negativeHeight)

  // Generate bar segments for each data point
  const bars = $derived.by(() => {
    return data.map((d, i) => {
      const x = PADDING_LEFT + i * (barWidth + BAR_GAP)
      const isSelected = d.year === selectedYear

      // Calculate heights for each segment
      const cashHeight = scalePositive(d.cash)
      const investmentsHeight = scalePositive(d.investments)
      const tangibleAssetsHeight = scalePositive(d.tangibleAssets)
      const liabilitiesHeight = scaleNegative(d.liabilities)

      // Calculate Y positions (stacking from baseline up, liabilities down)
      // Order from bottom to top of positive stack: tangibleAssets, investments, cash
      const tangibleAssetsY = baselineY - tangibleAssetsHeight
      const investmentsY = tangibleAssetsY - investmentsHeight
      const cashY = investmentsY - cashHeight
      const liabilitiesY = baselineY

      return {
        year: d.year,
        x,
        isSelected,
        isHovered: d.year === hoveredYear,
        segments: [
          // Cash (top of positive stack)
          {
            id: 'cash',
            y: cashY,
            height: cashHeight,
            color: CATEGORY_COLORS.cash,
            roundTop: true,
            roundBottom: false,
          },
          // Investments
          {
            id: 'investments',
            y: investmentsY,
            height: investmentsHeight,
            color: CATEGORY_COLORS.investments[1],
            roundTop: false,
            roundBottom: false,
          },
          // Tangible Assets
          {
            id: 'tangibleAssets',
            y: tangibleAssetsY,
            height: tangibleAssetsHeight,
            color: CATEGORY_COLORS.tangibleAssets[2],
            roundTop: false,
            roundBottom: d.liabilities === 0, // Round if no liabilities
          },
          // Liabilities (below baseline)
          {
            id: 'liabilities',
            y: liabilitiesY,
            height: liabilitiesHeight,
            color: CATEGORY_COLORS.liabilities[0],
            roundTop: false,
            roundBottom: true,
          },
        ].filter((s) => s.height > 0), // Only render segments with height
      }
    })
  })

  // Grid lines positions
  const gridLines = $derived.by(() => {
    const lines: number[] = []
    for (let i = 0; i < GRID_LINE_COUNT; i++) {
      // Position grid lines evenly across the chart area
      // One line at baseline (position 3 of 5)
      const y = PADDING_TOP + (i / (GRID_LINE_COUNT - 1)) * chartHeight
      lines.push(y)
    }
    return lines
  })

  // Find the bar data for the hovered year to draw the indicator line
  const hoveredBar = $derived(bars.find((b) => b.year === hoveredYear))

  // Find the bar data for the selected year to draw the solid indicator line
  const selectedBar = $derived(bars.find((b) => b.year === selectedYear))

  // Bar to anchor the error triangle to.
  const firstErrorBar = $derived(bars.find((b) => b.year === firstErrorYear))

  function handleBarClick(year: number) {
    onYearClick?.(year)
  }

  function handleKeyDown(event: KeyboardEvent, year: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleBarClick(year)
    }
  }

  function handleBarMouseEnter(bar: (typeof bars)[number]) {
    if (!svgElement || !onYearHover) return

    // Get SVG bounding rect for coordinate conversion
    const svgRect = svgElement.getBoundingClientRect()
    const viewBox = svgElement.viewBox.baseVal

    // Calculate scale factors between viewBox and actual rendered size
    const scaleX = svgRect.width / viewBox.width
    const scaleY = svgRect.height / viewBox.height

    // Find the top of the bar (minimum y of all segments)
    const barTopY = bar.segments.length > 0 ? Math.min(...bar.segments.map((s) => s.y)) : baselineY

    // Convert SVG coordinates to page coordinates
    const barCenterX = bar.x + barWidth / 2
    const pageX = svgRect.left + barCenterX * scaleX
    const pageY = svgRect.top + barTopY * scaleY

    onYearHover(bar.year, {
      x: pageX,
      y: pageY,
      barCenterX: barCenterX,
    })
  }

  function handleBarMouseLeave() {
    onYearHover?.(undefined)
  }
</script>

<svg
  bind:this={svgElement}
  class="h-full w-full"
  viewBox="0 0 {chartWidth} {height}"
  preserveAspectRatio="xMidYMid meet"
  role="img"
  aria-label={ariaLabel}
>
  <!-- Grid lines -->
  {#each gridLines as y, i (i)}
    <line
      x1={PADDING_LEFT - 4}
      y1={y}
      x2={chartWidth - PADDING_RIGHT}
      y2={y}
      stroke="currentColor"
      stroke-dasharray="4 4"
      class="text-border"
      stroke-width="1"
    />
  {/each}

  <!-- Vertical axis line -->
  <line
    x1={PADDING_LEFT - 4}
    y1={PADDING_TOP}
    x2={PADDING_LEFT - 4}
    y2={height - PADDING_BOTTOM}
    stroke="currentColor"
    class="text-border"
    stroke-width="1"
  />

  <!-- Bars -->
  {#each bars as bar (bar.year)}
    <g
      class="cursor-pointer transition-opacity focus:outline-none"
      class:opacity-60={hoveredYear !== undefined && bar.year === hoveredYear}
      role="button"
      tabindex="0"
      onclick={() => handleBarClick(bar.year)}
      onkeydown={(e) => handleKeyDown(e, bar.year)}
      onmouseenter={() => handleBarMouseEnter(bar)}
      onmouseleave={handleBarMouseLeave}
      onfocus={() => handleBarMouseEnter(bar)}
      onblur={handleBarMouseLeave}
      aria-label="Year {bar.year}"
    >
      <!-- Invisible hit area to prevent tooltip flashing between bars -->
      <rect
        x={bar.x - BAR_GAP / 2}
        y={PADDING_TOP}
        width={barWidth + BAR_GAP}
        height={chartHeight}
        fill="transparent"
      />
      {#each bar.segments as segment (segment.id)}
        {#if segment.roundTop || segment.roundBottom}
          <!-- Use path for rounded corners -->
          <path
            d={createRoundedRectPath(
              bar.x,
              segment.y,
              barWidth,
              segment.height,
              segment.roundTop ? cornerRadius : 0,
              segment.roundBottom ? cornerRadius : 0,
            )}
            fill={segment.color}
          />
        {:else}
          <!-- Use rect for non-rounded segments -->
          <rect
            x={bar.x}
            y={segment.y}
            width={barWidth}
            height={segment.height}
            fill={segment.color}
          />
        {/if}
      {/each}
    </g>
  {/each}

  <!-- Vertical dashed indicator line for hovered bar -->
  {#if hoveredBar}
    <line
      x1={hoveredBar.x + barWidth / 2}
      y1={height - 2}
      x2={hoveredBar.x + barWidth / 2}
      y2={2}
      stroke="currentColor"
      stroke-dasharray="2 2"
      class="text-muted-foreground pointer-events-none"
      stroke-width="1"
    />
  {/if}

  <!-- Vertical solid indicator line for selected bar -->
  {#if selectedBar && showSelectedIndicator}
    <line
      x1={selectedBar.x + barWidth / 2}
      y1={height - 2}
      x2={selectedBar.x + barWidth / 2}
      y2={2}
      stroke="currentColor"
      class="text-muted-foreground pointer-events-none"
      stroke-width="1"
    />
  {/if}

  <!-- First-error marker: a destructive triangle in the bottom padding strip,
       centred on the bar of the first year that surfaced a warning. -->
  {#if firstErrorBar}
    <foreignObject
      x={firstErrorBar.x + barWidth / 2 - 8}
      y={height - PADDING_BOTTOM + 2}
      width="16"
      height="16"
      class="pointer-events-auto"
    >
      <Tooltip.Provider delayDuration={150}>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <div
                {...props}
                aria-label={firstErrorTooltip}
                class="flex size-4 items-center justify-center text-destructive"
              >
                <TriangleAlert class="size-4" />
              </div>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>{firstErrorTooltip}</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </foreignObject>
  {/if}
</svg>
