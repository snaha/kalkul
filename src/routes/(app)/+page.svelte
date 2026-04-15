<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight, Calendar, Plus, SquarePen } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { getFirstAddPlanStepUrl } from '$lib/add-plan-steps'
  import financesIllustration from '$lib/assets/finances-illustration.svg'
  import heroIllustration from '$lib/assets/hero-illustration.svg'
  import plansIllustration from '$lib/assets/plans-illustration.svg'
  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import DonutChart from '$lib/components/donut-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

  const addPlanUrl = $derived(getFirstAddPlanStepUrl(appStore.profile))

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)
  const hasFinancialData = $derived.by(() => {
    if (!hasData) return false
    if ((appStore.profile.cash_amount ?? 0) > 0) return true
    if ((appStore.profile.investments ?? []).some((i) => i.balance > 0)) return true
    if ((appStore.profile.tangible_assets ?? []).some((a) => a.value > 0)) return true
    if ((appStore.profile.liabilities ?? []).some((l) => l.outstanding_balance > 0)) return true
    return false
  })

  const chartSegments = $derived.by(() => {
    const segments: { label: string; value: number; color: string }[] = []
    const cash = appStore.profile.cash_amount ?? 0
    if (cash > 0) {
      segments.push({ label: 'cash', value: cash, color: CATEGORY_COLORS.cash })
    }
    const investmentsTotal = (appStore.profile.investments ?? []).reduce(
      (sum, i) => sum + i.balance,
      0,
    )
    if (investmentsTotal > 0) {
      segments.push({
        label: 'investments',
        value: investmentsTotal,
        color: CATEGORY_COLORS.investments[0],
      })
    }
    const tangibleTotal = (appStore.profile.tangible_assets ?? []).reduce(
      (sum, a) => sum + a.value,
      0,
    )
    if (tangibleTotal > 0) {
      segments.push({
        label: 'tangible-assets',
        value: tangibleTotal,
        color: CATEGORY_COLORS.tangibleAssets[0],
      })
    }
    const liabilitiesTotal = (appStore.profile.liabilities ?? []).reduce(
      (sum, l) => sum + l.outstanding_balance,
      0,
    )
    if (liabilitiesTotal > 0) {
      segments.push({
        label: 'liabilities',
        value: liabilitiesTotal,
        color: CATEGORY_COLORS.liabilities[0],
      })
    }
    return segments
  })

  const totalNetWorth = $derived(
    chartSegments.reduce(
      (sum, s) => (s.label === 'liabilities' ? sum - s.value : sum + s.value),
      0,
    ),
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
          <Button variant="ghost" size="icon" onclick={notImplemented}>
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
            <Button variant="secondary" size="sm" onclick={notImplemented}>
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
