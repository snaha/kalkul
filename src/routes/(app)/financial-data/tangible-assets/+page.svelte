<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import ReadOnlyItemCard from '$lib/components/read-only-item-card.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getTangibleAssetsTotal } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

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

{#if tangibleAssets.length === 0}
  <p class="w-full py-8 text-center text-sm text-muted-foreground">
    {$_('page.financialData.tangibleAssets.empty')}
  </p>
{:else}
  <div class="flex w-full flex-col gap-2">
    {#each tangibleAssets as asset, idx (asset.id)}
      <ReadOnlyItemCard
        name={asset.name}
        value={appStore.formatCurrencyCode(asset.value)}
        dotColor={CATEGORY_COLORS.tangibleAssets[idx % CATEGORY_COLORS.tangibleAssets.length]}
      />
    {/each}
  </div>
{/if}

<Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT_TANGIBLE_ASSETS)}>
  <Plus class="size-4" />
  {$_('page.setup.tangibleAssets.addAsset')}
</Button>
