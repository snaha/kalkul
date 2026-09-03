<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import SquarePen from '@lucide/svelte/icons/square-pen'

  import { resolve } from '$app/paths'

  import financesIllustration from '$lib/assets/finances-illustration.svg'
  import heroIllustration from '$lib/assets/hero-illustration.svg'
  import { Button } from '$lib/components/ui/button'
  import { Progress } from '$lib/components/ui/progress'
  import { Separator } from '$lib/components/ui/separator'
  import { getCurrentProfile } from '$lib/current-values'
  import { getFiPercent, getRunwayYears, hasAnyFinancialData } from '$lib/financial-totals'
  import { buildHistorySeries } from '$lib/history-series'
  import routes from '$lib/routes'
  import { latestSnapshot } from '$lib/snapshots'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented, toDateOnlyString } from '$lib/utils'

  import HistorySection from './history-section.svelte'
  import MetricCard from './metric-card.svelte'
  import NetWorthCard from './net-worth-card.svelte'
  import ProjectionsPanel from './projections-panel.svelte'
  import QuickUpdateDialog from './quick-update-dialog.svelte'
  import SavingsRateCard from './savings-rate-card.svelte'
  import StaleDataAlert from './stale-data-alert.svelte'

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)
  const hasFinancialData = $derived(hasData && hasAnyFinancialData(appStore.profile))

  // One clock for the whole page: every figure below has to agree on "today",
  // and re-reading it mid-render could straddle midnight. It is state rather
  // than a constant because a dashboard is left open for days — frozen at its
  // mount date it would stop projecting, never raise the staleness banner, and
  // record yesterday's projected values on Confirm.
  let today = $state(new Date())
  const todayDate = $derived(toDateOnlyString(today))

  $effect(() => {
    // `today` is only read from the callbacks, never while the effect runs, so
    // this subscribes once instead of re-arming on every replacement.
    let timer: ReturnType<typeof setTimeout>

    function refresh(): void {
      const now = new Date()
      // Only a new calendar day changes anything on this page, so everything
      // downstream is left alone until the date itself rolls over.
      if (toDateOnlyString(now) !== toDateOnlyString(today)) today = now
    }

    // One timer aimed at the next midnight, rather than a poll running all day
    // to catch a single rollover. Re-armed after each one so a dashboard left
    // open for a week keeps following the calendar.
    function armForMidnight(): void {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(() => {
        refresh()
        armForMidnight()
      }, nextMidnight.getTime() - now.getTime())
    }
    armForMidnight()

    // A backgrounded tab throttles its timers, so the midnight one can fire
    // late; coming back to the tab must not show yesterday's dashboard while
    // it is still pending.
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  })

  const storedProfile = $derived(appStore.profile.toJSON())
  // The stored balances are as of the last snapshot; everything on this page
  // shows them carried forward to today.
  const currentProfile = $derived(getCurrentProfile(storedProfile, today))

  const lastSnapshotDate = $derived(latestSnapshot(storedProfile.snapshots)?.date)
  // Only stale once the balances predate today — a snapshot taken today needs
  // no projection and no nudge to update.
  const staleSince = $derived(
    lastSnapshotDate && lastSnapshotDate < todayDate ? lastSnapshotDate : undefined,
  )

  const fiPercent = $derived(getFiPercent(currentProfile))
  const runwayYears = $derived(getRunwayYears(currentProfile))
  // The stored profile, not the projected one: the series carries the balances
  // forward itself, sampling the tail so compounding reads as a curve.
  const historyPoints = $derived(buildHistorySeries(storedProfile, today))

  let quickUpdateOpen = $state(false)
</script>

