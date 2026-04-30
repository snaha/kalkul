<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import ReadOnlyItemCard from '$lib/components/read-only-item-card.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getInvestmentsTotal } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const investments = $derived(appStore.profile.investments ?? [])
  const total = $derived(getInvestmentsTotal(appStore.profile))

  const segments = $derived(
    investments
      .filter((i) => i.balance > 0)
      .map((i, idx) => ({
        label: i.name,
        value: i.balance,
        color: CATEGORY_COLORS.investments[idx % CATEGORY_COLORS.investments.length],
      })),
  )

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
</script>

<div class="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
  <DonutChart {segments} size={160} variant="pie" />
  <div class="flex flex-1 flex-col items-start gap-2">
    <p class="text-lg leading-7 font-medium">{$_('page.financialData.investments.title')}</p>
    <p class="text-3xl leading-9 font-bold">{appStore.formatCurrencyCode(total)}</p>
    <span class="text-xs leading-4 text-muted-foreground">
      {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
    </span>
  </div>
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.investments.description')}
</p>

{#if investments.length === 0}
  <p class="w-full py-8 text-center text-sm text-muted-foreground">
    {$_('page.financialData.investments.empty')}
  </p>
{:else}
  <div class="flex w-full flex-col gap-2">
    {#each investments as investment, idx (investment.id)}
      <ReadOnlyItemCard
        name={investment.name}
        value={appStore.formatCurrencyCode(investment.balance)}
        dotColor={CATEGORY_COLORS.investments[idx % CATEGORY_COLORS.investments.length]}
      />
    {/each}
  </div>
{/if}

<Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT_INVESTMENTS)}>
  <Plus class="size-4" />
  {$_('page.setup.investments.addInvestment')}
</Button>
