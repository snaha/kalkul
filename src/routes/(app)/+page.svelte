<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight, Calendar, Plus, SquarePen } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { getFirstAddPlanStepUrl } from '$lib/add-plan-steps'
  import financesIllustration from '$lib/assets/finances-illustration.svg'
  import heroIllustration from '$lib/assets/hero-illustration.svg'
  import plansIllustration from '$lib/assets/plans-illustration.svg'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Progress } from '$lib/components/ui/progress'
  import { Separator } from '$lib/components/ui/separator'
  import {
    getFiPercent,
    getNetWorth,
    getOverviewSegments,
    getRunwayYears,
    hasAnyFinancialData,
  } from '$lib/financial-totals'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  const addPlanUrl = $derived(getFirstAddPlanStepUrl(appStore.profile))

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)
  const hasFinancialData = $derived(hasData && hasAnyFinancialData(appStore.profile))

  const chartSegments = $derived(getOverviewSegments(appStore.profile))
  const totalNetWorth = $derived(getNetWorth(appStore.profile))
  const fiPercent = $derived(getFiPercent(appStore.profile))
  const runwayYears = $derived(getRunwayYears(appStore.profile))

  // Selects which chart is shown below once the snapshot-based charts exist.
  type HeadlineCard = 'netWorth' | 'fi' | 'runway'
  let selectedCard = $state<HeadlineCard>('netWorth')

  const cardClass = (card: HeadlineCard) =>
    cn(
      'flex flex-1 cursor-pointer flex-col rounded-xl border p-4 text-left shadow-xs transition-colors',
      selectedCard === card ? 'bg-accent' : 'bg-card hover:bg-accent/50',
    )
</script>

