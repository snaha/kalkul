<script lang="ts">
  import { locale } from 'svelte-i18n'

  import { daysBetween } from '$lib/@snaha/kalkul-maths'
  import { monthTicks, niceAxisBounds, yearBoundaries } from '$lib/chart-axis'
  import type { HistoryPoint } from '$lib/history-series'
  import { cn, parseDateOnly } from '$lib/utils'

  interface Props {
    points: HistoryPoint[]
    /** Y-axis labels — pass appStore.formatCompactCurrency (or similar). */
    formatValue: (value: number) => string
    /** Label for the trailing point, e.g. "Now". */
    nowLabel: string
    ariaLabel: string
    class?: string
  }

  let { points, formatValue, nowLabel, ariaLabel, class: className }: Props = $props()

  // Month names are translations, so the X-axis ticks follow the UI language
  // rather than the profile's number-formatting locale (which the caller's
  // `formatValue` resolves for the Y axis). Read here rather than passed in:
  // every chart labels its axis the same way, and a locale string has no
  // business travelling through props.
  const shortMonth = $derived(new Intl.DateTimeFormat($locale ?? undefined, { month: 'short' }))

  // Month ticks never carry a year: the year row under them does (#227).
  function formatMonth(date: string): string {
    return shortMonth.format(parseDateOnly(date))
  }

  // Geometry is computed in real pixels rather than a stretched viewBox so
  // strokes and dots keep their shape at any panel width.
  let plotWidth = $state(0)
  let plotHeight = $state(0)

  const DOT_SIZE = 8
  // Room for the "Now" label so a month tick can't collide with it.
  const NOW_LABEL_WIDTH = 40
  // Minimum gap between month labels; below it, labels are thinned rather
  // than allowed to overlap.
  const MIN_TICK_SPACING = 56
  // A year label stays clear of the plot's right edge by this much.
  const YEAR_LABEL_WIDTH = 32

  const bounds = $derived(niceAxisBounds(points.map((p) => p.netWorth)))

  const firstDate = $derived(points[0]?.date ?? '')
  const lastDate = $derived(points.at(-1)?.date ?? '')
  // A single point (or several recorded on one day) has no span to scale
  // against; pin it to the right edge where "Now" sits. The length guard keeps
  // an empty series out of `daysBetween`, whose NaN would poison every
  // position — the dashboard never passes one, but the component shouldn't
  // rely on that.
  const spanDays = $derived(points.length < 2 ? 0 : Math.max(daysBetween(firstDate, lastDate), 0))

  /** Horizontal position of a date as a fraction of the plot width. */
  function xFraction(date: string): number {
    if (spanDays === 0) return 1
    return daysBetween(firstDate, date) / spanDays
  }

  /** Vertical position of a value as a fraction of the plot height, top-down. */
  function yFraction(value: number): number {
    const span = bounds.max - bounds.min
    return span === 0 ? 1 : 1 - (value - bounds.min) / span
  }

  const plotted = $derived(
    points.map((point) => ({
      ...point,
      x: xFraction(point.date) * plotWidth,
      y: yFraction(point.netWorth) * plotHeight,
    })),
  )

  const baselineY = $derived(yFraction(0) * plotHeight)

  // The line is split at the last recorded point: everything up to it is drawn
  // solid over a filled area, and the projected tail continues as a bare dashed
  // stroke so an estimate never reads as recorded history.
  const lastActualIndex = $derived.by(() => {
    const index = plotted.findLastIndex((p) => !p.projected)
    return index === -1 ? 0 : index
  })
  const actualSegment = $derived(plotted.slice(0, lastActualIndex + 1))
  const projectedSegment = $derived(plotted.slice(lastActualIndex))

  const toLine = (segment: typeof plotted) =>
    segment.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Recorded points get a dot each, plus one for "now" at the end of the tail.
  // The samples in between describe the curve's shape, not moments worth
  // marking — a dot on each would read as eight more readings than were taken.
  const dots = $derived(
    plotted.filter((point, index) => !point.projected || index === plotted.length - 1),
  )

  const actualLine = $derived(actualSegment.length > 1 ? toLine(actualSegment) : '')
  const projectedLine = $derived(projectedSegment.length > 1 ? toLine(projectedSegment) : '')
  const areaPath = $derived(
    actualSegment.length > 1
      ? `${toLine(actualSegment)} L ${actualSegment.at(-1)?.x} ${baselineY} L ${actualSegment[0].x} ${baselineY} Z`
      : '',
  )

  /** Horizontal position of the middle of `date`'s month, as a fraction. */
  function midMonthFraction(date: string): number {
    const [year, month] = date.split('-').map(Number)
    const nextFirst =
      month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    return (xFraction(date) + xFraction(nextFirst)) / 2
  }

  // A month label sits in the middle of its month, so a year divider at
  // 1 January falls between December and January rather than through one.
  const monthLabels = $derived.by(() => {
    const ticks = monthTicks(firstDate, lastDate).map((date) => ({
      date,
      x: midMonthFraction(date) * plotWidth,
    }))
    // Two years of history would otherwise print 24 overlapping labels; keep
    // every Nth so whatever survives is legible at the current width.
    const gap = ticks.length > 1 ? ticks[1].x - ticks[0].x : plotWidth
    const stride = Math.max(1, Math.ceil(MIN_TICK_SPACING / Math.max(gap, 1)))
    return (
      ticks
        .filter((_, i) => i % stride === 0)
        // The trailing "Now" label owns the right edge.
        .filter((tick) => plotWidth - tick.x > NOW_LABEL_WIDTH)
    )
  })

  // The year row: every year the chart crosses into gets a divider at its
  // 1 January with its number centred under it. The starting year sits at the
  // left edge when there is room for it before the first divider.
  const yearLabels = $derived.by(() => {
    if (!firstDate) return []
    const crossed = yearBoundaries(firstDate, lastDate).map((date) => ({
      year: date.slice(0, 4),
      x: xFraction(date) * plotWidth,
      divider: true,
    }))
    const roomForFirst = (crossed[0]?.x ?? plotWidth) > YEAR_LABEL_WIDTH * 1.5
    const first = roomForFirst ? [{ year: firstDate.slice(0, 4), x: 0, divider: false }] : []
    return [...first, ...crossed].filter((label) => plotWidth - label.x > YEAR_LABEL_WIDTH / 2)
  })
