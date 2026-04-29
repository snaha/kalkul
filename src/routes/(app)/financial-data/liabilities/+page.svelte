<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import ReadOnlyItemCard from '$lib/components/read-only-item-card.svelte'
  import { getLiabilitiesTotal } from '$lib/financial-totals'
  import { appStore } from '$lib/stores/app.svelte'

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
  <DonutChart {segments} centerLabel="" size={160} variant="pie" />
  <div class="flex flex-1 flex-col items-start gap-2">
    <p class="text-lg leading-7 font-medium">{$_('page.financialData.liabilities.title')}</p>
    <p class="text-3xl leading-9 font-bold text-destructive">
      -{appStore.formatCurrencyCode(total)}
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
        value={`-${appStore.formatCurrencyCode(liability.outstanding_balance)}`}
        valueClass="text-destructive"
        dotColor={CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length]}
      />
    {/each}
  </div>
{/if}
