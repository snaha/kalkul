<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { SquarePen } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import BreakdownRow from '$lib/components/breakdown-row.svelte'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    getCashTotal,
    getInvestmentsTotal,
    getLiabilitiesTotal,
    getNetWorth,
    getOverviewSegments,
    getTangibleAssetsTotal,
    getTotalAssets,
  } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const segments = $derived(getOverviewSegments(appStore.profile))
  const cash = $derived(getCashTotal(appStore.profile))
  const investments = $derived(getInvestmentsTotal(appStore.profile))
  const tangible = $derived(getTangibleAssetsTotal(appStore.profile))
  const liabilities = $derived(getLiabilitiesTotal(appStore.profile))
  const totalAssets = $derived(getTotalAssets(appStore.profile))
  const netWorth = $derived(getNetWorth(appStore.profile))

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
</script>

<div class="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
  <DonutChart {segments} size={160} variant="pie" />
  <div class="flex flex-1 flex-col items-start gap-2">
    <p class="text-lg leading-7 font-medium">
      {$_('page.financialData.overview.netWorthLabel')}
    </p>
    <p class="text-3xl leading-9 font-bold">{appStore.formatCurrencyCode(netWorth)}</p>
    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Button size="sm" variant="secondary" href={resolve(routes.FINANCES_EDIT)}>
        <SquarePen class="size-4" />
        {$_('page.financialData.overview.updateButton')}
      </Button>
      <span class="text-xs leading-4 text-muted-foreground">
        {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
      </span>
    </div>
  </div>
</div>

<div class="flex w-full flex-col">
  <BreakdownRow
    label={$_('page.financialData.nav.cash')}
    amount={appStore.formatCurrencyCode(cash)}
    color={CATEGORY_COLORS.cash}
  />
  <BreakdownRow
    label={$_('page.financialData.nav.investments')}
    amount={appStore.formatCurrencyCode(investments)}
    color={CATEGORY_COLORS.investments[0]}
  />
  <BreakdownRow
    label={$_('page.financialData.nav.tangibleAssets')}
    amount={appStore.formatCurrencyCode(tangible)}
    color={CATEGORY_COLORS.tangibleAssets[0]}
  />
  <BreakdownRow
    label={$_('page.financialData.overview.totalAssets')}
    amount={appStore.formatCurrencyCode(totalAssets)}
    bold
  />
  <BreakdownRow
    label={$_('page.financialData.nav.liabilities')}
    amount={appStore.formatCurrencyCode(-liabilities)}
    color={CATEGORY_COLORS.liabilities[0]}
    negative
  />
  <BreakdownRow
    label={$_('page.financialData.overview.netWorth')}
    amount={appStore.formatCurrencyCode(netWorth)}
    bold
  />
</div>
