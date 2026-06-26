<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import TangibleAssetsEditor from '$lib/components/tangible-assets-editor.svelte'
  import { getTangibleAssetsTotal } from '$lib/financial-totals'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const tangibleAssets = $derived(appStore.profile.tangible_assets ?? [])
  const total = $derived(getTangibleAssetsTotal(appStore.profile))

  const segments = $derived(
    tangibleAssets
      .filter((a) => a.value > 0)
      .map((a, idx) => ({
        label: a.name,
        value: a.value,
        color: CATEGORY_COLORS.tangibleAssets[idx % CATEGORY_COLORS.tangibleAssets.length],
      })),
  )

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
</script>

<div class="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
  <DonutChart {segments} size={160} variant="pie" />
  <div class="flex flex-1 flex-col items-start gap-2">
    <p class="text-lg leading-7 font-medium">{$_('page.financialData.tangibleAssets.title')}</p>
    <p class="text-3xl leading-9 font-bold">{appStore.formatCurrencyCode(total)}</p>
    <span class="text-xs leading-4 text-muted-foreground">
      {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
    </span>
  </div>
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.tangibleAssets.description')}
</p>

<TangibleAssetsEditor />
