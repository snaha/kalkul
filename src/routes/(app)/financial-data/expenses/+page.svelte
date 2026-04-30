<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import ReadOnlyCashFlowRow from '$lib/components/read-only-cash-flow-row.svelte'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const expenses = $derived(appStore.profile.expenses ?? [])

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
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
      />
    {/each}
  </div>
{/if}

<Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT_EXPENSES)}>
  <Plus class="size-4" />
  {$_('page.setup.expenses.addExpense')}
</Button>