{#if hasData}
  <div class="flex flex-1">
    <!-- Left panel: Current finances -->
    <div class="flex flex-1 flex-col">
      <div class="flex items-start gap-4 p-8">
        <div class="flex flex-1 items-center gap-2">
          <h2 class="text-2xl font-bold">{$_('page.dashboard.finances.title')}</h2>
          {#if hasFinancialData}
            <Badge variant="outline">
              <Calendar class="size-3" />
              {$_('page.dashboard.finances.today')}
            </Badge>
          {:else}
            <Badge variant="destructive">{$_('page.dashboard.finances.missing')}</Badge>
          {/if}
        </div>
        {#if hasFinancialData}
          <Button size="sm" href={resolve(routes.FINANCES_EDIT)}>
            <SquarePen class="size-4" />
            {$_('page.dashboard.finances.update')}
          </Button>
          <Button variant="ghost" size="icon" href={resolve(routes.FINANCIAL_DATA)}>
            <ArrowRight class="size-4" />
          </Button>
        {:else}
          <Button size="sm" href={resolve(routes.FINANCES_EDIT)}>
            <SquarePen class="size-4" />
            {$_('page.dashboard.finances.addData')}
          </Button>
          <Button variant="ghost" size="icon" disabled>
            <ArrowRight class="size-4" />
          </Button>
        {/if}
      </div>

      {#if hasFinancialData}
        <div class="flex flex-1 flex-col items-center gap-8 p-8">
          <div class="flex w-full gap-2">
            <button
              type="button"
              class={cardClass('netWorth')}
              aria-pressed={selectedCard === 'netWorth'}
              onclick={() => (selectedCard = 'netWorth')}
            >
              <p class="text-sm">{$_('page.dashboard.finances.netWorthCard.title')}</p>
              <p class="text-xl font-extrabold">{appStore.formatCompactCurrency(totalNetWorth)}</p>
              <p class="text-xs text-muted-foreground">
                {$_('page.dashboard.finances.netWorthCard.description')}
              </p>
            </button>
            <button
              type="button"
              class={cardClass('fi')}
              aria-pressed={selectedCard === 'fi'}
              onclick={() => (selectedCard = 'fi')}
            >
              <p class="text-sm">{$_('page.dashboard.finances.fiCard.title')}</p>
              {#if fiPercent !== undefined}
                <div class="flex items-center gap-2">
                  <p class="text-xl font-extrabold">{Math.round(fiPercent)}%</p>
                  <Progress value={Math.min(fiPercent, 100)} class="flex-1" />
                </div>
                <p class="text-xs text-muted-foreground">
                  {$_('page.dashboard.finances.fiCard.description')}
                </p>
              {:else}
                <p class="text-xl font-extrabold">—</p>
                <p class="text-xs text-muted-foreground">
                  {$_('page.dashboard.finances.noExpensesHint')}
                </p>
              {/if}
            </button>
            <button
              type="button"
              class={cardClass('runway')}
              aria-pressed={selectedCard === 'runway'}
              onclick={() => (selectedCard = 'runway')}
            >
              <p class="text-sm">{$_('page.dashboard.finances.runwayCard.title')}</p>
              {#if runwayYears !== undefined}
                <p class="text-xl font-extrabold">
                  {$_('page.dashboard.finances.runwayCard.value', {
                    values: {
                      years: appStore.formatNumber(Math.round(runwayYears * 10) / 10),
                    },
                  })}
                </p>
                <p class="text-xs text-muted-foreground">
                  {$_('page.dashboard.finances.runwayCard.description')}
                </p>
              {:else}
                <p class="text-xl font-extrabold">—</p>
                <p class="text-xs text-muted-foreground">
                  {$_('page.dashboard.finances.noExpensesHint')}
                </p>
              {/if}
            </button>
          </div>
          <DonutChart
            segments={chartSegments}
            centerLabel={appStore.formatCompactCurrency(totalNetWorth)}
          />
          <div class="flex w-full flex-col gap-2 text-center">
            <h3 class="text-xl font-bold">
              {$_('page.dashboard.finances.netWorthSummary', {
                values: {
                  total: appStore.formatCurrency(totalNetWorth),
                },
              })}
            </h3>
            <div class="flex flex-col gap-1">
              <p class="text-base">{$_('page.dashboard.finances.lastUpdated')}</p>
              <p class="text-sm text-muted-foreground">
                {$_('page.dashboard.finances.keepUpToDate')}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-center gap-4">
            <Button variant="ghost" size="sm" href={resolve(routes.FINANCES_EDIT)}>
              {$_('page.dashboard.finances.update')}
            </Button>
            <Button variant="secondary" size="sm" href={resolve(routes.FINANCIAL_DATA)}>
              {$_('page.dashboard.finances.viewAll')}
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex flex-1 flex-col items-center gap-8 p-8">
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

    <!-- Right panel: Plans -->
    <div class="flex flex-1 flex-col">
      <div class="flex items-start gap-4 p-8">
        <h2 class="flex-1 text-2xl font-bold">{$_('page.dashboard.plans.title')}</h2>
        <Button size="sm" href={addPlanUrl}>
          <Plus class="size-4" />
          {$_('page.dashboard.plans.addPlan')}
        </Button>
      </div>

      {#if appStore.portfolios.length > 0}
        <!-- Plan cards list -->
        <div class="flex flex-col gap-4 overflow-y-auto p-8 pt-0">
          {#each appStore.portfolios as portfolio (portfolio.id)}
            <a
              href={resolve(`${routes.PLAN_VIEW}/${portfolio.id}`)}
              class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent"
            >
              <!-- Chart thumbnail placeholder -->
              <div
                class="flex h-[81px] w-[144px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
              >
                <Calendar class="size-8 text-muted-foreground" />
              </div>

              <!-- Text content -->
              <div class="flex flex-1 flex-col gap-1">
                <p class="font-bold">{portfolio.name}</p>
                <p class="text-muted-foreground">
                  {portfolio.notes || $_('page.dashboard.plans.noNotes')}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <!-- Empty state -->
        <div class="flex flex-1 flex-col items-center gap-8 p-8">
          <img
            src={plansIllustration}
            alt={$_('page.dashboard.plans.illustrationAlt')}
            class="size-64"
          />
          <div class="flex w-full flex-col gap-2 text-center">
            <h3 class="text-xl font-bold">{$_('page.dashboard.plans.emptyTitle')}</h3>
            <div class="flex flex-col gap-1">
              <p class="text-base">{$_('page.dashboard.plans.emptySubtitle')}</p>
              <p class="text-sm text-muted-foreground">
                {$_('page.dashboard.plans.emptyDescription')}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" href={addPlanUrl}>
            {$_('page.dashboard.plans.makeFirstPlan')}
          </Button>
        </div>
      {/if}
    </div>
  </div>
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
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
{/if}
