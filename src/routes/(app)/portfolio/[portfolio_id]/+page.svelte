<script lang="ts">
  import Button from '$lib/components/ui/button.svelte'
  import { SidePanelCloseFilled, SidePanelOpenFilled } from 'carbon-icons-svelte'
  import { _ } from 'svelte-i18n'
  import Loader from '$lib/components/ui/loader.svelte'
  import routes from '$lib/routes'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { appStore } from '$lib/stores/app.svelte'
  import PortfolioHeader from '$lib/components/portfolio-header.svelte'
  import PortfolioGraph from '$lib/components/graph-portfolio.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import { base } from '$app/paths'
  import type { PortfolioNested } from '$lib/types'
  import { layoutStore } from '$lib/stores/layout.svelte'
  import MobileOnly from '$lib/components/mobile-only.svelte'
  import DesktopOnly from '$lib/components/desktop-only.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import ContentLayout from '$lib/components/content-layout.svelte'
  import PortfolioSidebar from '$lib/components/portfolio-sidebar.svelte'
  import { withPortfolioSimulationStore } from '$lib/stores/portfolio-simulation.svelte'

  const portfolioId = $derived(page.params.portfolio_id)
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  let selectedTab = $state<'goals' | 'investments'>('goals')

  const goalsSimulation = withPortfolioSimulationStore()
  const investmentsSimulation = withPortfolioSimulationStore()

  $effect(() => {
    void appStore.lastUpdated
    const p = portfolio
    if (p && !appStore.loading) {
      const goalsPortfolio: PortfolioNested = { ...p, investments: p.goals, goals: [] }
      setTimeout(() => {
        goalsSimulation.calculateIteratively(goalsPortfolio)
      }, 0)
    }
  })

  $effect(() => {
    void appStore.lastUpdated
    const p = portfolio
    if (p && !appStore.loading) {
      const investmentsPortfolio: PortfolioNested = { ...p, investments: p.investments, goals: [] }
      setTimeout(() => {
        investmentsSimulation.calculateIteratively(investmentsPortfolio)
      }, 0)
    }
  })

  const goals = $derived(portfolio?.goals ?? [])
  const regularInvestments = $derived(portfolio?.investments ?? [])
  const investments = $derived(selectedTab === 'goals' ? goals : regularInvestments)

  const graphData = $derived(
    selectedTab === 'goals' ? goalsSimulation.simulationData : investmentsSimulation.simulationData,
  )

  const transactionCount = $derived(
    investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
  )

  const hasAnyInvestments = $derived(goals.length > 0 || regularInvestments.length > 0)
  const isLoading = $derived(appStore.loading)

  let adjustWithInflation = $state(false)
  let isGraphFullscreened = $state(false)
  let isSidebarOpen = $state(true)
  const isSidebarFlexible = $derived(layoutStore.mobile)

  let isHeaderHovered = $state(false)
  let isMenuOpen = $state(false)
  let isShareMenuOpen = $state(false)
  const isPortfolioMenuOpen = $derived(isMenuOpen || isShareMenuOpen)
  let parentContainer: HTMLElement | undefined = $state()

  $effect(() => {
    if (!isGraphFullscreened) isSidebarOpen = true
  })

  $effect(() => {
    switch (page.url.hash) {
      case '#investments': {
        selectedTab = 'investments'
        return
      }
      case '#goals': {
        selectedTab = 'goals'
        return
      }
    }
  })

  function addInvestment() {
    goto(routes.NEW_INVESTMENT(portfolioId))
  }
</script>

