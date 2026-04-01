<script lang="ts">
  import type {
    InvestmentStore,
    TransactionStore,
    InvestmentWithColorIndex,
    PortfolioNested,
  } from '$lib/types'
  import {
    CenterSquare,
    ChevronRight,
    Copy,
    OverflowMenuVertical,
    Settings,
    TrashCan,
    ViewOff,
    WarningAltFilled,
  } from 'carbon-icons-svelte'
  import Button from './ui/button.svelte'
  import Typography from './ui/typography.svelte'
  import { _ } from 'svelte-i18n'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import Dropdown from './ui/dropdown.svelte'
  import List from './ui/list/list.svelte'
  import ListItem from './ui/list/list-item.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import FlexItem from './ui/flex-item.svelte'
  import Vertical from './ui/vertical.svelte'
  import TransactionCard from './transaction-card.svelte'
  import Divider from './ui/divider.svelte'
  import { base } from '$app/paths'
  import DeleteModal from './delete-modal.svelte'
  import InvestmentColorBox from './investment-color-box.svelte'
  import Badge from './ui/badge.svelte'
  import Loader from './ui/loader.svelte'

  type Props = {
    investment: InvestmentWithColorIndex & InvestmentStore
    portfolio: PortfolioNested
    viewOnly?: boolean
    index: number
    showInflation?: boolean
    openTransaction?: (investment: InvestmentWithColorIndex, transaction?: TransactionStore) => void
    open?: boolean
    exhaustionWarning?: import('$lib/@snaha/kalkul-maths').ExhaustionWarning
    isCalculating?: boolean
  }

  let {
    investment,
    portfolio,
    viewOnly = false,
    index,
    showInflation = false,
    openTransaction,
    open = $bindable(false),
    exhaustionWarning,
    isCalculating = false,
  }: Props = $props()

  const hidden = $derived(investment.hidden)
  const focused = $derived(investment.focused)

  let showDeleteInvestmentModal = $state(false)
  const transactions = $derived(investment.transactions)

  function cardOpenInvestment(e: MouseEvent) {
    if (e.defaultPrevented) {
      return
    }
    toggleInvestment()
  }

  function toggleInvestment() {
    open = !open
  }

  function editInvestment() {
    goto(routes.EDIT_INVESTMENT(portfolio.id, investment.id))
  }

  function deleteInvestment() {
    investment.delete()
  }

  $effect(() => {
    investment.colorIndex = index
  })
</script>

<div
  class="card"
  role="button"
  tabindex="0"
  aria-expanded={open}
  onclick={cardOpenInvestment}
  onkeydown={(e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault()
      toggleInvestment()
    }
  }}
  class:hidden
  class:open
