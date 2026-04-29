<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ReadOnlyCashFlowRow from '$lib/components/read-only-cash-flow-row.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  const expenses = $derived(appStore.profile.expenses ?? [])

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
  <p class="text-lg leading-7 font-medium">{$_('page.financialData.expenses.title')}</p>
  <span class="text-xs leading-4 text-muted-foreground">
    {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
  </span>
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.expenses.description')}
</p>

{#if expenses.length === 0}
  <p class="w-full py-8 text-center text-sm text-muted-foreground">
    {$_('page.financialData.expenses.empty')}
  </p>
{:else}
  <div class="flex w-full flex-col gap-2">
    {#each expenses as expense (expense.id)}
      <ReadOnlyCashFlowRow
        name={expense.name}
        amount={expense.amount}
        frequency={expense.frequency}
        sentiment="negative"
        formatCurrency={appStore.formatCurrencyCode}
        {frequencyShort}
      />
    {/each}
  </div>
{/if}
