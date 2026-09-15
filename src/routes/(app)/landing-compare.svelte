<script lang="ts">
  import { _ } from 'svelte-i18n'

  import StackedBarChart, { type BarData } from '$lib/components/stacked-bar-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import { cn } from '$lib/utils'

  import { minStackedChartWidth } from './landing-chart-width'
  import { HEADLINE_AGE, type ProjectionStats, getStatsDelta } from './landing-stats'

  interface Props {
    currentBars: BarData[]
    currentStats: ProjectionStats
    planBars: BarData[]
    planStats: ProjectionStats
    /** First year the plan cannot pay for, if it has one. */
    planUnfundedYear?: number
    /** The saved plan's own name and note — user data, not translated. */
    planName: string
    planNotes?: string
    formatCompactCurrency: (value: number) => string
  }

  let {
    currentBars,
    currentStats,
    planBars,
    planStats,
    planUnfundedYear,
    planName,
    planNotes,
    formatCompactCurrency,
  }: Props = $props()

  const CHART_HEIGHT = 160

  const delta = $derived(getStatsDelta(planStats, currentStats))

  // Per card: the width its chart is drawn at, and the year its own dashed
  // indicator follows. The cards carry no tooltip — the figures below say what
  // the bars are worth.
  let widths = $state<Record<string, number>>({})
  let hovered = $state<Record<string, number | undefined>>({})

  type Tone = 'good' | 'bad' | 'neutral'
  interface DeltaLabel {
    label: string
    tone: Tone
  }

  /** A difference in money, as a signed string plus whether it reads as good news. */
  function amountDelta(value: number | undefined): DeltaLabel | undefined {
    if (value === undefined) return undefined
    if (value === 0) return { label: $_('page.landing.compare.deltaSame'), tone: 'neutral' }
    const values = { amount: formatCompactCurrency(Math.abs(value)) }
    return {
      label:
        value > 0
          ? $_('page.landing.compare.deltaMore', { values })
          : $_('page.landing.compare.deltaLess', { values }),
      tone: value > 0 ? 'good' : 'bad',
    }
  }

  /** A difference in years, where reaching the milestone later is the bad news. */
  function yearsDelta(value: number | undefined): DeltaLabel | undefined {
    if (value === undefined) return undefined
    if (value === 0) return { label: $_('page.landing.compare.deltaSame'), tone: 'neutral' }
    const values = { years: Math.abs(value) }
    return {
      label:
        value > 0
          ? $_('page.landing.compare.deltaLater', { values })
          : $_('page.landing.compare.deltaEarlier', { values }),
      tone: value > 0 ? 'bad' : 'good',
    }
  }

  /** The cash line names the year the plan runs out of money. */
  function cashDelta(): DeltaLabel | undefined {
    if (planUnfundedYear !== undefined) {
      return {
        label: $_('page.landing.compare.deltaTight', {
          values: { year: String(planUnfundedYear) },
        }),
        tone: 'bad',
      }
    }
    return amountDelta(delta.lowestCash)
  }

  function statValues(stats: ProjectionStats, withDeltas: boolean) {
    const missing = $_('page.landing.compare.noFigure')
    return [
      {
        id: 'netWorth',
        label: $_('page.landing.compare.netWorthAt', { values: { age: HEADLINE_AGE } }),
        value:
          stats.netWorthAtHeadlineAge === undefined
            ? missing
            : formatCompactCurrency(stats.netWorthAtHeadlineAge),
        delta: withDeltas ? amountDelta(delta.netWorthAtHeadlineAge) : undefined,
      },
      {
        id: 'independent',
        label: $_('page.landing.compare.independent'),
        value:
          stats.independentAtAge === undefined
            ? missing
            : $_('page.plan.age', { values: { age: stats.independentAtAge } }),
        delta: withDeltas ? yearsDelta(delta.independentAtAge) : undefined,
      },
      {
        id: 'lowestCash',
        label: $_('page.landing.compare.lowestCash'),
        value:
          stats.lowestCash === undefined ? missing : formatCompactCurrency(stats.lowestCash.value),
        delta: withDeltas ? cashDelta() : undefined,
      },
    ]
  }

  const scenarios = $derived([
    {
      id: 'current',
      title: $_('page.dashboard.projections.current.title'),
      badge: $_('page.landing.compare.currentSubtitle'),
      description: $_('page.dashboard.projections.current.description'),
      bars: currentBars,
      chartLabel: $_('page.dashboard.projections.current.chartLabel'),
      // Deltas belong to the plan alone: they say what changes against this card.
      stats: statValues(currentStats, false),
      highlighted: false,
      unfundedYear: undefined as number | undefined,
    },
    {
      id: 'plan',
      title: planName,
      badge: undefined,
      description: planNotes,
      bars: planBars,
      chartLabel: $_('page.dashboard.projections.planChartLabel', { values: { name: planName } }),
      stats: statValues(planStats, true),
      highlighted: true,
      unfundedYear: planUnfundedYear,
    },
  ])

  const toneClass: Record<Tone, string> = {
    good: 'text-success',
    bad: 'text-destructive',
    neutral: 'text-muted-foreground',
  }
