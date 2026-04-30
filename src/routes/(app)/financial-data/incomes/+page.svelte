<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import ReadOnlyCashFlowRow from '$lib/components/read-only-cash-flow-row.svelte'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const incomes = $derived(appStore.profile.incomes ?? [])

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))
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
      />
    {/each}
  </div>
{/if}

<Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT_INCOME)}>
  <Plus class="size-4" />
  {$_('page.setup.income.addIncome')}
</Button>
