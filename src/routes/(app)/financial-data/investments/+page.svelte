<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import ReadOnlyItemCard from '$lib/components/read-only-item-card.svelte'
  import { getInvestmentsTotal } from '$lib/financial-totals'
  import { appStore } from '$lib/stores/app.svelte'

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

  const lastUpdatedDate = $derived.by(() => {
    const ms = appStore.lastUpdated > 0 ? appStore.lastUpdated : Date.now()
    const d = new Date(ms)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })
</script>

<div class="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
  <DonutChart {segments} centerLabel="" size={160} />
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
