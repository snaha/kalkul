<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'
  import X from '@lucide/svelte/icons/x'

  import { resolve } from '$app/paths'

  import HistoryChart from '$lib/components/history-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getCurrentProfile } from '$lib/current-values'
  import { hasAnyFinancialData } from '$lib/financial-totals'
  import { buildHistorySeries } from '$lib/history-series'
  import routes from '$lib/routes'
  import type { Snapshot } from '$lib/schemas'
  import { buildSnapshotRows } from '$lib/snapshot-rows'
  import { captureSnapshot, latestSnapshot } from '$lib/snapshots'
  import { appStore } from '$lib/stores/app.svelte'
  import { parseDateOnly, toDateOnlyString } from '$lib/utils'

  import QuickUpdateDialog from '../quick-update-dialog.svelte'
  import StaleDataAlert from '../stale-data-alert.svelte'
  import SnapshotDialog from './snapshot-dialog.svelte'
  import SnapshotsTable from './snapshots-table.svelte'

  // Read once per page render: every figure below has to agree on "today", and
  // re-reading the clock mid-render could straddle midnight.
  const today = new Date()
  const todayDate = toDateOnlyString(today)

  const storedProfile = $derived(appStore.profile.toJSON())
  const currentProfile = $derived(getCurrentProfile(storedProfile, today))
  const hasFinancialData = $derived(!appStore.loading && hasAnyFinancialData(storedProfile))

  const lastSnapshotDate = $derived(latestSnapshot(storedProfile.snapshots)?.date)
  const staleSince = $derived(
    lastSnapshotDate && lastSnapshotDate < todayDate ? lastSnapshotDate : undefined,
  )

  const historyPoints = $derived(buildHistorySeries(storedProfile, today))
  const rows = $derived(buildSnapshotRows(storedProfile))
  const takenDates = $derived((storedProfile.snapshots ?? []).map((s) => s.date))

  // Month names are translations, so they follow the UI language rather than
  // the profile's number-formatting locale. Only the leading tick carries a
  // year, matching the spec.
  const shortMonth = $derived(new Intl.DateTimeFormat($locale ?? undefined, { month: 'short' }))
  const monthWithYear = $derived(
    new Intl.DateTimeFormat($locale ?? undefined, { month: 'short', year: 'numeric' }),
  )

  function formatMonth(date: string, isFirst: boolean): string {
    const parsed = parseDateOnly(date)
    return isFirst ? monthWithYear.format(parsed) : shortMonth.format(parsed)
  }

  let quickUpdateOpen = $state(false)
  let snapshotOpen = $state(false)
  let snapshotMode = $state<'add' | 'edit'>('add')
  let snapshotSource = $state<Snapshot>({ date: todayDate })
  let snapshotOriginalDate = $state<string | undefined>(undefined)

  const snapshotOn = (date: string) =>
    (storedProfile.snapshots ?? []).find((snapshot) => snapshot.date === date)

  function openAdd(): void {
    snapshotMode = 'add'
    // Seeded from the balances as they stand today, the same figures Quick
    // update starts from — a blank form would ask the user to retype
    // everything they already told the app.
    snapshotSource = captureSnapshot(currentProfile, todayDate)
    snapshotOriginalDate = undefined
    snapshotOpen = true
  }

  function openEdit(date: string): void {
    const snapshot = snapshotOn(date)
    if (!snapshot) return
    snapshotMode = 'edit'
    snapshotSource = snapshot
    snapshotOriginalDate = date
    snapshotOpen = true
  }

  function openDuplicate(date: string): void {
    const snapshot = snapshotOn(date)
    if (!snapshot) return
    // A copy is a new snapshot, so it starts at today and leaves the original
    // where it is — the user re-dates it if they meant another day.
    snapshotMode = 'add'
    snapshotSource = { ...snapshot, date: todayDate }
    snapshotOriginalDate = undefined
    snapshotOpen = true
  }

  function confirmDelete(date: string): void {
    const label = appStore.formatDateOnly(date)
    if (window.confirm($_('page.history.row.deleteConfirm', { values: { date: label } }))) {
      appStore.deleteSnapshot(date)
    }
  }
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
  <div class="flex items-center gap-4 p-8">
    <h1 class="flex-1 text-2xl leading-8 font-bold">{$_('page.history.title')}</h1>
    <Button
      variant="ghost"
      size="icon"
      href={resolve(routes.HOME)}
      aria-label={$_('page.history.close')}
    >
      <X class="size-4" />
    </Button>
  </div>

  <div class="flex flex-1 justify-center px-8 pb-8">
    <div class="flex w-full max-w-[576px] flex-col gap-8">
      {#if hasFinancialData}
        <div class="flex flex-col gap-4">
          {#if staleSince}
            <StaleDataAlert
              lastUpdated={staleSince}
              onQuickUpdate={() => (quickUpdateOpen = true)}
            />
          {/if}

          <div class="flex flex-col gap-1">
            <h2 class="text-base font-bold">{$_('page.history.heading')}</h2>
            <p class="text-base">{$_('page.history.description')}</p>
          </div>

          <HistoryChart
            points={historyPoints}
            formatValue={appStore.formatCompactCurrency}
            {formatMonth}
            nowLabel={$_('page.history.now')}
            ariaLabel={$_('page.history.chartLabel')}
            class="h-96"
          />
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <h2 class="flex-1 text-base font-bold">{$_('page.history.snapshots')}</h2>
            <!-- Not drawn in the spec, which shows the Add snapshot dialog
                 without an entry point to it. -->
            <Button variant="outline" size="sm" onclick={openAdd}>
              <Plus />
              {$_('page.history.addSnapshot')}
            </Button>
          </div>

          {#if rows.length > 0}
            <SnapshotsTable
              {rows}
              onEdit={openEdit}
              onDuplicate={openDuplicate}
              onDelete={confirmDelete}
            />
          {:else}
            <p class="text-sm text-muted-foreground">{$_('page.history.emptyDescription')}</p>
          {/if}
        </div>
      {:else if !appStore.loading}
        <!-- Not drawn in the spec, which only covers a populated history. -->
        <div class="flex flex-col gap-2 pt-8 text-center">
          <h2 class="text-xl font-bold">{$_('page.history.emptyTitle')}</h2>
          <p class="text-base text-muted-foreground">{$_('page.history.emptyDescription')}</p>
          <div class="flex justify-center pt-4">
            <Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT)}>
              {$_('page.dashboard.finances.addFinancialData')}
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if staleSince}
  <QuickUpdateDialog
    bind:open={quickUpdateOpen}
    {storedProfile}
    projectedProfile={currentProfile}
    lastUpdated={staleSince}
  />
{/if}

<SnapshotDialog
  bind:open={snapshotOpen}
  mode={snapshotMode}
  source={snapshotSource}
  originalDate={snapshotOriginalDate}
  {takenDates}
  today={todayDate}
  onConfirm={(snapshot, original) => appStore.saveSnapshot(snapshot, original)}
/>
