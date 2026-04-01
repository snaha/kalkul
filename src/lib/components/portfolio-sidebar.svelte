<script lang="ts">
  import type {
    InvestmentStore,
    TransactionStore,
    InvestmentWithColorIndex,
    PortfolioNested,
  } from '$lib/types'
  import type { PortfolioSimulation } from '$lib/stores/portfolio-simulation.svelte'
  import { _ } from 'svelte-i18n'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import Button from '$lib/components/ui/button.svelte'
  import TabBar from '$lib/components/ui/tab-bar/tab-bar.svelte'
  import TabContent from '$lib/components/ui/tab-bar/tab-content.svelte'
  import GoalsSidebar from '$lib/components/goals-sidebar.svelte'
  import InvestmentsSidebar from '$lib/components/investments-sidebar.svelte'
  import EditTransaction from '$lib/components/edit-transaction.svelte'
  import { layoutStore } from '$lib/stores/layout.svelte'
  import { DownToBottom, UpToTop } from 'carbon-icons-svelte'

  interface Props {
    portfolio: PortfolioNested
    goals: InvestmentStore[]
    regularInvestments: InvestmentStore[]
    isGraphFullscreened: boolean
    isSidebarFlexible: boolean
    isSidebarOpen: boolean
    graphData: PortfolioSimulation | undefined
    adjustWithInflation: boolean
    selectedTab: 'goals' | 'investments'
    transactionCount: number
    portfolioId: string
    parentContainer?: HTMLElement
  }

  let {
    portfolio,
    goals,
    regularInvestments,
    isGraphFullscreened,
    isSidebarFlexible,
    isSidebarOpen = $bindable(),
    graphData,
    adjustWithInflation,
    selectedTab = $bindable(),
    transactionCount,
    portfolioId,
    parentContainer,
  }: Props = $props()

  // Transaction editing state - managed internally
  let editedTransaction: TransactionStore | undefined = $state()
  let selectedInvestment: (InvestmentWithColorIndex & InvestmentStore) | undefined = $state()
  let open = $state(false)
  let prevSelectedTab = $state(selectedTab)

  function openTransaction(investment: InvestmentWithColorIndex, transaction?: TransactionStore) {
    // The investment objects from the store are InvestmentStore at runtime
    selectedInvestment = investment as InvestmentWithColorIndex & InvestmentStore
    if (transaction) editedTransaction = transaction
  }

  function closeDialog() {
    editedTransaction = undefined
    selectedInvestment = undefined
  }

  function openSidebar() {
    if (parentContainer) {
      // Read CSS variables dynamically to avoid hardcoded constants
      const styles = getComputedStyle(document.documentElement)
      const headerHeight = parseInt(styles.getPropertyValue('--header-height'))
      const tabBarHeight = parseInt(styles.getPropertyValue('--portfolio-sidebar-tab-bar-height'))

      // Formula: viewport height - header height - tab bar height
      const savedScrollPosition = window.innerHeight - headerHeight - tabBarHeight

      parentContainer.scroll({ top: savedScrollPosition, behavior: 'smooth' })
      open = true
    }
  }

  function closeSidebar() {
    if (parentContainer) {
      parentContainer.scroll({ top: 0, behavior: 'smooth' })
      open = false
    }
  }
</script>

