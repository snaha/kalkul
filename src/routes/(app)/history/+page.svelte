<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'
  import X from '@lucide/svelte/icons/x'

  import { resolve } from '$app/paths'

  import HistoryChart from '$lib/components/history-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getCurrentProfile } from '$lib/current-values'
  import { buildHistorySeries, hasHistoryToShow } from '$lib/history-series'
  import routes from '$lib/routes'
  import type { Snapshot } from '$lib/schemas'
  import { buildSnapshotRows } from '$lib/snapshot-rows'
  import { staleSince as staleSinceOf } from '$lib/snapshots'
  import { appStore } from '$lib/stores/app.svelte'
  import { trackToday } from '$lib/today.svelte'
  import { toDateOnlyString } from '$lib/utils'

  import QuickUpdateDialog from '../quick-update-dialog.svelte'
  import StaleDataAlert from '../stale-data-alert.svelte'
  import SnapshotDialog from './snapshot-dialog.svelte'
  import { seedSnapshotOn } from './snapshot-form'
  import SnapshotsTable from './snapshots-table.svelte'

  // One clock for the whole page, following the calendar past midnight.
  const clock = trackToday()
  const today = $derived(clock.today)
  const todayDate = $derived(toDateOnlyString(today))

  const storedProfile = $derived(appStore.profile.toJSON())
  const currentProfile = $derived(getCurrentProfile(storedProfile, today))
  // Recorded snapshots keep the page open on their own: a profile that spent
  // its way to zero has no balances left but a history worth reading.
  const hasHistory = $derived(!appStore.loading && hasHistoryToShow(storedProfile))

  const staleSince = $derived(staleSinceOf(storedProfile.snapshots, todayDate))

  const historyPoints = $derived(buildHistorySeries(storedProfile, today))
  const rows = $derived(buildSnapshotRows(storedProfile))
  const takenDates = $derived((storedProfile.snapshots ?? []).map((s) => s.date))

  let quickUpdateOpen = $state(false)
  let snapshotOpen = $state(false)
  let snapshotMode = $state<'add' | 'edit'>('add')
  // Placeholder until one of the openers below fills it in.
  let snapshotSource = $state<Snapshot>({ date: '' })
  let snapshotOriginalDate = $state<string | undefined>(undefined)
  let snapshotSeedOn = $state<((date: string) => Snapshot) | undefined>(undefined)

  const snapshotOn = (date: string) =>
    (storedProfile.snapshots ?? []).find((snapshot) => snapshot.date === date)

  function openAdd(): void {
    snapshotMode = 'add'
    // Seeded with the app's own estimate for the date — today's projected
    // balances to begin with, the same figures Quick update starts from — and
    // re-seeded when the user picks another day. A blank form would ask them to
    // retype everything they already told the app.
    const seedOn = (date: string) => seedSnapshotOn(storedProfile, date)
    snapshotSource = seedOn(todayDate)
    snapshotSeedOn = seedOn
    snapshotOriginalDate = undefined
    snapshotOpen = true
  }

  function openEdit(date: string): void {
    const snapshot = snapshotOn(date)
    if (!snapshot) return
    snapshotMode = 'edit'
    snapshotSource = snapshot
    snapshotSeedOn = undefined
    snapshotOriginalDate = date
    snapshotOpen = true
  }

  function openDuplicate(date: string): void {
    const snapshot = snapshotOn(date)
    if (!snapshot) return
    // A copy is a new snapshot, so it starts at today and leaves the original
    // where it is — the user re-dates it if they meant another day. Its figures
    // are the copied ones whatever the date, so it is not re-seeded.
    snapshotMode = 'add'
    snapshotSource = { ...snapshot, date: todayDate }
    snapshotSeedOn = undefined
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
      {#if hasHistory}
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
  seedOn={snapshotSeedOn}
  onConfirm={(snapshot, original) => appStore.saveSnapshot(snapshot, original)}
/>
