<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'

  type Props = {
    year: number
    age?: number
    netWorth: number
    cash: number
    investments: number
    tangibleAssets: number
    liabilities: number
    formatCurrency: (value: number) => string
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
  }: Props = $props()

  const breakdownItems = $derived([
    {
      id: 'cash',
      label: $_('page.plan.cash'),
      color: CATEGORY_COLORS.cash,
      value: cash,
      formattedValue: formatCurrency(cash),
      isNegative: false,
    },
    {
      id: 'investments',
      label: $_('page.plan.investments'),
      color: CATEGORY_COLORS.investments[0],
      value: investments,
      formattedValue: formatCurrency(investments),
      isNegative: false,
    },
    {
      id: 'tangibleAssets',
      label: $_('page.plan.tangibleAssets'),
      color: CATEGORY_COLORS.tangibleAssets[0],
      value: tangibleAssets,
      formattedValue: formatCurrency(tangibleAssets),
      isNegative: false,
    },
    {
      id: 'liabilities',
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

  <!-- Net worth -->
  <div class="flex flex-col gap-1 px-2">
    <span class="text-sm font-medium">{$_('page.plan.netWorth')}</span>
    <span class="text-lg">{formatCurrency(netWorth)}</span>
  </div>

  <!-- Category breakdown -->
  <div class="flex flex-col p-2">
    {#each breakdownItems as item (item.id)}
      <div class="flex items-center gap-2 py-1">
        <div class="flex flex-1 items-center gap-2">
          <div class="size-4 rounded-[2px]" style="background-color: {item.color}"></div>
          <span class="text-sm">{item.label}</span>
        </div>
        <span class="text-sm tabular-nums" class:text-destructive={item.isNegative}>
          {item.formattedValue}
        </span>
      </div>
    {/each}
  </div>
</div>
