<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import TrendingDown from '@lucide/svelte/icons/trending-down'
  import TrendingUp from '@lucide/svelte/icons/trending-up'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from '$lib/components/ui/collapsible'
  import { Slider } from '$lib/components/ui/slider'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import type { YearlyProjection, YearlyProjectionItem } from '$lib/plan-projection'
  import { RUNWAY_CAP_YEARS } from '$lib/runway'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'
  import { type YearChange, yearChange } from '$lib/year-change'

  interface Props {
    projection: YearlyProjection[]
    selectedYear: number
    startYear: number
    endYear: number
    age?: number
    // What opens the dialog of a plan item, by its id ('cash' for the cash
    // balance); nothing for an item that cannot be opened.
    opener?: (id: string) => (() => void) | undefined
  }

  let { projection, selectedYear = $bindable(), startYear, endYear, age, opener }: Props = $props()

  interface Row {
    id: string
    name: string
    value: string
    onClick?: () => void
  }

  interface Group {
    id: string
    label: string
    value: string
    valueClass?: string
    color?: string
    // The rows the group expands to. A group without any has nothing to open.
    rows: Row[]
    // A group that is a single thing (Cash): the row itself opens it.
    onClick?: () => void
    // A plain figure that sits at the section's edge, not under the chevrons.
    flush?: boolean
  }

  // Which sections and groups are open, by id; Net worth starts open, the
  // rest closed. It lives across year changes,
  // so stepping through the years keeps the same rows in view.
  let open = $state<Record<string, boolean>>({ netWorth: true })
  // The change badge whose tooltip is open, toggled by a tap as well as hover.
  let openBadge = $state<string | undefined>(undefined)

  const year = $derived(projection.find((p) => p.year === selectedYear))
  const previous = $derived(projection.find((p) => p.year === selectedYear - 1))

  const money = (value: number) => appStore.formatCurrencyCode(value)
  // A leading sign carries the direction of a flow; a zero has none.
  const inflow = (value: number) => (value > 0 ? `+${money(value)}` : money(value))
  const outflow = (value: number) => (value > 0 ? `-${money(value)}` : money(value))
  const toneOf = (value: number) =>
    value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : undefined

  // A row opens its item's dialog. The loan behind a financed asset, its
  // installments and an asset's property tax open the asset they belong to.
  const row = (item: YearlyProjectionItem, value: string, name = item.name): Row => ({
    id: item.id,
    name,
    value,
    onClick: opener?.(item.assetId ?? item.id),
  })

  const sum = (rows: { value: number }[]) => rows.reduce((total, row) => total + row.value, 0)

  const outflowGroup = (id: string, label: string, rows: Row[], total: number): Group => ({
    id,
    label,
    value: outflow(total),
    valueClass: total > 0 ? 'text-destructive' : undefined,
    rows,
  })

  // Rows named after their item by a label of their own ("ETF fees").
  const labelled = (
    items: YearlyProjectionItem[],
    prefix: string,
    label: (name: string) => string,
  ): Row[] =>
    items.map((i) => ({
      ...row(i, outflow(i.value), label(i.name)),
      id: `${prefix}-${i.id}`,
    }))

  const netWorthGroups = $derived<Group[]>(
    year
      ? [
          {
            id: 'cash',
            label: $_('page.plan.cash'),
            value: money(year.cash),
            color: CATEGORY_COLORS.cash,
            rows: [],
            onClick: opener?.('cash'),
          },
          {
            id: 'investments',
            label: $_('page.plan.investments'),
            value: money(year.investments),
            color: CATEGORY_COLORS.investments[0],
            rows: year.investmentsByItem.map((i) => row(i, money(i.value))),
          },
          {
            id: 'tangibleAssets',
            label: $_('page.plan.tangibleAssets'),
            value: money(year.tangibleAssets),
            color: CATEGORY_COLORS.tangibleAssets[0],
            rows: year.tangibleAssetsByItem.map((i) => row(i, money(i.value))),
          },
          {
            id: 'liabilities',
            label: $_('page.plan.liabilities'),
            value: outflow(year.liabilities),
            valueClass: year.liabilities > 0 ? 'text-destructive' : undefined,
            color: CATEGORY_COLORS.liabilities[0],
            rows: year.liabilitiesByItem.map((i) => row(i, outflow(i.value))),
          },
        ]
      : [],
  )

  const cashFlowGroups = $derived<Group[]>(
    year
      ? [
          {
            id: 'income',
            label: $_('page.plan.details.income'),
            value: inflow(year.totalIncome),
            valueClass: year.totalIncome > 0 ? 'text-success' : undefined,
            rows: year.incomesByItem.map((i) => row(i, inflow(i.value))),
          },
          outflowGroup(
            'expense',
            $_('page.plan.expenses'),
            year.expensesByItem.map((i) => row(i, outflow(i.value))),
            sum(year.expensesByItem),
          ),
          outflowGroup(
            'installments',
            $_('page.plan.details.liabilityInstallments'),
            year.installmentsByItem.map((i) => row(i, outflow(i.value))),
            year.totalInstallments,
          ),
          // An investment's fees, a transfer's tax and an asset's property tax.
          // The ids are prefixed so rows of different kinds never share one.
          outflowGroup(
            'feesAndTaxes',
            $_('page.plan.details.feesAndTaxes'),
            [
              ...labelled(year.investmentFeesByItem, 'fees', (name) =>
                $_('page.plan.details.investmentFeesOf', { values: { name } }),
              ),
              ...labelled(year.transferTaxByItem, 'transferTax', (name) =>
                $_('page.plan.details.transferTaxOf', { values: { name } }),
              ),
              ...labelled(year.propertyTaxByItem, 'propertyTax', (name) =>
                $_('page.plan.details.propertyTaxOf', { values: { name } }),
              ),
            ],
            sum(year.investmentFeesByItem) +
              sum(year.transferTaxByItem) +
              sum(year.propertyTaxByItem),
          ),
          {
            id: 'transfers',
            label: $_('page.plan.transfers'),
            value: money(sum(year.transfersByItem)),
            rows: year.transfersByItem.map((i) => row(i, money(i.value))),
          },
        ]
      : [],
  )

  function runwayLabel(years: number | undefined): string {
    if (years === undefined) return '—'
    if (years > RUNWAY_CAP_YEARS) {
      return $_('page.dashboard.finances.runwayCard.capped', {
        values: { years: appStore.formatNumber(RUNWAY_CAP_YEARS) },
      })
    }
    return $_('page.dashboard.finances.runwayCard.value', {
      values: { years: appStore.formatNumber(Math.round(years * 10) / 10) },
    })
  }
