<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import HistoryChart from '$lib/components/history-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import type { HistoryPoint } from '$lib/history-series'
  import routes from '$lib/routes'
  import type { Snapshot } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  import SnapshotDialog from './snapshot-dialog.svelte'

  interface Props {
    points: HistoryPoint[]
    /** Today as a date-only ISO string, from the page's clock. */
    todayDate: string
  }

  let { points, todayDate }: Props = $props()

  // A dot opens its snapshot for editing; with no snapshot recorded yet there
  // is nothing to edit, so the chart offers no click.
  const snapshots = $derived(appStore.profile.toJSON().snapshots ?? [])
  const takenDates = $derived(snapshots.map((snapshot) => snapshot.date))
  let editOpen = $state(false)
  // Placeholder until a dot fills it in.
  let editSource = $state<Snapshot>({ date: '' })

  function openEdit(date: string): void {
    const snapshot = snapshots.find((s) => s.date === date)
    if (!snapshot) return
    editSource = snapshot
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
    onSelect={snapshots.length > 0 ? openEdit : undefined}
    class="min-h-0 flex-1"
  />
</div>

<SnapshotDialog
  bind:open={editOpen}
  mode="edit"
  source={editSource}
  originalDate={editSource.date}
  {takenDates}
  today={todayDate}
  onConfirm={(snapshot, original) => appStore.saveSnapshot(snapshot, original)}
/>
