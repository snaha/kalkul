<script lang="ts">
  import { tick } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import PanelRight from '@lucide/svelte/icons/panel-right'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Rows2 from '@lucide/svelte/icons/rows-2'
  import Settings2 from '@lucide/svelte/icons/settings-2'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import AddProjectionDialog from '$lib/components/add-projection-dialog.svelte'
  import ChartTooltipContent from '$lib/components/chart-tooltip-content.svelte'
  import DemoPersonaDialog from '$lib/components/demo-persona-dialog.svelte'
  import Loader from '$lib/components/loader.svelte'
  import StackedBarChart, {
    type BarData,
    type HoverPosition,
  } from '$lib/components/stacked-bar-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { CURRENT_PROJECTION_ID, buildCurrentProjectionPlan } from '$lib/current-projection'
  import { getCurrentProfile } from '$lib/current-values'
  import { DEMO_PLAN_ID } from '$lib/demo'
  import { isPlanOutdated, snapshotFinancialData } from '$lib/plan-base'
  import { followsInflation, getYearlyPlanProjection, yearOf } from '$lib/plan-projection'
  import routes from '$lib/routes'
  import type {
    Expense,
    Income,
    PlanListKey,
    Portfolio,
    Profile,
    ProfileLiability,
    Transfer,
  } from '$lib/schemas'
  import { getFrequencyShortLabel } from '$lib/select-options'
  import { dismiss, isDismissed } from '$lib/session-dismissal'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'
  import { trackToday } from '$lib/today.svelte'
  import { notImplemented } from '$lib/utils'

  import AddAssetDialog, { type AssetKind as AddAssetKind } from './add-asset-dialog.svelte'
  import AddCashFlowDialog from './add-cash-flow-dialog.svelte'
  import AssetEditDialog, { type AssetTarget } from './asset-edit-dialog.svelte'
  import CashEditDialog from './cash-edit-dialog.svelte'
  import CashFlowEditDialog from './cash-flow-edit-dialog.svelte'
  import LiabilityEditDialog from './liability-edit-dialog.svelte'
  import PlanDetailsPanel from './plan-details-panel.svelte'
  import PlanItemsPanel, { type PlanItemSection } from './plan-items-panel.svelte'
  import TransferEditDialog from './transfer-edit-dialog.svelte'

  const planId = $derived(page.params.id)
  // The dashboard's "Current projection" opens here too: the same synthesized
  // plan the thumbnail draws, read-only — the profile is edited under
  // Financial data, not through a plan. Nothing can be saved to it, so the
  // dialogs and the settings page stay reachable only for a saved plan.
  const readOnly = $derived(planId === CURRENT_PROJECTION_ID)
  // The demo persona's plan: editable like any saved plan, but its title bar
  // offers another persona instead of the way back to the dashboard.
  const isDemoPlan = $derived(planId === DEMO_PLAN_ID)
  let personaDialogOpen = $state(false)
  const savedPlan = $derived(appStore.portfolios.find((p) => p.id === planId))
  // One clock for the page, rolling over at midnight like the dashboard's.
  const clock = trackToday()
  // The Current projection starts from today's balances — the stored ones
  // carried forward, as the dashboard shows them — so the two agree. A saved
  // plan projects the stored data it was written against.
  const profile = $derived<Profile>(
    readOnly ? getCurrentProfile(appStore.profile.toJSON(), clock.today) : appStore.profile,
  )
  const plan = $derived<Portfolio | undefined>(
    readOnly
      ? appStore.loading
        ? undefined
        : buildCurrentProjectionPlan(profile, clock.today)
      : savedPlan,
  )
  // A saved plan is a copy of the financial data of its creation. Once that
  // data moves on, the plan no longer starts from what the user has today;
  // bringing it up to date is a planned feature, so for now the page says so.
  // "I understand" hides the bar on this plan for the rest of the browser
  // session, and only for the financial data it was closed on: when that
  // changes again the plan is further out of date and the bar is back.
  const outdatedKey = $derived(storageKeys.OUTDATED_DISMISSED + planId)
  const financialDataState = $derived(JSON.stringify(snapshotFinancialData(profile)))
  let outdatedDismissals = $state(0)
  const outdatedDismissed = $derived.by(() => {
    void outdatedDismissals
    return isDismissed(outdatedKey, financialDataState)
  })
  const outdated = $derived(
    !readOnly && plan !== undefined && !outdatedDismissed && isPlanOutdated(plan, profile),
  )

  function dismissOutdated() {
    dismiss(outdatedKey, financialDataState)
    outdatedDismissals += 1
  }
  // Nothing on the Current projection can be edited: every "add" opens the
  // Model changes dialog, which starts a plan to make the change in.
  let modelChangesOpen = $state(false)

  // Year range from portfolio dates (yearOf: date-only strings parse as UTC,
  // so new Date(...).getFullYear() would be off by one in UTC-negative zones)
  const startYear = $derived(plan ? yearOf(plan.start_date) : new Date().getFullYear())
  const endYear = $derived(plan ? yearOf(plan.end_date) : new Date().getFullYear())

  // State for UI
  let selectedYear = $state(new Date().getFullYear())
  let isPanelOpen = $state(true)
  let isLeftPanelOpen = $state(true)
  // Cash-flow edit dialog state
  let editDialogOpen = $state(false)
  let editDialogKind = $state<'income' | 'expense'>('income')
  let editDialogInitial = $state<Income | Expense | undefined>(undefined)
  let addCashFlowDialogOpen = $state(false)

  // Asset edit dialog state
  let assetDialogOpen = $state(false)
  let assetDialogTarget = $state<AssetTarget>({ kind: 'investment' })
  let cashDialogOpen = $state(false)
  let addAssetDialogOpen = $state(false)

  // Liability edit dialog state (separate from the asset dialog: its Figma is
  // distinct enough to have its own component).
  let liabilityDialogOpen = $state(false)
  let liabilityDialogInitial = $state<ProfileLiability | undefined>(undefined)

  // Transfer edit dialog state
  let transferDialogOpen = $state(false)
  let transferDialogInitial = $state<Transfer | undefined>(undefined)

  function openEditDialog(kind: 'income' | 'expense', item: Income | Expense) {
    editDialogKind = kind
    editDialogInitial = item
    editDialogOpen = true
  }

  function openCreateDialog(kind: 'income' | 'expense') {
    editDialogKind = kind
    editDialogInitial = undefined
    editDialogOpen = true
  }

  function openAssetEditDialog(target: AssetTarget) {
    assetDialogTarget = target
    assetDialogOpen = true
  }

  function openLiabilityEditDialog(initial: ProfileLiability | undefined) {
    liabilityDialogInitial = initial
    liabilityDialogOpen = true
  }

  function openAssetCreateDialog(kind: AddAssetKind) {
    if (kind === 'liability') {
      openLiabilityEditDialog(undefined)
      return
    }
    // Spelled out per kind so each branch is a valid AssetTarget literal.
    assetDialogTarget = kind === 'investment' ? { kind: 'investment' } : { kind: 'tangibleAsset' }
    assetDialogOpen = true
  }

  function openTransferDialog(item: Transfer) {
    transferDialogInitial = item
    transferDialogOpen = true
  }

  function openCreateTransferDialog() {
    transferDialogInitial = undefined
    transferDialogOpen = true
  }

  function handleAddCashFlowContinue(kind: 'transfer' | 'income' | 'expense') {
    if (kind === 'transfer') {
      openCreateTransferDialog()
    } else {
      openCreateDialog(kind)
    }
  }

  let hoveredYear = $state<number | undefined>(undefined)
  let hoverPosition = $state<HoverPosition | undefined>(undefined)
  let chartContainerRef: HTMLDivElement | undefined = $state()
  let pageContainerRef: HTMLDivElement | undefined = $state()
  let chartContainerHeight = $state(0)
  let chartContainerWidth = $state(0)

  // Measure chart container dimensions
  function measureChartDimensions() {
    if (chartContainerRef) {
      chartContainerHeight = chartContainerRef.clientHeight
      chartContainerWidth = chartContainerRef.clientWidth
    }
  }

  // Measure on mount and when sidebar toggles
  $effect(() => {
    if (!chartContainerRef) return

    // Track sidebar state to trigger remeasure
    const _sidebarOpen = isPanelOpen
    const _leftSidebarOpen = isLeftPanelOpen

    // Wait for layout to settle, then measure
    tick().then(() => {
      requestAnimationFrame(measureChartDimensions)
    })
  })

  // Measure on window resize
  $effect(() => {
    const handleResize = () => {
      requestAnimationFrame(measureChartDimensions)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })

  // Clamp selected year to valid range when portfolio changes
  $effect(() => {
    if (selectedYear < startYear) selectedYear = startYear
    if (selectedYear > endYear) selectedYear = endYear
  })

  // The plan's own items, the same the engine sees. Nothing until the plan
  // has resolved.
  function listOf<K extends PlanListKey>(key: K): Portfolio[K] {
    return plan ? plan[key] : []
  }
  // Yearly projection (real / inflation-adjusted values)
  const projection = $derived(plan ? getYearlyPlanProjection(plan, profile) : [])

  // Union of per-year warning IDs — a transfer or expense that fails in any
  // year of the plan is surfaced in the sidebar with a destructive badge.
  const failingTransferIds = $derived(
    new Set(projection.flatMap((p) => p.insufficientFundTransferIds)),
  )
  const failingExpenseIds = $derived(
    new Set(projection.flatMap((p) => p.insufficientFundExpenseIds)),
  )
  const failingAssetIds = $derived(new Set(projection.flatMap((p) => p.insufficientFundAssetIds)))

  // First year with any insufficient-funds warning. The chart marks this year
  // with a destructive triangle so the user can jump to the source of the
  // problem instead of scrubbing year-by-year.
  const firstErrorYear = $derived(
    projection.find(
      (p) =>
        p.insufficientFundTransferIds.length > 0 ||
        p.insufficientFundExpenseIds.length > 0 ||
        p.insufficientFundAssetIds.length > 0,
    )?.year,
  )

  // The amount of a cash flow as entered: a rate for a recurring one
  // ("1,000 EUR/m"), the bare amount for a one-time one.
  function entered(amount: string, flow: Income | Expense | Transfer): string {
    if (flow.schedule === 'one_time') return amount
    return `${amount}/${getFrequencyShortLabel($_, flow.frequency ?? 'monthly', flow.repeat_every)}`
  }

  // Nothing on the Current projection can be edited: its rows open nothing
  // and every "add" offers to start a plan instead.
  function editing<T extends unknown[]>(action: (...args: T) => void) {
    return readOnly ? undefined : action
  }
  function adding(action: () => void): () => void {
    return readOnly ? () => (modelChangesOpen = true) : action
  }

  const itemSections = $derived<PlanItemSection[]>([
    {
      id: 'cashFlows',
      label: $_('page.plan.cashFlows'),
      addLabel: $_('page.plan.addCashFlow'),
      onAdd: adding(() => (addCashFlowDialogOpen = true)),
      groups: [
        {
          id: 'transfers',
          label: $_('page.plan.transfers'),
          addLabel: $_('page.plan.newTransfer'),
          onAdd: adding(openCreateTransferDialog),
          rows: listOf('transfers').map((t) => ({
            id: t.id,
            name: t.name,
            value: entered(
              t.transfer_all ? $_('page.plan.transferMax') : appStore.formatCurrencyCode(t.amount),
              t,
            ),
            inflationAdjusted: !t.transfer_all && followsInflation(t),
            hasInsufficientFunds: failingTransferIds.has(t.id),
            onClick: editing(() => openTransferDialog(t)),
          })),
        },
        {
          id: 'incomes',
          label: $_('page.plan.details.income'),
          addLabel: $_('page.plan.newIncome'),
          onAdd: adding(() => openCreateDialog('income')),
          rows: listOf('incomes').map((i) => ({
            id: i.id,
            name: i.name,
            value: entered(`+${appStore.formatCurrencyCode(i.amount)}`, i),
            inflationAdjusted: followsInflation(i),
            onClick: editing(() => openEditDialog('income', i)),
          })),
        },
        {
          id: 'expenses',
          label: $_('page.plan.expenses'),
          addLabel: $_('page.plan.newExpense'),
          onAdd: adding(() => openCreateDialog('expense')),
          rows: listOf('expenses').map((e) => ({
            id: e.id,
            name: e.name,
            value: entered(`-${appStore.formatCurrencyCode(e.amount)}`, e),
            inflationAdjusted: followsInflation(e),
            hasInsufficientFunds: failingExpenseIds.has(e.id),
            onClick: editing(() => openEditDialog('expense', e)),
          })),
        },
      ],
    },
    {
      id: 'assets',
      label: $_('page.plan.assets'),
      addLabel: $_('page.plan.addAsset'),
      onAdd: adding(() => (addAssetDialogOpen = true)),
      groups: [
        // Cash always exists (#331): one row, which opens its balance.
        {
          id: 'cash',
          label: $_('page.plan.cash'),
          rows: [],
          onClick: editing(() => (cashDialogOpen = true)),
        },
        {
          id: 'investments',
          label: $_('page.plan.investments'),
          addLabel: $_('page.plan.addInvestmentTitle'),
          onAdd: adding(() => openAssetCreateDialog('investment')),
          rows: listOf('investments').map((inv) => ({
            id: inv.id,
            name: inv.name,
            hasInsufficientFunds: failingAssetIds.has(inv.id),
            onClick: editing(() => openAssetEditDialog({ kind: 'investment', initial: inv })),
          })),
        },
        {
          id: 'tangibleAssets',
          label: $_('page.plan.tangibleAssets'),
          addLabel: $_('page.plan.addTangibleAssetTitle'),
          onAdd: adding(() => openAssetCreateDialog('tangibleAsset')),
          rows: listOf('tangible_assets').map((a) => ({
            id: a.id,
            name: a.name,
            hasInsufficientFunds: failingAssetIds.has(a.id),
            onClick: editing(() => openAssetEditDialog({ kind: 'tangibleAsset', initial: a })),
          })),
        },
        {
          id: 'liabilities',
          label: $_('page.plan.liabilities'),
          addLabel: $_('page.setup.liabilities.addLiability'),
          onAdd: adding(() => openAssetCreateDialog('liability')),
          rows: listOf('liabilities').map((l) => ({
            id: l.id,
            name: l.name,
            onClick: editing(() => openLiabilityEditDialog(l)),
          })),
        },
      ],
    },
  ])

  // What a row of the right sidebar opens: the same dialog as the row of that
  // item on the left, by item id, with 'cash' for the cash balance.
  const itemOpeners = $derived(
    new Map(
      itemSections.flatMap((section) =>
        section.groups.flatMap((g) => [
          [g.id, g.onClick] as const,
          ...g.rows.map((r) => [r.id, r.onClick] as const),
        ]),
      ),
    ),
  )

  // Legend items for the chart
  const legendItems = [
    { id: 'cash', label: $_('page.plan.cash'), color: CATEGORY_COLORS.cash },
    {
      id: 'investments',
      label: $_('page.plan.investments'),
      color: CATEGORY_COLORS.investments[0],
    },
    {
      id: 'tangibleAssets',
      label: $_('page.plan.tangibleAssets'),
      color: CATEGORY_COLORS.tangibleAssets[0],
    },
    {
      id: 'liabilities',
      label: $_('page.plan.liabilities'),
      color: CATEGORY_COLORS.liabilities[0],
    },
  ]

  // Calculate age from birth date for the selected year
  const currentAge = $derived.by(() => {
    const birthDate = appStore.profile.birthDate
    if (!birthDate) return undefined
    return selectedYear - birthDate.getFullYear()
  })

  // Calculate age for hovered year
  const hoveredAge = $derived.by(() => {
    const birthDate = appStore.profile.birthDate
    if (!birthDate || hoveredYear === undefined) return undefined
    return hoveredYear - birthDate.getFullYear()
  })

  // Get data for hovered year
  const hoveredData = $derived.by(() => {
    if (hoveredYear === undefined) return undefined
    return chartData.find((d) => d.year === hoveredYear)
  })

  // Calculate tooltip position relative to the page container (allows tooltip to overlay sidebars)
  const tooltipPosition = $derived.by(() => {
    if (!hoverPosition || !pageContainerRef) return undefined
    const containerRect = pageContainerRef.getBoundingClientRect()
    const left = hoverPosition.x - containerRect.left
    const top = hoverPosition.y - containerRect.top
    const isRightSide = left > containerRect.width / 2
    return { left, top, isRightSide }
  })

  // Chart data derived from the yearly projection (real / inflation-adjusted values)
  const chartData = $derived<BarData[]>(
    projection.map((p) => ({
      year: p.year,
      cash: p.cash,
      investments: p.investments,
      tangibleAssets: p.tangibleAssets,
      liabilities: p.liabilities,
    })),
  )

  function handleYearClick(year: number) {
    selectedYear = year
    isPanelOpen = true
  }

  function handleYearHover(year: number | undefined, position?: HoverPosition) {
    hoveredYear = year
    hoverPosition = position
  }
</script>

{#if plan}
  {#if outdated}
    <div role="status" class="flex items-center gap-2 border-b bg-notice p-2.5 text-sm font-medium">
      <TriangleAlert class="size-6 shrink-0" aria-hidden="true" />
      <p class="min-w-0 flex-1">{$_('page.plan.outdated')}</p>
      <Button size="xs" onclick={dismissOutdated}>
        {$_('page.plan.outdatedDismiss')}
      </Button>
    </div>
  {/if}
  <div bind:this={pageContainerRef} class="relative flex min-h-0 flex-1 overflow-hidden">
    <!-- Left Panel: what the plan is made of -->
    <!-- Hidden rather than unmounted, so the groups that were open stay open. -->
    <div class="contents" hidden={!isLeftPanelOpen}>
      <PlanItemsPanel sections={itemSections} />
    </div>

    <!-- Center Panel: Chart area (placeholder) -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden border-l">
      <!-- Header with icons -->
      <div class="flex items-center gap-2 p-4">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={$_('page.plan.toggleSidebar')}
            title={$_('page.plan.toggleSidebar')}
            onclick={() => (isLeftPanelOpen = !isLeftPanelOpen)}
          >
            <PanelLeft class="size-4" />
          </Button>
          {#if isDemoPlan}
            <Button
              variant="ghost"
              size="icon"
              aria-label={$_('page.demo.switchPersona')}
              onclick={() => (personaDialogOpen = true)}
            >
              <RefreshCw class="size-4" />
            </Button>
            <h2 class="text-xl font-bold">{plan.name}</h2>
            <Badge variant="outline">{$_('page.demo.badge')}</Badge>
          {:else}
            <Button
              variant="ghost"
              size="icon"
              href={resolve(routes.HOME)}
              aria-label={$_('page.plan.backToHome')}
            >
              <ArrowLeft class="size-4" />
            </Button>
            {#if readOnly}
              <h2 class="text-xl font-bold whitespace-nowrap">
                {$_('page.dashboard.projections.current.title')}
              </h2>
              <Badge variant="outline">{$_('page.dashboard.projections.current.badge')}</Badge>
            {:else}
              <h2 class="text-xl font-bold">{plan.name}</h2>
            {/if}
          {/if}
        </div>
        {#if readOnly}
          <Button size="sm" onclick={() => (modelChangesOpen = true)}>
            {$_('page.plan.modelChanges')}
          </Button>
        {:else}
          <Button
            variant="ghost"
            size="icon"
            href={resolve(routes.PLAN_SETTINGS, { id: planId ?? '' })}
            aria-label={$_('page.planSettings.title')}
          >
            <Settings2 class="size-4" />
          </Button>
        {/if}
        <Button
          variant="ghost"
          size="icon"
          aria-label={$_('page.plan.toggleDetailsPanel')}
          title={$_('page.plan.toggleDetailsPanel')}
          aria-pressed={isPanelOpen}
          onclick={() => (isPanelOpen = !isPanelOpen)}
        >
          <PanelRight class="size-4" />
        </Button>
      </div>

      <!-- Chart -->
      <div
        bind:this={chartContainerRef}
        class="relative flex min-h-0 flex-1 items-stretch justify-center overflow-x-auto px-4"
      >
        {#if chartData.length > 0 && chartContainerHeight > 0 && chartContainerWidth > 0}
          <StackedBarChart
            data={chartData}
            {selectedYear}
            {hoveredYear}
            height={chartContainerHeight}
            width={chartContainerWidth}
            ariaLabel={$_('page.plan.chartAriaLabel')}
            {firstErrorYear}
            firstErrorTooltip={firstErrorYear !== undefined
              ? $_('page.plan.firstErrorTooltip', { values: { year: firstErrorYear } })
              : undefined}
            onYearClick={handleYearClick}
            onYearHover={handleYearHover}
            showSelectedIndicator={isPanelOpen}
          />
        {:else}
          <p class="text-muted-foreground">{$_('page.plan.chartPlaceholder')}</p>
        {/if}
      </div>

      <!-- Legend -->
      <div class="flex justify-center gap-6 px-4 py-3">
        {#each legendItems as item (item.id)}
          <div class="flex items-center gap-1.5">
            <div class="size-2.5 rounded-[2px]" style="background-color: {item.color}"></div>
            <span class="text-xs">{item.label}</span>
          </div>
        {/each}
      </div>

      <!-- Compare button -->
      <div class="flex justify-center px-4 py-3">
        <Button variant="secondary" onclick={notImplemented}>
          <Rows2 class="size-4" />
          {$_('page.plan.comparePlan')}
        </Button>
      </div>
    </div>

    <!-- Right Panel: the selected year in detail -->
    <div class="contents" hidden={!isPanelOpen}>
      <PlanDetailsPanel
        {projection}
        bind:selectedYear
        {startYear}
        {endYear}
        age={currentAge}
        opener={(id) => itemOpeners.get(id)}
      />
    </div>

    {#if savedPlan}
      <!-- Add cash flow type picker -->
      <AddCashFlowDialog
        bind:open={addCashFlowDialogOpen}
        onOpenChange={(v) => (addCashFlowDialogOpen = v)}
        onContinue={handleAddCashFlowContinue}
      />

      <!-- Transfer edit dialog -->
      <TransferEditDialog
        bind:open={transferDialogOpen}
        onOpenChange={(v) => (transferDialogOpen = v)}
        initial={transferDialogInitial}
        plan={savedPlan}
      />

      <!-- Cash-flow edit dialog -->
      <CashFlowEditDialog
        bind:open={editDialogOpen}
        onOpenChange={(v) => (editDialogOpen = v)}
        kind={editDialogKind}
        initial={editDialogInitial}
        plan={savedPlan}
      />

      <!-- Add asset type picker -->
      <AddAssetDialog
        bind:open={addAssetDialogOpen}
        onOpenChange={(v) => (addAssetDialogOpen = v)}
        onContinue={openAssetCreateDialog}
      />

      <!-- Asset edit dialog -->
      <AssetEditDialog
        bind:open={assetDialogOpen}
        onOpenChange={(v) => (assetDialogOpen = v)}
        target={assetDialogTarget}
        plan={savedPlan}
      />

      <!-- Liability edit dialog -->
      <LiabilityEditDialog
        bind:open={liabilityDialogOpen}
        onOpenChange={(v) => (liabilityDialogOpen = v)}
        initial={liabilityDialogInitial}
        plan={savedPlan}
      />

      <!-- Cash edit dialog -->
      <CashEditDialog
        bind:open={cashDialogOpen}
        onOpenChange={(v) => (cashDialogOpen = v)}
        plan={savedPlan}
      />
    {/if}

    <!-- Hover tooltip - at page level to allow overlaying sidebars -->
    {#if hoveredData && tooltipPosition}
      <div
        class="pointer-events-none absolute z-50 w-[320px] rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-md"
        style="left: {tooltipPosition.left}px; top: {tooltipPosition.top}px; transform: {tooltipPosition.isRightSide
          ? 'translate(-100%, 0) translateY(8px)'
          : 'translateY(8px)'};"
      >
        <ChartTooltipContent
          year={hoveredData.year}
          age={hoveredAge}
          netWorth={hoveredData.cash +
            hoveredData.investments +
            hoveredData.tangibleAssets -
            hoveredData.liabilities}
          cash={hoveredData.cash}
          investments={hoveredData.investments}
          tangibleAssets={hoveredData.tangibleAssets}
          liabilities={hoveredData.liabilities}
          formatCurrency={appStore.formatCurrencyCode}
        />
      </div>
    {/if}
  </div>
{:else if appStore.loading}
  <Loader />
{:else}
  <div class="flex flex-1 flex-col items-center justify-center gap-8 p-8">
    <div class="flex flex-col items-center gap-4 text-center">
      <h1 class="text-2xl font-bold">{$_('page.plan.notFound')}</h1>
    </div>
    <Button variant="secondary" href={resolve(routes.HOME)}>
      <ArrowLeft class="size-4" />
      {$_('page.plan.backToHome')}
    </Button>
  </div>
{/if}

{#if readOnly}
  <AddProjectionDialog bind:open={modelChangesOpen} variant="modelChanges" />
{/if}

{#if isDemoPlan}
  <DemoPersonaDialog bind:open={personaDialogOpen} />
{/if}