{#snippet emptyPage()}
  <section class="empty">
    <img src={`${base}/images/no-investment.svg`} alt={$_('common.noInvestmentsYet')} />
    <div class="spacer"></div>
    <Typography variant="h4">{$_('page.portfolio.noInvestmentYet')}</Typography>
    <Typography>{$_('page.portfolio.createYourFirstInvestment')}</Typography>
    <div class="spacer"></div>
    <Button variant="strong" dimension="compact" onclick={addInvestment}
      >{$_('page.portfolio.addInvestment')}</Button
    >
  </section>
{/snippet}

{#snippet sidebarButton()}
  <Button
    variant="ghost"
    dimension="compact"
    onclick={() => {
      isSidebarOpen = !isSidebarOpen
    }}
    >{#if isSidebarOpen}<SidePanelCloseFilled size={20} />{:else}<SidePanelOpenFilled
        size={20}
      />{/if}</Button
  >
{/snippet}

{#if isLoading}
  <ContentLayout centerVertical>
    <Loader />
  </ContentLayout>
{:else if !portfolio}
  <ContentLayout centerVertical>
    404 - {$_('common.notFound')}
  </ContentLayout>
{:else if !hasAnyInvestments}
  {@render emptyPage()}
{:else}
  <DesktopOnly>
    <main
      class:fullscreen-graph={isGraphFullscreened}
      class:sidebar-open={isSidebarOpen && isGraphFullscreened}
      class="fixed-height"
      onmouseenter={() => (isHeaderHovered = false)}
      onmouseleave={() => (isHeaderHovered = true)}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="header-container"
        class:visible={isHeaderHovered || isPortfolioMenuOpen}
        onmouseenter={() => (isHeaderHovered = true)}
        onmouseleave={() => (isHeaderHovered = false)}
      >
        <PortfolioHeader
          {portfolio}
          {investments}
          back={() => goto(routes.HOME)}
          bind:adjustWithInflation
          bind:isMenuOpen
          bind:isShareMenuOpen
        />
      </div>

      <section class="horizontal grower fixed-height">
        {#if isSidebarOpen}
          <PortfolioSidebar
            {portfolio}
            {goals}
            {regularInvestments}
            {isGraphFullscreened}
            {isSidebarFlexible}
            bind:isSidebarOpen
            {graphData}
            {adjustWithInflation}
            bind:selectedTab
            {transactionCount}
            {portfolioId}
          />
        {/if}
        <PortfolioGraph
          bind:isSidebarOpen
          {isGraphFullscreened}
          fullscreen={() => {
            isGraphFullscreened = !isGraphFullscreened
            if (isGraphFullscreened) {
              isSidebarOpen = false
            }
          }}
          {portfolio}
          {investments}
          simulationData={graphData}
          bind:adjustWithInflation
          isEmpty={transactionCount === 0}
          birthDate={new Date(appStore.profile.birth_date)}
          {sidebarButton}
          disableInteraction={graphData.isCalculating}
        />
      </section>
    </main>
  </DesktopOnly>
  <MobileOnly>
    <main class="mobile fixed-height">
      <Vertical
        --vertical-justify-content="space-between"
        --vertical-gap="0"
        class="grower fixed-height"
        bind:element={parentContainer}
      >
        <Vertical>
          <ContentLayout centered={false}>
            <PortfolioHeader
              {portfolio}
              {investments}
              back={() => goto(routes.HOME)}
              bind:adjustWithInflation
              bind:isMenuOpen
              bind:isShareMenuOpen
            />
          </ContentLayout>

          <PortfolioGraph
            isSidebarOpen={false}
            isGraphFullscreened={true}
            fullscreen={() => {
              isGraphFullscreened = !isGraphFullscreened
            }}
            fullscreenGraph="value"
            {portfolio}
            {investments}
            simulationData={graphData}
            bind:adjustWithInflation
            isEmpty={false}
            birthDate={appStore.profile.birth_date
              ? new Date(appStore.profile.birth_date)
              : undefined}
            disableInteraction={true}
          />
          <PortfolioSidebar
            {portfolio}
            {goals}
            {regularInvestments}
            {isGraphFullscreened}
            {isSidebarFlexible}
            bind:isSidebarOpen
            {graphData}
            {adjustWithInflation}
            bind:selectedTab
            {transactionCount}
            {portfolioId}
            {parentContainer}
          />
        </Vertical>
      </Vertical>
    </main>
  </MobileOnly>
{/if}

<style>
  :root {
    --max-width: 1370px;
  }
  main {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    gap: var(--double-padding);
    transition: padding 0.3s ease-in;
    overflow: hidden;
  }
  main.mobile {
    min-height: calc(100dvh - var(--header-height));
  }
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: stretch;
    gap: 0;
    transition: gap 0.3s ease-in;
  }
  :global(.grower) {
    flex: 1;
  }
  .fullscreen-graph {
    min-height: calc(100vh - 50px);
    padding: 0;
    .horizontal {
      gap: 0;
    }
  }
  .sidebar-open {
    padding: 0;
    .horizontal {
      gap: var(--half-padding);
    }
  }
  .empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--half-padding);
    height: 80vh;
  }
  .spacer {
    margin-top: var(--half-padding);
  }
  :global(.mobile-investment-header) {
    box-shadow: 0px 1px 4px 0px #00000040;
    z-index: 1;
  }
  :global(.fixed-height) {
    height: calc(100dvh - var(--header-height));
    overflow-y: hidden;
  }
  .header-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background-color: var(--colors-ultra-low);
    padding: var(--double-padding);
    box-shadow: 0px 1px 4px 0px #00000040;
    transform: translateY(-100%);
    opacity: 0;
    transition:
      transform 0.3s ease-in-out,
      opacity 0.3s ease-in-out;
    pointer-events: none;
  }
  .header-container.visible {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }
</style>
