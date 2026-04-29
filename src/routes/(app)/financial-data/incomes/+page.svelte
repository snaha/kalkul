<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ReadOnlyCashFlowRow from '$lib/components/read-only-cash-flow-row.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  const incomes = $derived(appStore.profile.incomes ?? [])

  const lastUpdatedDate = $derived.by(() => {
    const ms = appStore.lastUpdated > 0 ? appStore.lastUpdated : Date.now()
    const d = new Date(ms)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })

  const frequencyShort = $derived({
    monthly: $_('page.financialData.frequency.short.monthly'),
    yearly: $_('page.financialData.frequency.short.yearly'),
    weekly: $_('page.financialData.frequency.short.weekly'),
  })
</script>

<div class="flex w-full flex-col items-start gap-2">
  <p class="text-lg leading-7 font-medium">{$_('page.financialData.incomes.title')}</p>
  <span class="text-xs leading-4 text-muted-foreground">
    {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
  </span>
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.incomes.description')}
</p>

{#if incomes.length === 0}
  <p class="w-full py-8 text-center text-sm text-muted-foreground">
    {$_('page.financialData.incomes.empty')}
  </p>
{:else}
  <div class="flex w-full flex-col gap-2">
    {#each incomes as income (income.id)}
      <ReadOnlyCashFlowRow
        name={income.name}
        amount={income.amount}
        frequency={income.frequency}
        sentiment="positive"
        formatCurrency={appStore.formatCurrencyCode}
        {frequencyShort}
      />
    {/each}
  </div>
{/if}