{#if portfolio}
  <Vertical --vertical-gap="0" class="sidebar-tabs-container fixed-height">
    {#if selectedInvestment}
      <div class="scrollable dialog">
        <EditTransaction
          investment={selectedInvestment}
          {portfolio}
          transaction={editedTransaction}
          showInflation={adjustWithInflation}
          close={closeDialog}
        />
      </div>
    {:else}
      <Horizontal
        --horizontal-align-items="center"
        --horizontal-gap="0"
        style="padding: var(--half-padding)"
      >
        <TabBar
          dimension="compact"
          bind:selectedTabId={selectedTab}
          ulClass="sidebar-tab-ul"
          liClass="sidebar-tab-li"
          buttonClass="sidebar-tab-button"
          onSelectTab={() => {
            if (prevSelectedTab === selectedTab) {
              if (!open) {
                openSidebar()
              } else {
                closeSidebar()
              }
            }
            prevSelectedTab = selectedTab
          }}
        >
          <TabContent value={$_('page.goals.title')} id="goals"></TabContent>
          <TabContent value={$_('common.investments')} id="investments"></TabContent>
        </TabBar>
        {#if layoutStore.mobile}
          <Button
            variant="ghost"
            dimension="compact"
            onclick={() => {
              if (!open) {
                openSidebar()
              } else {
                closeSidebar()
              }
            }}
          >
            {#if open}
              <DownToBottom size={20} />
            {:else}
              <UpToTop size={20} />
            {/if}
          </Button>
        {/if}
      </Horizontal>
      <div class="vertical scrollable">
        {#if selectedTab === 'goals'}
          <GoalsSidebar
            {isGraphFullscreened}
            {isSidebarFlexible}
            bind:isSidebarOpen
            {portfolio}
            {goals}
            {adjustWithInflation}
            viewOnly={false}
            {graphData}
            {openTransaction}
            addGoal={() => {
              goto(routes.NEW_GOAL(portfolioId))
            }}
            showExplainInvestmentsLabel={regularInvestments.length === 0}
            --sidebar-min-height="var(--portfolio-sidebar-min-height)"
          />
        {:else if selectedTab === 'investments'}
          <InvestmentsSidebar
            {isGraphFullscreened}
            {isSidebarFlexible}
            bind:isSidebarOpen
            {portfolio}
            investments={regularInvestments}
            {transactionCount}
            {adjustWithInflation}
            viewOnly={false}
            {graphData}
            {openTransaction}
            --sidebar-min-height="var(--portfolio-sidebar-min-height)"
          />
        {/if}
      </div>
      <Horizontal --horizontal-justify-content="stretch" style="padding: var(--half-padding)">
        {#if selectedTab === 'goals' && goals.length > 0}
          <Button
            flexGrow
            variant="ghost"
            dimension="compact"
            onclick={() => {
              goto(routes.NEW_GOAL(portfolioId))
            }}>{$_('page.portfolio.addGoal')}</Button
          >
        {:else if selectedTab === 'investments' && regularInvestments.length > 0}
          <Button
            flexGrow
            variant="ghost"
            dimension="compact"
            onclick={() => {
              goto(routes.NEW_INVESTMENT(portfolioId))
            }}>{$_('page.portfolio.addInvestment')}</Button
          >
        {/if}
      </Horizontal>
    {/if}
  </Vertical>
{/if}

<style>
  :root {
    --portfolio-sidebar-tab-bar-height: 68px;
    --portfolio-sidebar-button-height: 58px;
    --portfolio-sidebar-min-height: calc(
      100dvh - var(--header-height) - var(--portfolio-sidebar-tab-bar-height) -
        var(--portfolio-sidebar-button-height)
    );
  }
  .vertical {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
  .scrollable {
    overflow-y: auto;
    max-height: 100%;
    background-color: var(--colors-low);
  }
  :global(.dialog) {
    padding: var(--half-padding);
    border-radius: var(--border-radius);
    background-color: var(--colors-low);
    border: 1px solid var(--colors-low);
  }
  :global(.sidebar-tabs-container) {
    background-color: var(--colors-low);
  }
  :global(.sidebar-tab-ul) {
    justify-content: space-between;
    background-color: var(--colors-base);
    border: 1px solid var(--colors-low);
    gap: var(--quarter-padding);
    border-radius: var(--quarter-padding);
    padding: var(--quarter-padding) !important;
  }
  :global(.sidebar-tab-li) {
    display: flex;
    flex: 1;
  }
  :global(.sidebar-tab-button) {
    flex-grow: 1 !important;
  }
</style>
