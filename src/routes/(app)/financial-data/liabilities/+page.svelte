<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'

  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import LiabilitiesEditor from '$lib/components/liabilities-editor.svelte'
  import { getLiabilitiesTotal } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const liabilities = $derived(appStore.profile.liabilities ?? [])
  const total = $derived(getLiabilitiesTotal(appStore.profile))

  const standaloneSegments = $derived(
    liabilities
      .filter((l) => l.outstanding_balance > 0)
      .map((l, idx) => ({
        label: l.name,
        value: l.outstanding_balance,
        color: CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length],
      })),
  )

  // Financed tangible assets (e.g. a mortgaged house) count as debt too —
  // listed read-only below and included in the pie so it adds up to the
  // total. Their terms are edited on the tangible-assets page.
  const financedDebts = $derived(
    (appStore.profile.tangible_assets ?? [])
      .filter((a) => a.status === 'financed' && (a.outstanding_balance ?? 0) > 0)
      .map((a, idx) => ({
        id: a.id,
        label: a.name,
        value: a.outstanding_balance ?? 0,
        color:
          CATEGORY_COLORS.liabilities[
            (standaloneSegments.length + idx) % CATEGORY_COLORS.liabilities.length
          ],
      })),
  )

  const segments = $derived([...standaloneSegments, ...financedDebts])

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

<LiabilitiesEditor />

{#if financedDebts.length > 0}
  <div class="flex w-full flex-col gap-4">
    <p class="text-sm leading-5 text-muted-foreground">
      {$_('page.financialData.liabilities.financedCaption')}
    </p>
    {#each financedDebts as debt (debt.id)}
      <a
        href={resolve(routes.FINANCIAL_DATA_TANGIBLE_ASSETS)}
        class="flex items-center gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent"
      >
        <div class="size-4 shrink-0 rounded-xs" style:background-color={debt.color}></div>
        <span class="flex-1 truncate text-base font-medium">{debt.label}</span>
        <span class="shrink-0 text-sm">{appStore.formatCurrency(debt.value)}</span>
        <ArrowRight class="size-4 shrink-0 text-muted-foreground" />
      </a>
    {/each}
  </div>
{/if}