{#if hasData}
  <div class="flex min-h-0 flex-1">
    <!-- Left panel: Current finances -->
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-4 p-8">
        <h2 class="flex-1 text-2xl font-bold">{$_('page.dashboard.finances.title')}</h2>
        {#if hasFinancialData}
          <Button variant="outline" size="sm" href={resolve(routes.FINANCIAL_DATA)}>
            {$_('page.dashboard.finances.viewAllFinancialData')}
          </Button>
        {:else}
          <Button size="sm" href={resolve(routes.FINANCES_EDIT)}>
            <SquarePen />
            {$_('page.dashboard.finances.addData')}
          </Button>
        {/if}
      </div>

      {#if hasFinancialData}
        <div class="flex min-h-0 flex-1 flex-col gap-8 px-8 pb-8">
          <div class="flex flex-col gap-4">
            {#if staleSince}
              <StaleDataAlert
                lastUpdated={staleSince}
                onQuickUpdate={() => (quickUpdateOpen = true)}
              />
            {/if}

            <div class="flex items-stretch gap-2">
              <NetWorthCard profile={currentProfile} projectedFrom={staleSince} />

              <div class="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <SavingsRateCard profile={currentProfile} />

                <MetricCard
                  title={$_('page.dashboard.finances.runwayCard.title')}
                  help={$_('page.dashboard.finances.runwayCard.help')}
                  settingsLabel={$_('page.dashboard.finances.runwayCard.settings')}
                  onSettings={notImplemented}
                >
                  {#if runwayYears !== undefined}
                    <p class="text-xl font-extrabold">
                      {$_('page.dashboard.finances.runwayCard.value', {
                        values: {
                          years: appStore.formatNumber(Math.round(runwayYears * 10) / 10),
                        },
                      })}
                    </p>
                  {:else}
                    <p class="text-xl font-extrabold">—</p>
                    <p class="text-xs text-muted-foreground">
                      {$_('page.dashboard.finances.noExpensesHint')}
                    </p>
                  {/if}
                </MetricCard>

                <MetricCard
                  title={$_('page.dashboard.finances.fiCard.title')}
                  help={$_('page.dashboard.finances.fiCard.help')}
                  settingsLabel={$_('page.dashboard.finances.fiCard.settings')}
                  onSettings={notImplemented}
                >
                  {#if fiPercent !== undefined}
                    <div class="flex items-center gap-2">
                      <p class="text-xl font-extrabold">{appStore.formatPercent(fiPercent, 0)}</p>
                      <Progress value={Math.min(fiPercent, 100)} class="flex-1" />
                    </div>
                  {:else}
                    <p class="text-xl font-extrabold">—</p>
                    <p class="text-xs text-muted-foreground">
                      {$_('page.dashboard.finances.noExpensesHint')}
                    </p>
                  {/if}
                </MetricCard>
              </div>
            </div>
          </div>

          <HistorySection points={historyPoints} />
        </div>
      {:else}
        <!-- Nothing entered yet. Not drawn in the spec, which only covers a
             populated dashboard — kept from the previous page. -->
        <div class="flex flex-1 flex-col items-center gap-8 p-8 pt-0">
          <img
            src={financesIllustration}
            alt={$_('page.dashboard.finances.illustrationAlt')}
            class="size-64"
          />
          <div class="flex w-full flex-col gap-2 text-center">
            <h3 class="text-xl font-bold">{$_('page.dashboard.finances.emptyTitle')}</h3>
            <div class="flex flex-col gap-1">
              <p class="text-base">{$_('page.dashboard.finances.emptySubtitle')}</p>
              <p class="text-sm text-muted-foreground">
                {$_('page.dashboard.finances.emptyDescription')}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" href={resolve(routes.FINANCES_EDIT)}>
            {$_('page.dashboard.finances.addFinancialData')}
          </Button>
        </div>
      {/if}
    </div>

    <Separator orientation="vertical" class="self-stretch data-[orientation=vertical]:h-auto" />

    <ProjectionsPanel profile={currentProfile} {today} {hasFinancialData} />
  </div>

  {#if staleSince}
    <QuickUpdateDialog
      bind:open={quickUpdateOpen}
      {storedProfile}
      projectedProfile={currentProfile}
      lastUpdated={staleSince}
    />
  {/if}
{:else if !appStore.loading}
  <div class="flex flex-1 flex-col items-center p-8">
    <div class="flex w-full max-w-[576px] flex-col items-center gap-4">
      <img src={heroIllustration} alt={$_('page.home.heroAlt')} class="size-80" />
      <div class="flex w-full flex-col gap-2 text-center text-foreground">
        <h1 class="text-3xl font-bold leading-9">
          {$_('page.home.heroTitle')}
        </h1>
        <p class="text-lg">
          {$_('page.home.heroDescription')}
        </p>
      </div>
      <Button href={resolve(routes.PROFILE)} size="lg">
        {$_('page.home.getStarted')}
        <ArrowRight />
      </Button>
    </div>
  </div>
{/if}
