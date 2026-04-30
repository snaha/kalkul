<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import ReadOnlyItemCard from '$lib/components/read-only-item-card.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getLiabilitiesTotal } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

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
    <p class="text-3xl leading-9 font-bold text-destructive">
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

{#if liabilities.length === 0}
  <p class="w-full py-8 text-center text-sm text-muted-foreground">
    {$_('page.financialData.liabilities.empty')}
  </p>
{:else}
  <div class="flex w-full flex-col gap-2">
    {#each liabilities as liability, idx (liability.id)}
      <ReadOnlyItemCard
        name={liability.name}
        value={appStore.formatCurrencyCode(-liability.outstanding_balance)}
        valueClass="text-destructive"
        dotColor={CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length]}
      />
    {/each}
  </div>
{/if}

<Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT_LIABILITIES)}>
  <Plus class="size-4" />
  {$_('page.setup.liabilities.addLiability')}
</Button>
