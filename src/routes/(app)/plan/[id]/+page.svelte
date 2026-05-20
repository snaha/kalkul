<script lang="ts">
  import { tick } from 'svelte'
  import { _ } from 'svelte-i18n'

  import {
    ArrowLeft,
    ChevronRight,
    PanelLeft,
    Plus,
    Rows2,
    Search,
    Settings2,
    X,
  } from '@lucide/svelte'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import ChartTooltipContent from '$lib/components/chart-tooltip-content.svelte'
  import StackedBarChart, {
    type BarData,
    type HoverPosition,
  } from '$lib/components/stacked-bar-chart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from '$lib/components/ui/collapsible'
  import { Input } from '$lib/components/ui/input'
  import { Separator } from '$lib/components/ui/separator'
  import { Slider } from '$lib/components/ui/slider'
  import { getYearlyPlanProjection } from '$lib/plan-projection'
  import routes from '$lib/routes'
  import type {
    Expense,
    Frequency,
    Income,
    ProfileInvestment,
    ProfileLiability,
    ProfileTangibleAsset,
    Transfer,
  } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn, notImplemented } from '$lib/utils'

  import AddAssetDialog, { type AssetKind as AddAssetKind } from './AddAssetDialog.svelte'
  import AddCashFlowDialog from './AddCashFlowDialog.svelte'
  import AssetEditDialog, { type AssetKind } from './AssetEditDialog.svelte'
  import CashEditDialog from './CashEditDialog.svelte'
  import CashFlowEditDialog from './CashFlowEditDialog.svelte'
  import PlanSidebarRow from './PlanSidebarRow.svelte'
  import TransferEditDialog from './TransferEditDialog.svelte'

  const planId = $derived(page.params.id)
  const plan = $derived(appStore.portfolios.find((p) => p.id === planId))

  // Year range from portfolio dates
  const startYear = $derived(
    plan ? new Date(plan.start_date).getFullYear() : new Date().getFullYear(),
  )
  const endYear = $derived(plan ? new Date(plan.end_date).getFullYear() : new Date().getFullYear())

  // State for UI
  let activeTab = $state<'cashflows' | 'assets'>('cashflows')
  let searchQuery = $state('')
  let selectedYear = $state(new Date().getFullYear())
  let isPanelOpen = $state(true)
  let isLeftPanelOpen = $state(true)
  // Left sidebar collapsible open state, keyed by category id. Persists across
  // Cash flows / Assets tab switches because the component tree is recreated
  // when `categories` changes but this state lives on the page.
  let openSections = $state<Record<string, boolean>>({})

  // Cash-flow edit dialog state
  let editDialogOpen = $state(false)
  let editDialogKind = $state<'income' | 'expense'>('income')
  let editDialogInitial = $state<Income | Expense | undefined>(undefined)
  let addCashFlowDialogOpen = $state(false)

  // Asset edit dialog state
  let assetDialogOpen = $state(false)
  let assetDialogKind = $state<AssetKind>('investment')
  let assetDialogInitial = $state<
    ProfileInvestment | ProfileTangibleAsset | ProfileLiability | undefined
  >(undefined)
  let cashDialogOpen = $state(false)
  let addAssetDialogOpen = $state(false)

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

  function openAssetEditDialog(
    kind: AssetKind,
    item: ProfileInvestment | ProfileTangibleAsset | ProfileLiability,
  ) {
    assetDialogKind = kind
    assetDialogInitial = item
    assetDialogOpen = true
  }

  function openAssetCreateDialog(kind: AssetKind) {
    assetDialogKind = kind
    assetDialogInitial = undefined
    assetDialogOpen = true
  }

  function handleAddAssetContinue(kind: AddAssetKind) {
    if (kind === 'cash') {
      cashDialogOpen = true
    } else {
      openAssetCreateDialog(kind)
    }
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

  // Category counts from profile data
  const transfersCount = $derived((plan?.transfers ?? []).length)

  function transferValueSuffix(t: Transfer): string {
    if (t.schedule === 'one_time') return `(${$_('page.plan.scheduleOneTime').toLowerCase()})`
    return `/ ${frequencySuffix(t.frequency ?? 'monthly')}`
  }
  const incomesCount = $derived((appStore.profile.incomes ?? []).length)
  const expensesCount = $derived((appStore.profile.expenses ?? []).length)
  const cashCount = $derived(appStore.profile.cash_amount ? 1 : 0)
  const investmentsCount = $derived((appStore.profile.investments ?? []).length)
  const tangibleAssetsCount = $derived((appStore.profile.tangible_assets ?? []).length)
  const liabilitiesCount = $derived((appStore.profile.liabilities ?? []).length)

  // Yearly projection (real / inflation-adjusted values)
  const projection = $derived(plan ? getYearlyPlanProjection(plan, appStore.profile) : [])
  const selectedYearProjection = $derived(projection.find((p) => p.year === selectedYear))

  // Breakdown values for the selected year (real terms)
  const cashValue = $derived(selectedYearProjection?.cash ?? 0)
  const investmentsValue = $derived(selectedYearProjection?.investments ?? 0)
  const tangibleAssetsValue = $derived(selectedYearProjection?.tangibleAssets ?? 0)
  const liabilitiesValue = $derived(selectedYearProjection?.liabilities ?? 0)
  const netWorth = $derived(selectedYearProjection?.netWorth ?? 0)

  // Per-frequency short suffix for cash-flow rows (matches read-only-cash-flow-row.svelte)
  function frequencySuffix(frequency: Frequency): string {
    if (frequency === 'monthly') return $_('page.financialData.frequency.short.monthly')
    if (frequency === 'weekly') return $_('page.financialData.frequency.short.weekly')
    return $_('page.financialData.frequency.short.yearly')
  }

  interface SidebarItem {
    id: string
    name: string
    value: string
    valueClass?: string
    onClick: () => void
  }

  interface SidebarCategory {
    id: string
    label: string
    count: number
    items: SidebarItem[]
  }

  function matchesSearch(name: string, query: string): boolean {
    if (query.trim() === '') return true
    return name.toLowerCase().includes(query.trim().toLowerCase())
  }

  // Cash-flow categories with their items
  const cashFlowCategories = $derived<SidebarCategory[]>([
    {
      id: 'transfers',
      label: $_('page.plan.transfers'),
      count: transfersCount,
      items: (plan?.transfers ?? [])
        .filter((t) => matchesSearch(t.name, searchQuery))
        .map((t) => ({
          id: t.id,
          name: t.name,
          value: `${t.transfer_all ? $_('page.plan.transferMax') : appStore.formatCurrencyCode(t.amount)} ${transferValueSuffix(t)}`,
          onClick: () => openTransferDialog(t),
        })),
    },
    {
      id: 'incomes',
      label: $_('page.plan.incomes'),
      count: incomesCount,
      items: (appStore.profile.incomes ?? [])
        .filter((i) => matchesSearch(i.name, searchQuery))
        .map((i) => ({
          id: i.id,
          name: i.name,
          value: `+${appStore.formatCurrencyCode(i.amount)} / ${frequencySuffix(i.frequency)}`,
          valueClass: 'text-success',
          onClick: () => openEditDialog('income', i),
        })),
    },
    {
      id: 'expenses',
      label: $_('page.plan.expenses'),
      count: expensesCount,
      items: (appStore.profile.expenses ?? [])
        .filter((e) => matchesSearch(e.name, searchQuery))
        .map((e) => ({
          id: e.id,
          name: e.name,
          value: `-${appStore.formatCurrencyCode(e.amount)} / ${frequencySuffix(e.frequency)}`,
          valueClass: 'text-destructive',
          onClick: () => openEditDialog('expense', e),
        })),
    },
  ])

  // Asset categories with their items
  const assetCategories = $derived<SidebarCategory[]>([
    {
      id: 'cash',
      label: $_('page.plan.cash'),
      count: cashCount,
      items:
        appStore.profile.cash_amount && matchesSearch($_('page.plan.cashItem'), searchQuery)
          ? [
              {
                id: 'cash',
                name: $_('page.plan.cashItem'),
                value: appStore.formatCurrencyCode(appStore.profile.cash_amount),
                onClick: () => (cashDialogOpen = true),
              },
            ]
          : [],
    },
    {
      id: 'investments',
      label: $_('page.plan.investments'),
      count: investmentsCount,
      items: (appStore.profile.investments ?? [])
        .filter((inv) => matchesSearch(inv.name, searchQuery))
        .map((inv) => ({
          id: inv.id,
          name: inv.name,
          value: appStore.formatCurrencyCode(inv.balance),
          onClick: () => openAssetEditDialog('investment', inv),
        })),
    },
    {
      id: 'tangibleAssets',
      label: $_('page.plan.tangibleAssets'),
      count: tangibleAssetsCount,
      items: (appStore.profile.tangible_assets ?? [])
        .filter((a) => matchesSearch(a.name, searchQuery))
        .map((a) => ({
          id: a.id,
          name: a.name,
          value: appStore.formatCurrencyCode(a.value),
          onClick: () => openAssetEditDialog('tangibleAsset', a),
        })),
    },
    {
      id: 'liabilities',
      label: $_('page.plan.liabilities'),
      count: liabilitiesCount,
      items: (appStore.profile.liabilities ?? [])
        .filter((l) => matchesSearch(l.name, searchQuery))
        .map((l) => ({
          id: l.id,
          name: l.name,
          value: `-${appStore.formatCurrencyCode(l.outstanding_balance)}`,
          valueClass: 'text-destructive',
          onClick: () => openAssetEditDialog('liability', l),
        })),
    },
  ])

  const categories = $derived(activeTab === 'cashflows' ? cashFlowCategories : assetCategories)

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

  // Breakdown items for the right panel
  const breakdownItems = $derived([
    {
      id: 'cash',
      label: $_('page.plan.cash'),
      color: CATEGORY_COLORS.cash,
      value: cashValue,
      formattedValue: appStore.formatCurrencyCode(cashValue),
      isNegative: false,
    },
    {
      id: 'investments',
      label: $_('page.plan.investments'),
      color: CATEGORY_COLORS.investments[0],
      value: investmentsValue,
      formattedValue: appStore.formatCurrencyCode(investmentsValue),
      isNegative: false,
    },
    {
      id: 'tangibleAssets',
      label: $_('page.plan.tangibleAssets'),
      color: CATEGORY_COLORS.tangibleAssets[0],
      value: tangibleAssetsValue,
      formattedValue: appStore.formatCurrencyCode(tangibleAssetsValue),
      isNegative: false,
    },
    {
      id: 'liabilities',
      label: $_('page.plan.liabilities'),
      color: CATEGORY_COLORS.liabilities[0],
      value: liabilitiesValue,
      formattedValue:
        liabilitiesValue > 0
          ? '-' + appStore.formatCurrencyCode(liabilitiesValue)
          : appStore.formatCurrencyCode(0),
      isNegative: liabilitiesValue > 0,
    },
  ])

  // Previous-year projection for year-on-year delta
  const previousYearProjection = $derived(projection.find((p) => p.year === selectedYear - 1))

  // Liquid net worth: cash + investments − liabilities (excludes tangibles, which are less liquid)
  const liquidNetWorth = $derived(cashValue + investmentsValue - liabilitiesValue)

  const yearOnYearDelta = $derived(
    previousYearProjection ? netWorth - previousYearProjection.netWorth : undefined,
  )
  const yearOnYearPercent = $derived.by(() => {
    if (previousYearProjection === undefined) return undefined
    const prev = previousYearProjection.netWorth
    if (prev === 0) return undefined
    return ((netWorth - prev) / Math.abs(prev)) * 100
  })

  function signed(value: number, formatted: string): string {
    if (value > 0) return `+${formatted}`
    if (value < 0) return formatted.startsWith('-') ? formatted : `-${formatted}`
    return formatted
  }

  const yearOnYearLabel = $derived.by(() => {
    if (yearOnYearDelta === undefined) return '—'
    const amount = signed(yearOnYearDelta, appStore.formatCurrencyCode(Math.abs(yearOnYearDelta)))
    if (yearOnYearPercent === undefined) return amount
    const pctSign = yearOnYearPercent > 0 ? '+' : ''
    return `${amount} (${pctSign}${yearOnYearPercent.toFixed(1)}%)`
  })
  const yearOnYearClass = $derived.by(() => {
    if (yearOnYearDelta === undefined || yearOnYearDelta === 0) return undefined
    return yearOnYearDelta > 0 ? 'text-success' : 'text-destructive'
  })

  const totalIncomeValue = $derived(selectedYearProjection?.totalIncome ?? 0)
  const totalExpensesValue = $derived(selectedYearProjection?.totalExpenses ?? 0)
  const investmentsByItem = $derived(selectedYearProjection?.investmentsByItem ?? [])
  const tangibleAssetsByItem = $derived(selectedYearProjection?.tangibleAssetsByItem ?? [])
  const liabilitiesByItem = $derived(selectedYearProjection?.liabilitiesByItem ?? [])

  // Calculate age from birth date for the selected year
  const currentAge = $derived.by(() => {
    if (!appStore.profile.birth_date) return undefined
    const birthYear = new Date(appStore.profile.birth_date).getFullYear()
    return selectedYear - birthYear
  })

  // Calculate age for hovered year
  const hoveredAge = $derived.by(() => {
    if (!appStore.profile.birth_date || hoveredYear === undefined) return undefined
    const birthYear = new Date(appStore.profile.birth_date).getFullYear()
    return hoveredYear - birthYear
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
  <div bind:this={pageContainerRef} class="relative flex flex-1 overflow-hidden">
    <!-- Left Panel: Cash flows / Assets -->
    {#if isLeftPanelOpen}
      <div class="flex w-[256px] shrink-0 flex-col gap-2 bg-sidebar p-2">
        <!-- Pill Tabs -->
        <div class="p-2">
          <div class="flex h-8 rounded-lg bg-muted p-[3px]">
            <button
              class={cn(
                'flex-1 rounded-md text-sm font-medium transition-all',
                activeTab === 'cashflows'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onclick={() => (activeTab = 'cashflows')}
            >
              {$_('page.plan.cashFlows')}
            </button>
            <button
              class={cn(
                'flex-1 rounded-md text-sm font-medium transition-all',
                activeTab === 'assets'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onclick={() => (activeTab = 'assets')}
            >
              {$_('page.plan.assets')}
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="p-2">
          <div class="relative">
            <Search
              class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={activeTab === 'cashflows'
                ? $_('page.plan.searchCashFlows')
                : $_('page.plan.searchAssets')}
              class="h-8 pl-8"
              bind:value={searchQuery}
            />
          </div>
        </div>

        <!-- Category rows -->
        <div class="flex flex-1 flex-col overflow-y-auto">
          {#each categories.filter((c) => c.items.length > 0) as category (category.id)}
            <Collapsible
              open={openSections[category.id] ?? false}
              onOpenChange={(v) => (openSections[category.id] = v)}
            >
              <CollapsibleTrigger
                class="flex h-8 w-full items-center justify-between rounded-md px-2 hover:bg-accent"
              >
                <div class="flex items-center gap-1">
                  <span class="text-sm font-medium">{category.label}</span>
                  <Badge variant="outline">{category.count}</Badge>
                </div>
                <ChevronRight
                  class="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="flex flex-col">
                  {#each category.items as item (item.id)}
                    <PlanSidebarRow
                      name={item.name}
                      value={item.value}
                      valueClass={item.valueClass}
                      onclick={item.onClick}
                    />
                  {/each}
                </div>
              </CollapsibleContent>
            </Collapsible>
          {/each}
        </div>

        <!-- Add button footer -->
        <div class="shrink-0 p-4">
          {#if activeTab === 'cashflows'}
            <Button class="w-full" onclick={() => (addCashFlowDialogOpen = true)}>
              <Plus class="size-4" />
              {$_('page.plan.addCashFlow')}
            </Button>
          {:else}
            <Button class="w-full" onclick={() => (addAssetDialogOpen = true)}>
              <Plus class="size-4" />
              {$_('page.plan.addAsset')}
            </Button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Center Panel: Chart area (placeholder) -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden border-l">
      <!-- Header with icons -->
      <div class="flex items-center justify-between px-4 py-4">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" onclick={() => (isLeftPanelOpen = !isLeftPanelOpen)}>
            <PanelLeft class="size-4" />
          </Button>
          <Separator orientation="vertical" class="!h-8" />
          <Button
            variant="ghost"
            size="icon"
            href={resolve(routes.HOME)}
            aria-label={$_('page.plan.backToHome')}
          >
            <ArrowLeft class="size-4" />
          </Button>
          <h2 class="text-xl font-bold">{plan?.name ?? ''}</h2>
        </div>
        <Button variant="ghost" size="icon" onclick={notImplemented}>
          <Settings2 class="size-4" />
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

    <!-- Right Panel: Details inspector -->
    {#if isPanelOpen}
      <div class="flex w-[320px] shrink-0 flex-col overflow-hidden border-l">
        <!-- Header section -->
        <div class="flex shrink-0 flex-col gap-4 p-4">
          <!-- Year + close button row -->
          <div class="flex items-center justify-between">
            <p class="text-lg font-bold">{selectedYear}</p>
            <Button variant="ghost" size="icon" onclick={() => (isPanelOpen = false)}>
              <X class="size-4" />
            </Button>
          </div>

          <!-- Age slider field -->
          <div class="flex flex-col">
            {#if currentAge !== undefined}
              <p class="text-sm font-medium">
                {$_('page.plan.age', { values: { age: currentAge } })}
              </p>
            {/if}
            <Slider
              type="single"
              class="mt-3"
              bind:value={selectedYear}
              min={startYear}
              max={endYear}
              step={1}
            />
          </div>
        </div>

        <!-- Content section -->
        <div class="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-2 pb-4">
          <!-- Net worth -->
          <div class="px-2 py-2">
            <p class="text-sm font-medium">{$_('page.plan.netWorth')}</p>
            <p class="mt-1 text-lg">{appStore.formatCurrencyCode(netWorth)}</p>
          </div>

          <!-- Category breakdown (4 rows, 28px each, with 16x16 squares) -->
          <div class="flex flex-col px-2 py-2">
            {#each breakdownItems as item (item.id)}
              <div class="flex h-7 items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="size-4 rounded-[2px]" style="background-color: {item.color}"></div>
                  <span class="text-sm">{item.label}</span>
                </div>
                <span class="text-sm tabular-nums" class:text-destructive={item.isNegative}>
                  {item.formattedValue}
                </span>
              </div>
            {/each}
          </div>

          <Separator class="mx-2" />

          <!-- Expandable detail sections -->
          <div class="flex flex-col gap-4">
            <!-- Key figures -->
            <Collapsible>
              <CollapsibleTrigger
                class="flex h-8 w-full items-center justify-between px-2 hover:bg-accent"
              >
                <span class="text-sm font-medium">{$_('page.plan.keyFigures')}</span>
                <ChevronRight
                  class="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="flex flex-col">
                  <PlanSidebarRow
                    dense
                    name={$_('page.plan.yearOnYear')}
                    value={yearOnYearLabel}
                    valueClass={yearOnYearClass}
                  />
                  <PlanSidebarRow
                    dense
                    name={$_('page.plan.liquidNetWorth')}
                    value={appStore.formatCurrencyCode(liquidNetWorth)}
                  />
                  <PlanSidebarRow
                    dense
                    name={$_('page.plan.totalIncome')}
                    value={`+${appStore.formatCurrencyCode(totalIncomeValue)}`}
                    valueClass="text-success"
                  />
                  <PlanSidebarRow
                    dense
                    name={$_('page.plan.totalExpenses')}
                    value={`-${appStore.formatCurrencyCode(totalExpensesValue)}`}
                    valueClass="text-destructive"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <!-- Investments value -->
            <Collapsible>
              <CollapsibleTrigger
                class="flex h-8 w-full items-center justify-between px-2 hover:bg-accent"
              >
                <span class="text-sm font-medium">{$_('page.plan.investmentsValue')}</span>
                <ChevronRight
                  class="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {#if investmentsByItem.length > 0}
                  <div class="flex flex-col">
                    {#each investmentsByItem as item (item.id)}
                      <PlanSidebarRow
                        dense
                        name={item.name}
                        value={appStore.formatCurrencyCode(item.value)}
                        onclick={notImplemented}
                      />
                    {/each}
                  </div>
                {:else}
                  <p class="px-2 py-1 text-xs text-muted-foreground">
                    {$_('page.plan.noItems')}
                  </p>
                {/if}
              </CollapsibleContent>
            </Collapsible>

            <!-- Tangible assets value -->
            <Collapsible>
              <CollapsibleTrigger
                class="flex h-8 w-full items-center justify-between px-2 hover:bg-accent"
              >
                <span class="text-sm font-medium">{$_('page.plan.tangibleAssetsValue')}</span>
                <ChevronRight
                  class="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {#if tangibleAssetsByItem.length > 0}
                  <div class="flex flex-col">
                    {#each tangibleAssetsByItem as item (item.id)}
                      <PlanSidebarRow
                        dense
                        name={item.name}
                        value={appStore.formatCurrencyCode(item.value)}
                        onclick={notImplemented}
                      />
                    {/each}
                  </div>
                {:else}
                  <p class="px-2 py-1 text-xs text-muted-foreground">
                    {$_('page.plan.noItems')}
                  </p>
                {/if}
              </CollapsibleContent>
            </Collapsible>

            <!-- Liabilities balance -->
            <Collapsible>
              <CollapsibleTrigger
                class="flex h-8 w-full items-center justify-between px-2 hover:bg-accent"
              >
                <span class="text-sm font-medium">{$_('page.plan.liabilitiesBalance')}</span>
                <ChevronRight
                  class="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {#if liabilitiesByItem.length > 0}
                  <div class="flex flex-col">
                    {#each liabilitiesByItem as item (item.id)}
                      <PlanSidebarRow
                        dense
                        name={item.name}
                        value={`-${appStore.formatCurrencyCode(item.value)}`}
                        valueClass="text-destructive"
                        onclick={notImplemented}
                      />
                    {/each}
                  </div>
                {:else}
                  <p class="px-2 py-1 text-xs text-muted-foreground">
                    {$_('page.plan.noItems')}
                  </p>
                {/if}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
    {/if}

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
      {plan}
    />

    <!-- Cash-flow edit dialog -->
    <CashFlowEditDialog
      bind:open={editDialogOpen}
      onOpenChange={(v) => (editDialogOpen = v)}
      kind={editDialogKind}
      initial={editDialogInitial}
      {plan}
    />

    <!-- Add asset type picker -->
    <AddAssetDialog
      bind:open={addAssetDialogOpen}
      onOpenChange={(v) => (addAssetDialogOpen = v)}
      onContinue={handleAddAssetContinue}
    />

    <!-- Asset edit dialog -->
    <AssetEditDialog
      bind:open={assetDialogOpen}
      onOpenChange={(v) => (assetDialogOpen = v)}
      kind={assetDialogKind}
      initial={assetDialogInitial}
      {plan}
    />

    <!-- Cash edit dialog -->
    <CashEditDialog bind:open={cashDialogOpen} onOpenChange={(v) => (cashDialogOpen = v)} {plan} />

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
