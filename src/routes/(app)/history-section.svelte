<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import HistoryChart, { type HistoryView } from '$lib/components/history-chart.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    type HistoryPoint,
    type HistoryRange,
    historyChangePercent,
    historyInRange,
  } from '$lib/history-series'
  import routes from '$lib/routes'
  import type { Snapshot } from '$lib/schemas'
  import { seedSnapshotOn } from '$lib/snapshot-form'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  import SnapshotDialog from './snapshot-dialog.svelte'

  interface Props {
    points: HistoryPoint[]
    /** Today as a date-only ISO string, from the page's clock. */
    todayDate: string
  }

  let { points, todayDate }: Props = $props()

  // A recorded dot opens its snapshot for editing; with no snapshot recorded
  // yet there is nothing to edit, so the chart offers no click. The projected
  // "now" dot — today, not yet recorded — offers to add one.
  const storedProfile = $derived(appStore.profile.toJSON())
  const snapshots = $derived(storedProfile.snapshots ?? [])
  const takenDates = $derived(snapshots.map((snapshot) => snapshot.date))
  let range = $state<HistoryRange>('all')
  const ranges = $derived<SelectFieldItem<HistoryRange>[]>([
    { value: 'all', label: $_('page.dashboard.finances.history.range.all') },
    { value: '1m', label: $_('page.dashboard.finances.history.range.1m') },
    { value: '3m', label: $_('page.dashboard.finances.history.range.3m') },
    { value: '6m', label: $_('page.dashboard.finances.history.range.6m') },
    { value: '1y', label: $_('page.dashboard.finances.history.range.1y') },
    { value: '2y', label: $_('page.dashboard.finances.history.range.2y') },
  ])
  const visiblePoints = $derived(historyInRange(points, range, todayDate))

  let view = $state<HistoryView>('netWorth')
  const views = $derived<SelectFieldItem<HistoryView>[]>([
    { value: 'netWorth', label: $_('page.dashboard.finances.history.view.netWorth') },
    { value: 'breakdown', label: $_('page.dashboard.finances.history.view.breakdown') },
    { value: 'cash', label: $_('page.plan.cash') },
    { value: 'investments', label: $_('page.plan.investments') },
    { value: 'tangibleAssets', label: $_('page.plan.tangibleAssets') },
    { value: 'liabilities', label: $_('page.plan.liabilities') },
  ])

  // What the selected view plots, summed: the figure the change is measured on.
  const viewValue: Record<HistoryView, (point: HistoryPoint) => number> = {
    netWorth: (p) => p.netWorth,
    breakdown: (p) => p.cash + p.investments + p.tangibleAssets,
    cash: (p) => p.cash,
    investments: (p) => p.investments,
    tangibleAssets: (p) => p.tangibleAssets,
    liabilities: (p) => p.liabilities,
  }
  // Rounded to what the label prints, so a change that reads 0.0% is coloured
  // as no change.
  const change = $derived.by(() => {
    const percent = historyChangePercent(visiblePoints, viewValue[view])
    return percent === undefined ? undefined : Math.round(percent * 10) / 10
  })

  let dialogOpen = $state(false)
  let dialogMode = $state<'add' | 'edit'>('edit')
  // Placeholder until a dot fills it in.
  let dialogSource = $state<Snapshot>({ date: '' })
  let seedOn = $state<((date: string) => Snapshot) | undefined>(undefined)

  function openEdit(date: string): void {
    const snapshot = snapshots.find((s) => s.date === date)
    if (!snapshot) return
    dialogMode = 'edit'
    dialogSource = snapshot
    seedOn = undefined
    dialogOpen = true
  }

  function openAdd(): void {
    // Seeded with the app's estimate for the date, as the History page's Add
    // is, and re-seeded if the user picks another day.
    const seed = (date: string) => seedSnapshotOn(storedProfile, date)
    dialogMode = 'add'
    dialogSource = seed(todayDate)
    seedOn = seed
    dialogOpen = true
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="flex items-center gap-2">
    <h3 class="text-sm font-bold">{$_('page.dashboard.finances.history.title')}</h3>
    <span
      class={cn(
        'flex-1 text-sm font-medium',
        change === undefined || change === 0
          ? 'text-muted-foreground'
          : change > 0
            ? 'text-success'
            : 'text-destructive',
      )}
    >
      {change === undefined ? '' : appStore.formatPercent(change, 1, true)}
    </span>
    <SelectField
      bind:value={range}
      items={ranges}
      aria-label={$_('page.dashboard.finances.history.range.label')}
      class="h-6! w-auto text-xs"
    />
    <SelectField
      bind:value={view}
      items={views}
      aria-label={$_('page.dashboard.finances.history.view.label')}
      class="h-6! w-auto text-xs"
    />
    <Button variant="outline" size="xs" href={resolve(routes.HISTORY)}>
      {$_('page.dashboard.finances.history.viewDetails')}
    </Button>
  </div>
  <HistoryChart
    points={visiblePoints}
    {view}
    formatValue={appStore.formatCompactCurrency}
    formatAmount={appStore.formatCurrency}
    formatDate={appStore.formatDateOnly}
    formatPercent={appStore.formatPercent}
    formatNumber={appStore.formatNumber}
    nowLabel={$_('page.dashboard.finances.history.now')}
    ariaLabel={$_('page.dashboard.finances.history.chartLabel')}
    onSelect={snapshots.length > 0 ? openEdit : undefined}
    onAdd={openAdd}
    class="min-h-0 flex-1"
  />
</div>

<SnapshotDialog
  bind:open={dialogOpen}
  mode={dialogMode}
  source={dialogSource}
  originalDate={dialogMode === 'edit' ? dialogSource.date : undefined}
  {takenDates}
  today={todayDate}
  {seedOn}
  onConfirm={(snapshot, original) => appStore.saveSnapshot(snapshot, original)}
/>