</script>

<!-- The top padding leaves room for the topmost Y-axis label, which is centred
     on the first grid line and so sits half a line above the plot. -->
<div class={cn('flex flex-col gap-2 pt-[6px]', className)}>
  <div class="flex min-h-0 flex-1 gap-2">
    <!-- Y axis. Each label is centred on its own grid line rather than spread
         with justify-between, so the two can't drift apart. -->
    <div class="relative w-12 shrink-0">
      {#each bounds.ticks as tick, i (tick)}
        <span
          class="absolute right-0 -translate-y-1/2 text-xs leading-none text-muted-foreground"
          style:top="{((bounds.ticks.length - 1 - i) / Math.max(bounds.ticks.length - 1, 1)) *
            100}%"
        >
          {formatValue(tick)}
        </span>
      {/each}
    </div>

    <div
      class="relative min-w-0 flex-1"
      bind:clientWidth={plotWidth}
      bind:clientHeight={plotHeight}
      role="img"
      aria-label={ariaLabel}
    >
      <!-- Grid -->
      <div class="absolute inset-0 flex flex-col justify-between">
        {#each bounds.ticks as tick (tick)}
          <div class="h-0 border-t border-border"></div>
        {/each}
      </div>

      {#if plotWidth > 0 && plotHeight > 0}
        <svg class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          {#if areaPath}
            <path d={areaPath} class="fill-muted" />
          {/if}
          {#if actualLine}
            <path
              d={actualLine}
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              class="text-foreground"
            />
          {/if}
          {#if projectedLine}
            <path
              d={projectedLine}
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-dasharray="4 3"
              stroke-linejoin="round"
              class="text-foreground"
            />
          {/if}
        </svg>

        {#each dots as point (point.date)}
          <!-- Recorded points are solid; the projected "now" point is hollow -->
          <div
            class={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-foreground',
              point.projected ? 'bg-background' : 'bg-foreground',
            )}
            style:left="{point.x}px"
            style:top="{point.y}px"
            style:width="{DOT_SIZE}px"
            style:height="{DOT_SIZE}px"
          ></div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- X axis. The leading spacer mirrors the Y-axis column so tick positions
       line up with the plot they were measured against. -->
  <div class="flex h-4 gap-2 text-xs leading-none">
    <div class="w-12 shrink-0"></div>
    <div class="relative min-w-0 flex-1">
      {#each monthLabels as tick (tick.date)}
        <span
          class="absolute -translate-x-1/2 whitespace-nowrap text-muted-foreground"
          style:left="{tick.x}px">{formatMonth(tick.date)}</span
        >
      {/each}
      <span class="absolute right-0 whitespace-nowrap font-medium text-foreground">{nowLabel}</span>
    </div>
  </div>

  <!-- Year row. A divider rises between the month labels where each new year
       starts, with the year centred under it. -->
  <div class="mt-1 flex h-4 gap-2 text-xs leading-none text-muted-foreground">
    <div class="w-12 shrink-0"></div>
    <div class="relative min-w-0 flex-1">
      {#each yearLabels as label (label.year)}
        {#if label.divider}
          <span class="absolute -top-5 h-5 w-px bg-border" style:left="{label.x}px"></span>
        {/if}
        <span
          class={['absolute whitespace-nowrap', label.divider && '-translate-x-1/2']}
          style:left="{label.x}px">{label.year}</span
        >
      {/each}
    </div>
  </div>
</div>
