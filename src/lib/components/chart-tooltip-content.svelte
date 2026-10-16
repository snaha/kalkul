<script lang="ts" module>
  export type RecordedCategory = {
    // The recorded value, formatted like the plan's beside it.
    value: string
    // The signed difference from the plan, formatted.
    difference: string
    differenceClass?: string
  }

  export type RecordedComparison = {
    // e.g. "Recorded 15 Sep 2026"
    label: string
    netWorth: number
    // The signed difference from the plan, formatted.
    difference: string
    differenceClass?: string
    // A category nothing was planned or recorded for is left out.
    categories: Partial<
      Record<'cash' | 'investments' | 'tangibleAssets' | 'liabilities', RecordedCategory>
    >
  }
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import RecordedCategoryRows from '$lib/components/recorded-category-rows.svelte'
  import { cn } from '$lib/utils'

  type Props = {
    // The heading: a year, or the date of a recording.
    year: number | string
    age?: number
    netWorth: number
    cash: number
    investments: number
    tangibleAssets: number
    liabilities: number
    formatCurrency: (value: number) => string
    // A line under the heading, e.g. when its figures were recorded rather than projected.
    note?: string
    // What was recorded for a projected year, held against its net worth.
    recorded?: RecordedComparison
  }

  const {
    year,
    age,
    netWorth,
    cash,
    investments,
    tangibleAssets,
    liabilities,
    formatCurrency,
    note,
    recorded,
  }: Props = $props()

  const breakdownItems = $derived([
    {
      id: 'cash' as const,
      label: $_('page.plan.cash'),
      color: CATEGORY_COLORS.cash,
      value: cash,
      formattedValue: formatCurrency(cash),
      isNegative: false,
    },
    {
      id: 'investments' as const,
      label: $_('page.plan.investments'),
      color: CATEGORY_COLORS.investments[0],
      value: investments,
      formattedValue: formatCurrency(investments),
      isNegative: false,
    },
    {
      id: 'tangibleAssets' as const,
      label: $_('page.plan.tangibleAssets'),
      color: CATEGORY_COLORS.tangibleAssets[0],
      value: tangibleAssets,
      formattedValue: formatCurrency(tangibleAssets),
      isNegative: false,
    },
    {
      id: 'liabilities' as const,
      label: $_('page.plan.liabilities'),
      color: CATEGORY_COLORS.liabilities[0],
      value: liabilities,
      formattedValue: liabilities > 0 ? '-' + formatCurrency(liabilities) : formatCurrency(0),
      isNegative: liabilities > 0,
    },
  ])
</script>

<div class="flex flex-col gap-2.5">
  <!-- Header: Year and Age on same row -->
  <div class="flex items-center justify-between px-2">
    <span class="text-lg font-bold">{year}</span>
    {#if age !== undefined}
      <span class="text-sm">{$_('page.plan.age', { values: { age } })}</span>
    {/if}
  </div>
  {#if note}
    <p class="-mt-2 px-2 text-xs text-muted-foreground">{note}</p>
  {/if}

  <!-- Net worth -->
  <div class="flex flex-col gap-1 px-2">
    <span class="text-sm font-medium">{$_('page.plan.netWorth')}</span>
    <span class="text-lg">{formatCurrency(netWorth)}</span>
    {#if recorded}
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="text-muted-foreground">{recorded.label}</span>
        <span class="whitespace-nowrap tabular-nums">{formatCurrency(recorded.netWorth)}</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="text-muted-foreground">{$_('page.plan.againstPlan')}</span>
        <span class={cn('whitespace-nowrap tabular-nums', recorded.differenceClass)}>
          {recorded.difference}
        </span>
      </div>
    {/if}
  </div>

  <!-- Category breakdown -->
  <div class="flex flex-col p-2">
    {#each breakdownItems as item (item.id)}
      {@const recordedItem = recorded?.categories[item.id]}
      <div class="flex items-center gap-2 py-1">
        <div class="flex flex-1 items-center gap-2">
          <div class="size-4 rounded-[2px]" style="background-color: {item.color}"></div>
          <span class="text-sm">{item.label}</span>
        </div>
        <span class="text-sm tabular-nums" class:text-destructive={item.isNegative}>
          {item.formattedValue}
        </span>
      </div>
      {#if recordedItem}
        <RecordedCategoryRows recorded={recordedItem} />
      {/if}
    {/each}
  </div>
</div>
