<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import HistoryChart from '$lib/components/history-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import type { HistoryPoint } from '$lib/history-series'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  import SnapshotEditDialog from './snapshot-edit-dialog.svelte'

  interface Props {
    points: HistoryPoint[]
  }

  let { points }: Props = $props()

  // A dot opens its snapshot for editing; with no snapshot recorded yet there
  // is nothing to edit, so the chart offers no click.
  const hasSnapshots = $derived((appStore.profile.snapshots ?? []).length > 0)
  let editOpen = $state(false)
  let editDate = $state('')

  function openEdit(date: string): void {
    editDate = date
    editOpen = true
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="flex items-center gap-2">
    <h3 class="flex-1 text-sm font-bold">{$_('page.dashboard.finances.history.title')}</h3>
    <Button variant="outline" size="xs" href={resolve(routes.HISTORY)}>
      {$_('page.dashboard.finances.history.viewDetails')}
    </Button>
  </div>
  <HistoryChart
    {points}
    formatValue={appStore.formatCompactCurrency}
    formatAmount={appStore.formatCurrency}
    formatDate={appStore.formatDateOnly}
    formatPercent={appStore.formatPercent}
    formatNumber={appStore.formatNumber}
    nowLabel={$_('page.dashboard.finances.history.now')}
    ariaLabel={$_('page.dashboard.finances.history.chartLabel')}
    onSelect={hasSnapshots ? openEdit : undefined}
    class="min-h-0 flex-1"
  />
</div>

<SnapshotEditDialog bind:open={editOpen} date={editDate} />