</script>

{#snippet changeBadge(id: string, change: YearChange | undefined)}
  {#if change?.percent !== undefined}
    {@const tone = toneOf(change.delta)}
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root
        open={openBadge === id}
        onOpenChange={(v) => (openBadge = v ? id : undefined)}
        disableCloseOnTriggerClick
      >
        <Tooltip.Trigger
          type="button"
          class="pointer-events-auto relative z-10 rounded-full"
          onclick={() => (openBadge = openBadge === id ? undefined : id)}
        >
          <Badge variant="outline" class={tone}>
            {#if change.delta > 0}
              <TrendingUp />
            {:else if change.delta < 0}
              <TrendingDown />
            {/if}
            {appStore.formatPercent(Math.abs(change.percent), 1)}
          </Badge>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {$_('page.plan.details.changeVsYear', {
            values: {
              amount: change.delta > 0 ? `+${money(change.delta)}` : money(change.delta),
              year: selectedYear - 1,
            },
          })}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {/if}
{/snippet}

{#snippet group(g: Group)}
  {#if g.onClick}
    <button
      type="button"
      onclick={g.onClick}
      class="flex w-full items-center gap-2 rounded-md p-2 pl-8 text-sm leading-none hover:bg-sidebar-accent"
    >
      {@render groupCells(g)}
    </button>
  {:else if g.rows.length === 0}
    <div class={cn('flex items-center gap-2 p-2 text-sm leading-none', !g.flush && 'pl-8')}>
      {@render groupCells(g)}
    </div>
  {:else}
    <Collapsible
      open={open[g.id] ?? false}
      onOpenChange={(v) => (open[g.id] = v)}
      class={cn('w-full', open[g.id] && 'pb-2')}
    >
      <CollapsibleTrigger
        class="flex w-full items-center gap-2 rounded-md p-2 text-sm leading-none hover:bg-sidebar-accent"
      >
        <ChevronRight
          class="size-4 shrink-0 transition-transform [[data-state=open]>&]:rotate-90"
        />
        {@render groupCells(g)}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul
          class="relative flex flex-col gap-1 py-0.5 pl-6 before:absolute before:inset-y-0 before:left-4 before:border-l before:border-sidebar-border"
        >
          {#each g.rows as row (row.id)}
            {@const rowClass =
              'flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm leading-none'}
            <li>
              <!-- A row with no handler is information, not a control. -->
              {#if row.onClick}
                <button
                  type="button"
                  onclick={row.onClick}
                  class={cn(rowClass, 'hover:bg-sidebar-accent')}
                >
                  {@render rowCells(row, g.valueClass)}
                </button>
              {:else}
                <div class={rowClass}>{@render rowCells(row, g.valueClass)}</div>
              {/if}
            </li>
          {/each}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  {/if}
{/snippet}

{#snippet rowCells(row: Row, valueClass: string | undefined)}
  <span class="min-w-0 flex-1 truncate text-left text-muted-foreground">{row.name}</span>
  <span class={cn('shrink-0 tabular-nums', valueClass)}>{row.value}</span>
{/snippet}

{#snippet groupCells(g: Group)}
  {#if g.color}
    <span class="size-4 shrink-0 rounded-[2px]" style="background-color: {g.color}"></span>
  {/if}
  <span class="min-w-0 flex-1 truncate text-left">{g.label}</span>
  <span class={cn('shrink-0 font-medium tabular-nums', g.valueClass)}>{g.value}</span>
{/snippet}

{#snippet section(
  id: string,
  label: string,
  value: string,
  valueClass: string | undefined,
  change: YearChange | undefined,
  groups: Group[],
)}
  <Collapsible open={open[id] ?? false} onOpenChange={(v) => (open[id] = v)} class="w-full">
    <!-- The whole title cell toggles the section. The trigger lies over it
         rather than around it, so the badge can be a button of its own. -->
    <div class="relative flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent">
      <CollapsibleTrigger class="absolute inset-0 rounded-md" aria-label={label} />
      <div class="pointer-events-none flex min-w-0 flex-1 flex-col">
        <p class="truncate text-sm font-bold">{label}</p>
        <div class="flex items-center gap-2">
          <p class={cn('truncate text-base font-medium tabular-nums', valueClass)}>{value}</p>
          {@render changeBadge(id, change)}
        </div>
      </div>
      <ChevronsUpDown class="pointer-events-none size-4 shrink-0" />
    </div>
    <CollapsibleContent>
      {#each groups as g (g.id)}
        {@render group(g)}
      {/each}
    </CollapsibleContent>
  </Collapsible>
{/snippet}

<div class="flex w-[384px] shrink-0 flex-col overflow-hidden border-l">
  <div class="flex shrink-0 flex-col gap-2 p-4">
    <div class="flex items-center gap-4">
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <p class="text-base font-bold tabular-nums">{selectedYear}</p>
        <!-- ponytail: two joined buttons; swap for the shadcn ButtonGroup once
             a second place needs one. -->
        <div class="flex">
          <Button
            variant="outline"
            size="icon-xs"
            class="rounded-r-none"
            aria-label={$_('page.plan.details.previousYear')}
            disabled={selectedYear <= startYear}
            onclick={() => (selectedYear -= 1)}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            class="rounded-l-none border-l-0"
            aria-label={$_('page.plan.details.nextYear')}
            disabled={selectedYear >= endYear}
            onclick={() => (selectedYear += 1)}
          >
            <ArrowRight />
          </Button>
        </div>
      </div>
      {#if age !== undefined}
        <p class="text-sm">{$_('page.plan.age', { values: { age } })}</p>
      {/if}
    </div>
    <Slider
      type="single"
      class="py-1"
      bind:value={selectedYear}
      min={startYear}
      max={endYear}
      step={1}
    />
  </div>

  {#if year}
    <div class="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-2 pb-4">
      {@render section(
        'netWorth',
        $_('page.plan.netWorth'),
        money(year.netWorth),
        undefined,
        yearChange(year.netWorth, previous?.netWorth),
        netWorthGroups,
      )}
      {@render section(
        'cashFlow',
        $_('page.plan.details.cashFlow'),
        inflow(year.cashFlow),
        toneOf(year.cashFlow),
        yearChange(year.cashFlow, previous?.cashFlow),
        cashFlowGroups,
      )}
      {@render section(
        'investableNetWorth',
        $_('page.plan.details.investableNetWorth'),
        money(year.investableNetWorth),
        undefined,
        yearChange(year.investableNetWorth, previous?.investableNetWorth),
        [
          {
            id: 'fi',
            label: $_('page.plan.details.financialIndependence'),
            value: year.fiPercent === undefined ? '—' : appStore.formatPercent(year.fiPercent, 0),
            rows: [],
            flush: true,
          },
          {
            id: 'runway',
            label: $_('page.plan.details.runway'),
            value: runwayLabel(year.runwayYears),
            rows: [],
            flush: true,
          },
        ],
      )}
    </div>
  {/if}
</div>
