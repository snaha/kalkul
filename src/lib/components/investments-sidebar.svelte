<script lang="ts">
  import type {
    InvestmentStore,
    TransactionStore,
    InvestmentWithColorIndex,
    PortfolioNested,
  } from '$lib/types'
  import Sidebar from './sidebar.svelte'
  import InvestmentCard from './investment-card.svelte'
  import type { PortfolioSimulation } from '$lib/stores/portfolio-simulation.svelte'
  import FlexItem from './ui/flex-item.svelte'
  import Vertical from './ui/vertical.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import Typography from './ui/typography.svelte'
  import Button from './ui/button.svelte'
  import { _ } from 'svelte-i18n'
  import { base } from '$app/paths'
  import routes from '$lib/routes'
  import { goto } from '$app/navigation'

  type Props = {
    isGraphFullscreened: boolean
    isSidebarOpen: boolean
    isSidebarFlexible: boolean
    portfolio: PortfolioNested
    investments: InvestmentStore[]
    transactionCount: number
    adjustWithInflation: boolean
    viewOnly: boolean
    graphData?: PortfolioSimulation
    openTransaction?: (investment: InvestmentWithColorIndex, transaction?: TransactionStore) => void
  }

  let {
    isGraphFullscreened,
    isSidebarOpen = $bindable(),
    isSidebarFlexible,
    portfolio,
    investments,
    transactionCount,
    adjustWithInflation,
    viewOnly,
    graphData,
    openTransaction,
  }: Props = $props()
</script>

<Sidebar
  --sidebar-gap="var(--padding)"
  --sidebar-padding="0"
  {isGraphFullscreened}
  {isSidebarOpen}
  {isSidebarFlexible}
>
  <section class="investments">
    {#if investments.length === 0}
      <FlexItem />
      <Vertical
        --vertical-gap="var(--padding)"
        --vertical-align-items="center"
        --vertical-justify-content="center"
      >
        <Vertical --vertical-gap="var(--half-padding)">
          <img
            src={`${base}/images/no-investment.svg`}
            alt={$_('component.sidebar.noInvestmentsYetTitle')}
          />
          <Typography variant="h5">{$_('component.sidebar.noInvestmentsYetTitle')}</Typography>
          {#if !viewOnly}
            <Typography variant="small" center
              >{$_('component.sidebar.noInvestmentsYetDescription')}</Typography
            >
          {/if}
        </Vertical>
        {#if !viewOnly}
          <Horizontal --horizontal-justify-content="center"
            ><Button
              variant="strong"
              dimension="compact"
              onclick={() => goto(routes.NEW_INVESTMENT(portfolio.id))}
              >{$_('page.portfolio.addInvestment')}</Button
            ></Horizontal
          >
        {/if}
      </Vertical>
      <FlexItem />
    {/if}
    {#each investments as investment, i}
      <InvestmentCard
        {investment}
        {portfolio}
        {viewOnly}
        index={i}
        showInflation={adjustWithInflation}
        {openTransaction}
        open={transactionCount === 0}
        exhaustionWarning={graphData?.data[i]?.exhaustionWarning}
        isCalculating={graphData?.isCalculating &&
          (!graphData.currentCalculatingIndex || i >= graphData.currentCalculatingIndex)}
      />
    {/each}
    <FlexItem />
  </section>
</Sidebar>

<style>
  .investments {
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    gap: var(--half-padding);
    background-color: var(--colors-low);
    padding-left: var(--half-padding);
    padding-right: var(--half-padding);
    border-radius: var(--half-padding);
    flex: 1;
    min-height: var(--sidebar-min-height);
  }
</style>
