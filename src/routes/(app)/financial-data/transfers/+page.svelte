<script lang="ts">
  import { _ } from 'svelte-i18n'

  import TransfersEditor from '$lib/components/transfers-editor.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  const lastUpdatedDate = $derived(appStore.formatLastUpdated())
</script>

<div class="flex w-full flex-col items-start gap-2">
  <p class="text-lg leading-7 font-medium">{$_('page.financialData.transfers.title')}</p>
  {#if lastUpdatedDate}
    <span class="text-xs leading-4 text-muted-foreground">
      {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
    </span>
  {/if}
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.transfers.description')}
</p>

<TransfersEditor />
