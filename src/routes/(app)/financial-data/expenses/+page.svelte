<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ExpensesEditor from '$lib/components/expenses-editor.svelte'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

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

<ExpensesEditor />
