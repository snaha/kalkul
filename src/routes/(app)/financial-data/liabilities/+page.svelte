<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import LiabilitiesEditor from '$lib/components/liabilities-editor.svelte'
  import { getLiabilitiesTotal } from '$lib/financial-totals'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn, formatLastUpdated } from '$lib/utils'

  const liabilities = $derived(appStore.profile.liabilities ?? [])
  const total = $derived(getLiabilitiesTotal(appStore.profile))

  const segments = $derived(
    liabilities
      .filter((l) => l.outstanding_balance > 0)
      .map((l, idx) => ({
        label: l.name,
        value: l.outstanding_balance,
        color: CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length],
      })),
  )

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
</script>

<div class="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
  <DonutChart {segments} size={160} variant="pie" />
  <div class="flex flex-1 flex-col items-start gap-2">
    <p class="text-lg leading-7 font-medium">{$_('page.financialData.liabilities.title')}</p>
    <p class={cn('text-3xl leading-9 font-bold', total > 0 && 'text-destructive')}>
      {appStore.formatCurrencyCode(-total)}
    </p>
    <span class="text-xs leading-4 text-muted-foreground">
      {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
    </span>
  </div>
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.liabilities.description')}
</p>

<LiabilitiesEditor />
