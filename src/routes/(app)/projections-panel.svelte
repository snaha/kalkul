<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import { resolve } from '$app/paths'

  import plansIllustration from '$lib/assets/plans-illustration.svg'
  import AddProjectionDialog from '$lib/components/add-projection-dialog.svelte'
  import ProjectionThumbnail from '$lib/components/projection-thumbnail.svelte'
  import type { BarData } from '$lib/components/stacked-bar-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import { buildCurrentProjectionPlan } from '$lib/current-projection'
  import { type YearlyProjection, getYearlyPlanProjection } from '$lib/plan-projection'
  import routes from '$lib/routes'
  import type { Portfolio, Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    /** Balances as they stand today — pass the projected profile. */
    profile: Profile
    today: Date
    /** With nothing to project from, the panel falls back to its empty state. */
    hasFinancialData: boolean
  }

  let { profile, today, hasFinancialData }: Props = $props()

  let addProjectionOpen = $state(false)
  const hasPlans = $derived(appStore.portfolios.length > 0)

  const toBars = (years: YearlyProjection[]): BarData[] =>
    years.map((year) => ({
      year: year.year,
      cash: year.cash,
      investments: year.investments,
      tangibleAssets: year.tangibleAssets,
      liabilities: year.liabilities,
    }))

  // "Current projection" is derived, not stored: the user's finances carried
  // forward with nothing changed.
  const currentProjection = $derived(
    hasFinancialData
      ? toBars(getYearlyPlanProjection(buildCurrentProjectionPlan(profile, today), profile))
      : [],
  )

  // Precomputed rather than called from the template: each entry runs a full
  // multi-decade projection, which must not re-run on unrelated re-renders.
  const planCards = $derived(
    appStore.portfolios.map((portfolio) => {
      const plan: Portfolio = portfolio.toJSON()
      return {
        id: plan.id,
        name: plan.name,
        notes: plan.notes,
        bars: toBars(getYearlyPlanProjection(plan, profile)),
      }
    }),
  )
</script>

<div class="flex min-w-0 flex-1 flex-col">
  <div class="flex items-center gap-4 p-8">
    <h2 class="flex-1 text-2xl font-bold">{$_('page.dashboard.projections.title')}</h2>
    <!-- Shown for any profile with financial data, including one with no plans
         yet: the explore card below carries its own CTA, and per the design the
         header button stays put rather than appearing once a plan exists. Also
         shown for saved plans without balances, where the empty state (with its
         own CTA) is not what the panel renders. -->
    {#if hasFinancialData || hasPlans}
      <Button variant="outline" size="sm" onclick={() => (addProjectionOpen = true)}>
        <Plus />
        {$_('page.dashboard.projections.addProjection')}
      </Button>
    {/if}
  </div>

  {#if hasFinancialData || hasPlans}
    <!-- Rendered whenever there is anything to list: balances to project, saved
         plans, or both. A profile with plans but no balances still reaches its
         plans from here — the empty state below would hide them. -->
    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-8 pb-8">
      <!-- Current projection: first whenever there are balances to project.
           Without them there is nothing to carry forward, so it is left out —
           the saved plans below still stand on their own. -->
      {#if hasFinancialData}
        <Card.Root class="gap-0 bg-accent py-0 shadow-xs">
          <Card.Content class="flex items-center gap-4 p-4">
            <div class="h-[81px] w-[144px] shrink-0 overflow-hidden rounded-lg">
              <ProjectionThumbnail
                data={currentProjection}
                ariaLabel={$_('page.dashboard.projections.current.chartLabel')}
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex items-center gap-1">
                <p class="font-bold">{$_('page.dashboard.projections.current.title')}</p>
                <Badge variant="outline" class="bg-background">
                  {$_('page.dashboard.projections.current.badge')}
                </Badge>
              </div>
              <p class="text-sm">{$_('page.dashboard.projections.current.description')}</p>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}

      {#if hasPlans}
        {#each planCards as plan (plan.id)}
          <a
            href={resolve(`${routes.PLAN_VIEW}/${plan.id}`)}
            class="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent"
          >
            <div class="h-[81px] w-[144px] shrink-0 overflow-hidden rounded-lg">
              <ProjectionThumbnail
                data={plan.bars}
                ariaLabel={$_('page.dashboard.projections.planChartLabel', {
                  values: { name: plan.name },
                })}
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p class="font-bold">{plan.name}</p>
              <p class="text-sm text-muted-foreground">
                {plan.notes || $_('page.dashboard.projections.noNotes')}
              </p>
            </div>
          </a>
        {/each}
      {:else}
        <!-- Only the automatic projection so far: invite the first "what if".
             Reachable only with financial data — the branch above covers every
             case where a plan exists. -->
        <Card.Root class="gap-0 py-0 shadow-xs">
          <Card.Content class="flex items-center gap-4 p-4">
            <div class="flex min-w-0 flex-1 flex-col text-sm">
              <p class="font-bold">{$_('page.dashboard.projections.explore.title')}</p>
              <p>{$_('page.dashboard.projections.explore.description')}</p>
            </div>
            <Button onclick={() => (addProjectionOpen = true)}>
              {$_('page.dashboard.projections.addProjection')}
            </Button>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {:else}
    <!-- Nothing to project from and no plans yet. Not drawn in the spec, which
         only covers a populated dashboard — kept from the previous page. -->
    <div class="flex flex-1 flex-col items-center gap-8 p-8 pt-0">
      <img
        src={plansIllustration}
        alt={$_('page.dashboard.projections.illustrationAlt')}
        class="size-64"
      />
      <div class="flex w-full flex-col gap-2 text-center">
        <h3 class="text-xl font-bold">{$_('page.dashboard.projections.emptyTitle')}</h3>
        <div class="flex flex-col gap-1">
          <p class="text-base">{$_('page.dashboard.projections.emptySubtitle')}</p>
          <p class="text-sm text-muted-foreground">
            {$_('page.dashboard.projections.emptyDescription')}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onclick={() => (addProjectionOpen = true)}>
        {$_('page.dashboard.projections.makeFirstProjection')}
      </Button>
    </div>
  {/if}
</div>

<AddProjectionDialog bind:open={addProjectionOpen} onOpenChange={(v) => (addProjectionOpen = v)} />
