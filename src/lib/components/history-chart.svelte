<script lang="ts" module>
  /**
   * What the chart plots: net worth, the assets stacked by category, or one
   * category on its own.
   */
  export type HistoryView =
    | 'netWorth'
    | 'breakdown'
    | 'cash'
    | 'investments'
    | 'tangibleAssets'
    | 'liabilities'
</script>

<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { daysBetween } from '$lib/@snaha/kalkul-maths'
  import { labelsWithYear, monthTicks, niceAxisBounds } from '$lib/chart-axis'
  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import type { HistoryPoint } from '$lib/history-series'
  import { RUNWAY_CAP_YEARS } from '$lib/runway'
  import { cn, parseDateOnly } from '$lib/utils'

  interface Props {
    points: HistoryPoint[]
    view?: HistoryView
    /** Y-axis labels — pass appStore.formatCompactCurrency (or similar). */
    formatValue: (value: number) => string
    /** Tooltip amounts, in full — pass appStore.formatCurrency. */
    formatAmount: (value: number) => string
    formatDate: (date: string) => string
    formatPercent: (value: number, digits: number) => string
    formatNumber: (value: number) => string
    /** Label for the trailing point, e.g. "Now". */
    nowLabel: string
    ariaLabel: string
    /** Called with a recorded point's date when its dot is clicked. */
    onSelect?: (date: string) => void
    /**
     * Called when the projected "now" dot is clicked — the estimate for a day
     * with no snapshot yet — so the caller can offer to record one.
     */
    onAdd?: () => void
    class?: string
  }

  let {
    points,
    view = 'netWorth',
    formatValue,
    formatAmount,
    formatDate,
    formatPercent,
    formatNumber,
    nowLabel,
    ariaLabel,
    onSelect,
    onAdd,
    class: className,
  }: Props = $props()

  // Month names are translations, so the X-axis ticks follow the UI language
  // rather than the profile's number-formatting locale (which the caller's
  // `formatValue` resolves for the Y axis). Read here rather than passed in:
  // every chart labels its axis the same way, and a locale string has no
  // business travelling through props.
  const shortMonth = $derived(new Intl.DateTimeFormat($locale ?? undefined, { month: 'short' }))
  const monthWithYear = $derived(
    new Intl.DateTimeFormat($locale ?? undefined, { month: 'short', year: 'numeric' }),
  )

  // The leading tick carries a year, matching the spec; a chart longer than a
  // year repeats it where a new year starts (`labelsWithYear`).
  function formatMonth(date: string, withYear: boolean): string {
    const parsed = parseDateOnly(date)
    return withYear ? monthWithYear.format(parsed) : shortMonth.format(parsed)
  }

  function formatYears(years: number | undefined): string {
    if (years === undefined) return '—'
    if (years === Infinity)
      return $_('page.dashboard.finances.history.tooltip.yearsCapped', {
        values: { years: formatNumber(RUNWAY_CAP_YEARS) },
      })
    return $_('page.dashboard.finances.history.tooltip.years', {
      values: { years: formatNumber(Math.round(years * 10) / 10) },
    })
  }

  // Geometry is computed in real pixels rather than a stretched viewBox so
  // strokes and dots keep their shape at any panel width.
  let plotWidth = $state(0)
  let plotHeight = $state(0)

  const DOT_SIZE = 8
  // Room for the "Now" label so a month tick can't collide with it.
  const NOW_LABEL_WIDTH = 40
  // Minimum gap between month labels. Wide enough for the leading "Mon YYYY"
  // tick; below it, labels are thinned rather than allowed to overlap.
  const MIN_TICK_SPACING = 56
  // Gap between a hovered dot and its tooltip.
  const TOOLTIP_GAP = 12

  interface Layer {
    key: string
    label: string
    /** Undefined draws in the foreground colour over a muted fill. */
    color?: string
    value: (point: HistoryPoint) => number
  }

  const layers = $derived.by((): Layer[] => {
    if (view === 'netWorth')
      return [
        {
          key: 'netWorth',
          label: $_('page.dashboard.finances.history.tooltip.netWorth'),
          value: (p) => p.netWorth,
        },
      ]
    const assets: Layer[] = [
      {
        key: 'cash',
        label: $_('page.plan.cash'),
        color: CATEGORY_COLORS.cash,
        value: (p) => p.cash,
      },
      {
        key: 'investments',
        label: $_('page.plan.investments'),
        color: CATEGORY_COLORS.investments[1],
        value: (p) => p.investments,
      },
      {
        key: 'tangibleAssets',
        label: $_('page.plan.tangibleAssets'),
        color: CATEGORY_COLORS.tangibleAssets[2],
        value: (p) => p.tangibleAssets,
      },
    ]
    if (view === 'breakdown') return assets
    const liabilities: Layer = {
      key: 'liabilities',
      label: $_('page.plan.liabilities'),
      color: CATEGORY_COLORS.liabilities[0],
      value: (p) => p.liabilities,
    }
    return [...assets, liabilities].filter((layer) => layer.key === view)
  })
  /** Per layer, per point: the value the layer starts from and the one it reaches. */
  const stacks = $derived.by(() => {
    const base = points.map(() => 0)
    return layers.map((layer) =>
      points.map((point, i) => {
        const bottom = base[i]
        const top = bottom + layer.value(point)
        base[i] = top
        return { bottom, top }
      }),
    )
  })

  const bounds = $derived(niceAxisBounds(stacks.flat().map((s) => s.top)))

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

  // The line is split at the last recorded point: everything up to it is drawn
  // solid over a filled area, and the projected tail continues as a bare dashed
  // stroke so an estimate never reads as recorded history.
  const lastActualIndex = $derived.by(() => {
    const index = points.findLastIndex((p) => !p.projected)
    return index === -1 ? 0 : index
  })

  interface Plotted extends HistoryPoint {
    id: string
    layer: Layer
    x: number
    y: number
    /** Where the layer's fill ends: the baseline, or the layer below when stacked. */
    y0: number
  }

  const toLine = (segment: Plotted[]) =>
    segment.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const plottedLayers = $derived(
    layers.map((layer, l) => {
      const plotted: Plotted[] = points.map((point, i) => ({
        ...point,
        id: `${layer.key}:${point.date}`,
        layer,
        x: xFraction(point.date) * plotWidth,
        y: yFraction(stacks[l][i].top) * plotHeight,
        y0: yFraction(stacks[l][i].bottom) * plotHeight,
      }))
      const actual = plotted.slice(0, lastActualIndex + 1)
      const projected = plotted.slice(lastActualIndex)
      return {
        layer,
        actualLine: actual.length > 1 ? toLine(actual) : '',
        projectedLine: projected.length > 1 ? toLine(projected) : '',
        areaPath:
          actual.length > 1
            ? `${toLine(actual)} ${actual
                .toReversed()
                .map((p) => `L ${p.x} ${p.y0}`)
                .join(' ')} Z`
            : '',
        // Recorded points get a dot each, plus one for "now" at the end of the
        // tail. The samples in between describe the curve's shape, not moments
        // worth marking — a dot on each would read as eight more readings than
        // were taken.
        dots: plotted.filter((point, i) => !point.projected || i === plotted.length - 1),
      }
    }),
  )

  const dots = $derived(plottedLayers.flatMap((layer) => layer.dots))

  // The dot under the pointer (or keyboard focus): it gets a vertical guide
  // and a tooltip with the reading on that date.
  let activeId = $state<string | undefined>(undefined)
  const active = $derived(dots.find((point) => point.id === activeId))

  const monthLabels = $derived.by(() => {
    const ticks = monthTicks(firstDate, lastDate).map((date) => ({
      date,
      x: xFraction(date) * plotWidth,
    }))
    // Two years of history would otherwise print 24 overlapping labels; keep
    // every Nth so whatever survives is legible at the current width.
    const gap = ticks.length > 1 ? ticks[1].x - ticks[0].x : plotWidth
    const stride = Math.max(1, Math.ceil(MIN_TICK_SPACING / Math.max(gap, 1)))
    const shown = ticks
      .filter((_, i) => i % stride === 0)
      // The trailing "Now" label owns the right edge.
      .filter((tick) => plotWidth - tick.x > NOW_LABEL_WIDTH)
    const withYear = labelsWithYear(
      shown.map((tick) => tick.date),
      ticks.length > 12,
    )
    return shown.map((tick, i) => ({ ...tick, withYear: withYear[i] }))
  })
