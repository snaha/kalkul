<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import ChartTooltipContent from '$lib/components/chart-tooltip-content.svelte'
  import StackedBarChart, {
    type BarData,
    type HoverPosition,
  } from '$lib/components/stacked-bar-chart.svelte'
  import * as Card from '$lib/components/ui/card'

  import { barCentreX, minStackedChartWidth } from './landing-chart-width'

  interface Props {
    data: BarData[]
    birthYear: number
    /** The year the panel shows before the visitor hovers anything. */
    initialYear: number
    formatCurrency: (value: number) => string
  }

  let { data, birthYear, initialYear, formatCurrency }: Props = $props()

  const CHART_HEIGHT = 300

  let hoveredYear = $state<number | undefined>(undefined)
  let viewportWidth = $state(0)
  let scroller = $state<HTMLDivElement | undefined>()
  let card = $state<HTMLDivElement | undefined>()

  // Where the tooltip sits while a bar is hovered, relative to the card, the
  // way the plan page positions its own: at the top of the bar, flipped to the
  // left once past the middle so it never leaves the card. Undefined between
  // hovers, when the tooltip parks in the chart's empty top-left corner.
  let hoverPosition = $state<{ left: number; top: number; isRightSide: boolean } | undefined>()
  let tooltipHeight = $state(0)

  // Below this the tooltip sits in the flow under the chart, where the
  // bar-relative offsets would push it about; matches the `md:` classes below.
  const FLOATING_QUERY = '(min-width: 48rem)'

  // The hovered year sticks: unlike the plan page's cursor-following tooltip,
  // this one is part of the panel's resting state, so mouse-leave only parks
  // it — the last year looked at stays on screen.
  const shownYear = $derived(hoveredYear ?? initialYear)
  const shownIndex = $derived.by(() => {
    const index = data.findIndex((bar) => bar.year === shownYear)
    return index === -1 ? 0 : index
  })
  const shown = $derived(data[shownIndex])

  const chartWidth = $derived(Math.max(viewportWidth, minStackedChartWidth(data.length)))
  const barCenter = $derived((index: number) => barCentreX(index, data.length, chartWidth))

  function handleYearHover(year: number | undefined, position?: HoverPosition): void {
    if (year === undefined || !position || !card) {
      hoverPosition = undefined
      return
    }
    hoveredYear = year
    if (!window.matchMedia(FLOATING_QUERY).matches) return
    const rect = card.getBoundingClientRect()
    const left = position.x - rect.left
    // Short bars sit low in the chart; kept above the card's bottom edge so the
    // breakdown never spills over the section below.
    const top = Math.min(position.y - rect.top, rect.height - tooltipHeight - 24)
    hoverPosition = { left, top, isRightSide: left > rect.width / 2 }
  }

  // Touch devices never fire mouseenter, so a tap has to select the year too.
  // No position: the parked tooltip is the one a phone shows anyway.
  function selectYear(year: number | undefined): void {
    if (year !== undefined) hoveredYear = year
  }

  // Narrow screens scroll the chart sideways; open on the year the tooltip is
  // already describing rather than on the far-left bars. Once only — scrolling
  // the chart out from under the visitor on every hover would be hostile.
  let centred = false
  $effect(() => {
    // viewportWidth is 0 until the container binds, and the chart is not in the
    // DOM before then — centring at that point would be clamped away to 0.
    if (centred || !scroller || viewportWidth <= 0) return
    if (scroller.scrollWidth <= scroller.clientWidth) return
    centred = true
    scroller.scrollLeft = Math.max(barCenter(shownIndex) - viewportWidth / 2, 0)
  })

  const legend = $derived([
    { id: 'cash', label: $_('page.plan.cash'), color: CATEGORY_COLORS.cash },
    {
      id: 'investments',
      label: $_('page.plan.investments'),
      color: CATEGORY_COLORS.investments[1],
    },
    {
      id: 'tangibleAssets',
      label: $_('page.plan.tangibleAssets'),
      color: CATEGORY_COLORS.tangibleAssets[2],
    },
    {
      id: 'liabilities',
      label: $_('page.plan.liabilities'),
      color: CATEGORY_COLORS.liabilities[0],
    },
  ])
</script>

<Card.Root bind:ref={card} class="relative gap-4 py-4 shadow-xs">
  <Card.Header class="gap-1 px-4">
    <Card.Title>{$_('page.landing.hero.chartTitle')}</Card.Title>
    <Card.Description>{$_('page.landing.hero.chartSubtitle')}</Card.Description>
  </Card.Header>

  <Card.Content class="flex flex-col gap-3 px-4">
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
      {#each legend as item (item.id)}
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-xs" style="background-color: {item.color}"></span>
          {item.label}
        </span>
      {/each}
    </div>

    <div class="overflow-x-auto" bind:this={scroller} bind:clientWidth={viewportWidth}>
      {#if viewportWidth > 0 && data.length > 0}
        <div style="width: {chartWidth}px; height: {CHART_HEIGHT}px">
          <StackedBarChart
            {data}
            hoveredYear={shownYear}
            width={chartWidth}
            height={CHART_HEIGHT}
            ariaLabel={$_('page.dashboard.projections.current.chartLabel')}
            onYearHover={handleYearHover}
            onYearClick={selectYear}
          />
        </div>
      {/if}
    </div>

    <!-- While a bar is hovered the breakdown follows it exactly as on the plan
         page; between hovers it parks in the chart's empty top-left corner with
         the last year still showing. It never takes the pointer, so the bars
         under it stay hoverable. Narrow screens put it below the chart instead,
         where it covers nothing. Same container as the plan page's tooltip. -->
    {#if shown}
      <div
        class="pointer-events-none rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-md md:absolute md:z-10 md:w-[320px]"
        class:md:top-28={!hoverPosition}
        class:md:left-4={!hoverPosition}
        bind:clientHeight={tooltipHeight}
        style:left={hoverPosition ? `${hoverPosition.left}px` : undefined}
        style:top={hoverPosition ? `${hoverPosition.top}px` : undefined}
        style:transform={hoverPosition
          ? hoverPosition.isRightSide
            ? 'translate(-100%, 0) translateY(8px)'
            : 'translateY(8px)'
          : undefined}
      >
        <ChartTooltipContent
          year={shown.year}
          age={shown.year - birthYear}
          netWorth={shown.cash + shown.investments + shown.tangibleAssets - shown.liabilities}
          cash={shown.cash}
          investments={shown.investments}
          tangibleAssets={shown.tangibleAssets}
          liabilities={shown.liabilities}
          {formatCurrency}
        />
      </div>
    {/if}
  </Card.Content>
</Card.Root>