>
  <Horizontal --horizontal-gap="var(--quarter-padding)">
    <div class="chevron">
      <ChevronRight
        size={20}
        class="open-investment-icon"
        color={hidden ? 'transparent' : undefined}
      />
    </div>
    <InvestmentColorBox colorIndex={investment.colorIndex ?? 0}>
      {#if isCalculating}
        <Vertical
          --vertical-justify-content="center"
          --vertical-align-items="center"
          style="min-height: 24px;"><Loader dimension="small" color="high" /></Vertical
        >
      {/if}
    </InvestmentColorBox>
    <Typography variant="h5" class="investment-name">{investment.name}</Typography>
    <FlexItem />
    {#if open}
      <Badge>{investment.apy}% APY</Badge>
    {/if}
    {#if exhaustionWarning && !open}
      <Badge variant="error">
        <WarningAltFilled size={16} />
      </Badge>
    {/if}
    {#if focused}
      <Button
        variant="ghost"
        dimension="compact"
        onclick={(e: Event) => {
          e.preventDefault()
          investment.toggleFocus()
        }}><CenterSquare size={16} /></Button
      >
    {/if}
    {#if hidden}
      <Button
        class="show-investment-button"
        variant="ghost"
        dimension="compact"
        onclick={(e: Event) => {
          e.preventDefault()
          investment.toggleHide()
        }}><ViewOff size={16} /></Button
      >
    {:else}
      <div class="dropdown">
        <Dropdown left buttonDimension="compact">
          {#snippet button()}
            <OverflowMenuVertical size={20} />
          {/snippet}
          <List>
            <ListItem onclick={() => investment.toggleFocus()}
              ><CenterSquare size={24} />{focused
                ? $_('component.investmentCard.removeFocus')
                : $_('component.investmentCard.focusInChart')}</ListItem
            >
            <ListItem onclick={() => investment.toggleHide()}
              ><ViewOff size={24} />{$_('component.investmentCard.hideInChart')}</ListItem
            >
            {#if !viewOnly}
              <ListItem onclick={editInvestment}
                ><Settings size={24} />{$_(
                  'component.investmentCard.editInvestmentDetails',
                )}</ListItem
              >
              <ListItem onclick={() => investment.duplicate()}
                ><Copy size={24} />{$_('component.investmentCard.duplicateInvestment')}</ListItem
              >
              <ListItem
                onclick={() => {
                  showDeleteInvestmentModal = true
                }}><TrashCan size={24} />{$_('component.investmentCard.deleteInvestment')}</ListItem
              >
            {/if}
          </List>
        </Dropdown>
      </div>
    {/if}
  </Horizontal>
  <div class="transaction-container" class:modalShow={!open || hidden}>
    {#if transactions.length === 0}
      <Vertical --vertical-gap="var(--padding)">
        <Vertical --vertical-gap="var(--half-padding)" --vertical-align-items="center">
          <img src={`${base}/images/no-draft.svg`} alt={$_('common.noTransactionYet')} />
          <Typography variant="h5">{$_('component.investmentCard.noTransactions')}</Typography>
          {#if !viewOnly}
            <Typography variant="small"
              >{$_('component.investmentCard.noTransactionsText')}</Typography
            >
          {/if}
        </Vertical>
        <Horizontal --horizontal-justify-content="center" style="padding: var(--half-padding)"
          ><Button
            variant="strong"
            dimension="compact"
            onclick={(e: Event) => {
              e.preventDefault()
              openTransaction?.(investment)
            }}>{$_('common.addTransaction')}</Button
          ></Horizontal
        >
      </Vertical>
    {:else}
      <Vertical --vertical-gap="0">
        {#each transactions as transaction}
          <Divider --margin="0" />
          <TransactionCard
            {viewOnly}
            {showInflation}
            editTransaction={openTransaction
              ? () => openTransaction(investment, transaction)
              : undefined}
            {transaction}
            {portfolio}
            currency={portfolio.currency}
            exhaustionWarning={exhaustionWarning?.transactionIds.includes(transaction.id ?? -1)
              ? exhaustionWarning
              : undefined}
          />
        {/each}
      </Vertical>
      {#if openTransaction && !viewOnly}
        <Horizontal --horizontal-justify-content="stretch"
          ><Button
            variant="ghost"
            dimension="compact"
            flexGrow
            onclick={(e: Event) => {
              e.preventDefault()
              openTransaction(investment)
            }}>{$_('common.addTransaction')}</Button
          ></Horizontal
        >
      {/if}
    {/if}
  </div>
</div>

<DeleteModal
  confirm={() => {
    deleteInvestment()
    showDeleteInvestmentModal = false
  }}
  oncancel={() => {
    showDeleteInvestmentModal = false
  }}
  bind:open={showDeleteInvestmentModal}
  title={$_('component.editInvestment.deleteInvestmentWarningTitle')}
  text={$_('component.editInvestment.deleteInvestmentWarning')}
/>

<style type="postcss">
  .card {
    border: 1px solid var(--colors-low);
    border-radius: var(--border-radius);
    background-color: var(--colors-base);
    padding: var(--half-padding);
    display: flex;
    flex-direction: column;
    gap: var(--half-padding);
    cursor: pointer;
    transition: border 0.2s;
    transition-timing-function: ease-in;
    :global(.open-investment-icon) {
      transform: rotate(0deg);
      transition: transform 0.2s ease-out;
    }
    :global(.investment-name) {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .dropdown {
    opacity: 1;
    transition: opacity 0.2s ease-out;
    visibility: visible;
  }
  .card:hover {
    border: 1px solid var(--colors-ultra-high);
    transition: border 0.2s;
    transition-timing-function: ease-out;
  }
  .chevron {
    padding: var(--half-padding);
    border: 1px solid transparent;
    display: flex;
  }
  .hidden {
    background-color: var(--colors-low);
    pointer-events: none;
    :global(.open-investment-icon) {
      opacity: 0.25;
    }
    :global(.show-investment-button) {
      pointer-events: all;
    }
    :global(.investment-name) {
      text-decoration: line-through;
    }
    :global(.investment-badge) {
      display: none;
    }
    &:hover {
      border: 1px solid var(--colors-low);
      transition: none;
    }
  }
  .card.open {
    :global(.open-investment-icon) {
      transform: rotate(90deg);
      transition: transform 0.2s ease-out;
    }
  }
  .transaction-container {
    display: flex;
    flex-direction: column;
    gap: var(--half-padding);
    &.modalShow {
      display: none;
    }
  }
</style>
