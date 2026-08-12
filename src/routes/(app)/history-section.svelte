<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import HistoryChart from '$lib/components/history-chart.svelte'
  import { Button } from '$lib/components/ui/button'
  import type { HistoryPoint } from '$lib/snapshots'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented, parseDateOnly } from '$lib/utils'

  interface Props {
    points: HistoryPoint[]
  }

  let { points }: Props = $props()

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
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="flex items-center gap-2">
    <h3 class="flex-1 text-sm font-bold">{$_('page.dashboard.finances.history.title')}</h3>
    <Button variant="outline" size="xs" onclick={notImplemented}>
      {$_('page.dashboard.finances.history.viewDetails')}
    </Button>
  </div>
  <HistoryChart
    {points}
    formatValue={appStore.formatCompactCurrency}
    {formatMonth}
    nowLabel={$_('page.dashboard.finances.history.now')}
    ariaLabel={$_('page.dashboard.finances.history.chartLabel')}
    class="min-h-0 flex-1"
  />
</div>