</script>

{#snippet row(label: string, value: string, color?: string)}
  <div class="flex items-center gap-2">
    {#if color}
      <span class="size-2 shrink-0 rounded-full" style:background-color={color}></span>
    {/if}
    <span class="min-w-0 flex-1 truncate text-sm">{label}</span>
    <span class="shrink-0 text-right text-base font-medium">{value}</span>
  </div>
{/snippet}

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
    >
      <!-- Grid -->
      <div class="absolute inset-0 flex flex-col justify-between">
        {#each bounds.ticks as tick (tick)}
          <div class="h-0 border-t border-border"></div>
        {/each}
      </div>

      {#if plotWidth > 0 && plotHeight > 0}
        <svg class="absolute inset-0 size-full overflow-visible" role="img" aria-label={ariaLabel}>
          {#each plottedLayers as { layer, areaPath, actualLine, projectedLine } (layer.key)}
            <g class="text-foreground" style:color={layer.color}>
              {#if areaPath}
                {#if layer.color}
                  <path d={areaPath} fill="currentColor" fill-opacity="0.35" />
                {:else}
                  <path d={areaPath} class="fill-muted" />
                {/if}
              {/if}
              {#if actualLine}
                <path
                  d={actualLine}
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
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
                />
              {/if}
            </g>
          {/each}
        </svg>

        {#if active}
          <div
            class="pointer-events-none absolute inset-y-0 w-px bg-foreground"
            style:left="{active.x}px"
          ></div>
        {/if}

        {#each dots as point (point.id)}
          <!-- Recorded points are solid; the projected "now" point is hollow.
               A button, so the tooltip also opens on focus; the pseudo-element
               widens the hit area past the 8px dot. -->
          <button
            type="button"
            class={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-current text-foreground',
              "before:absolute before:-inset-2 before:content-['']",
              point.projected ? 'bg-background' : 'bg-current',
              (point.projected ? onAdd : onSelect) ? 'cursor-pointer' : 'cursor-default',
            )}
            style:color={point.layer.color}
            style:left="{point.x}px"
            style:top="{point.y}px"
            style:width="{DOT_SIZE}px"
            style:height="{DOT_SIZE}px"
            aria-label="{point.layer.label}, {formatDate(point.date)}: {formatAmount(
              point.layer.value(point),
            )}"
            onmouseenter={() => (activeId = point.id)}
            onmouseleave={() => (activeId = undefined)}
            onfocus={() => (activeId = point.id)}
            onblur={() => (activeId = undefined)}
            onclick={() => {
              if (point.projected) onAdd?.()
              else onSelect?.(point.date)
            }}
          ></button>
        {/each}

        {#if active}
          <!-- Beside the dot, on whichever side has more room. -->
          <div
            class="pointer-events-none absolute z-10 flex w-72 -translate-y-1/2 flex-col gap-2 rounded-lg border bg-popover p-[9px] text-popover-foreground shadow-md"
            style:top="{active.y}px"
            style:left={active.x < plotWidth / 2 ? `${active.x + TOOLTIP_GAP}px` : undefined}
            style:right={active.x < plotWidth / 2
              ? undefined
              : `${plotWidth - active.x + TOOLTIP_GAP}px`}
          >
            <div class="flex items-center gap-2">
              <span class="flex-1 text-sm">{formatDate(active.date)}</span>
              {#if active.projected ? onAdd : onSelect}
                <span class="flex-1 text-right text-xs text-muted-foreground">
                  {active.projected
                    ? $_('page.dashboard.finances.history.tooltip.clickToAdd')
                    : $_('page.dashboard.finances.history.tooltip.clickToEdit')}
                </span>
              {/if}
            </div>
            <div class="flex flex-col whitespace-nowrap">
              {#if view !== 'netWorth'}
                {#each layers as layer (layer.key)}
                  {@render row(layer.label, formatAmount(layer.value(active)), layer.color)}
                {/each}
              {/if}
              {@render row(
                $_('page.dashboard.finances.history.tooltip.netWorth'),
                formatAmount(active.netWorth),
              )}
              {#if view === 'netWorth'}
                {@render row(
                  $_('page.dashboard.finances.history.tooltip.runway'),
                  formatYears(active.runwayYears),
                )}
                {@render row(
                  $_('page.dashboard.finances.history.tooltip.fi'),
                  active.fiPercent === undefined ? '—' : formatPercent(active.fiPercent, 0),
                )}
              {/if}
            </div>
          </div>
        {/if}
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
          style:left="{tick.x}px">{formatMonth(tick.date, tick.withYear)}</span
        >
      {/each}
      <span class="absolute right-0 whitespace-nowrap font-medium text-foreground">{nowLabel}</span>
    </div>
  </div>
</div>