</script>

<!-- Side by side only once a card is wide enough for the whole chart at the bar
     width stacked-bar-chart insists on; below that the cards stack and take the
     full column rather than showing a scrollbar. -->
<div class="grid gap-4 xl:grid-cols-2">
  {#each scenarios as scenario (scenario.id)}
    <Card.Root class={cn('min-w-0 gap-4 py-4 shadow-xs', scenario.highlighted && 'border-primary')}>
      <Card.Header class="gap-1 px-4">
        <Card.Title class="flex flex-wrap items-center gap-2 text-lg">
          {scenario.title}
          {#if scenario.badge}
            <Badge variant="outline">{scenario.badge}</Badge>
          {/if}
        </Card.Title>
        {#if scenario.description}
          <Card.Description>{scenario.description}</Card.Description>
        {/if}
      </Card.Header>

      <!-- Full-bleed, so the chart gets the card's whole width; it still
           scrolls sideways on a phone, as the hero chart does. -->
      <Card.Content class="min-w-0 px-4">
        <div class="-mx-4 min-w-0 overflow-x-auto" bind:clientWidth={widths[scenario.id]}>
          {#if widths[scenario.id] > 0}
            {@const chartWidth = Math.max(
              widths[scenario.id],
              minStackedChartWidth(scenario.bars.length),
            )}
            <div style="width: {chartWidth}px; height: {CHART_HEIGHT}px">
              <StackedBarChart
                data={scenario.bars}
                width={chartWidth}
                height={CHART_HEIGHT}
                hoveredYear={hovered[scenario.id]}
                showSelectedIndicator={false}
                ariaLabel={scenario.chartLabel}
                firstErrorYear={scenario.unfundedYear}
                firstErrorTooltip={scenario.unfundedYear === undefined
                  ? undefined
                  : $_('page.plan.firstErrorTooltip', { values: { year: scenario.unfundedYear } })}
                onYearHover={(year) => (hovered[scenario.id] = year)}
              />
            </div>
          {/if}
        </div>
      </Card.Content>

      <!-- Pushed to the bottom so both cards line their figures up, even when
           one has delta lines under them and the other does not. -->
      <Card.Footer class="mt-auto flex-col items-stretch gap-4 px-4">
        <Separator />
        <div class="flex flex-wrap gap-4">
          {#each scenario.stats as stat (stat.id)}
            <div class="flex min-w-24 flex-1 flex-col gap-1">
              <span class="text-xs text-muted-foreground uppercase">{stat.label}</span>
              <span class="text-lg font-bold tabular-nums">{stat.value}</span>
              {#if stat.delta}
                <span class={cn('text-xs tabular-nums', toneClass[stat.delta.tone])}>
                  {stat.delta.label}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </Card.Footer>
    </Card.Root>
  {/each}
</div>

{#if planUnfundedYear !== undefined}
  <p class="mt-4 text-sm text-muted-foreground">
    {$_('page.landing.compare.note', { values: { year: String(planUnfundedYear) } })}
  </p>
{:else}
  <p class="mt-4 text-sm text-muted-foreground">
    {$_('page.landing.compare.noteNoMarker')}
  </p>
{/if}
