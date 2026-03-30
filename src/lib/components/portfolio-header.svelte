<script lang="ts">
  import DeleteModal from './delete-modal.svelte'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import {
    OverflowMenuVertical,
    Copy,
    TrashCan,
    ArrowLeft,
    DocumentExport,
    Edit,
    Add,
  } from 'carbon-icons-svelte'
  import { _ } from 'svelte-i18n'
  import Button from './ui/button.svelte'
  import Dropdown from './ui/dropdown.svelte'
  import List from './ui/list/list.svelte'
  import ListItem from './ui/list/list-item.svelte'
  import type { PortfolioStore, Investment } from '$lib/types'
  import PortfolioHeaderView from './portfolio-header-view.svelte'
  import { layoutStore } from '$lib/stores/layout.svelte'

  type Props = {
    portfolio: PortfolioStore
    investments: Investment[]
    back?: () => void
    adjustWithInflation: boolean
    isMenuOpen: boolean
    isShareMenuOpen: boolean
  }

  let {
    portfolio,
    investments,
    back,
    adjustWithInflation = $bindable(),
    isMenuOpen = $bindable(false),
    isShareMenuOpen = $bindable(false),
  }: Props = $props()

  let showConfirmModal = $state(false)

  function addInvestment() {
    goto(routes.NEW_INVESTMENT(portfolio.id))
  }

  function exportPdf() {
    goto(routes.PDF_EXPORT_PARAMS(portfolio.id))
  }

  function confirmDeletePortfolio() {
    showConfirmModal = true
  }

  async function deletePortfolio() {
    portfolio.delete()
    await goto(routes.HOME)
    showConfirmModal = false
  }
</script>

<section class="horizontal">
  <div class="controls">
    <Button
      dimension="compact"
      variant="ghost"
      onclick={() => {
        if (back) back()
        else history.back()
      }}
    >
      <ArrowLeft size={24} /></Button
    >
  </div>
  <PortfolioHeaderView {portfolio} {investments} bind:adjustWithInflation />
  <div class="grower"></div>
  <div class="controls">
    {#if !layoutStore.mobile}
      <Button dimension="compact" variant="strong" onclick={addInvestment}
        >{$_('component.portfolioHeader.addInvestment')}</Button
      >
      <Button dimension="compact" variant="ghost" onclick={exportPdf}
        ><DocumentExport size={24} />{$_('component.portfolioHeader.pdfExport')}</Button
      >
    {/if}
    <Dropdown left buttonDimension="compact" bind:open={isMenuOpen}>
      {#snippet button()}
        <OverflowMenuVertical size={24} />
      {/snippet}
      <List>
        {#if layoutStore.mobile}
          <ListItem onclick={addInvestment}
            ><Add size={24} />{$_('component.portfolioHeader.addInvestment')}</ListItem
          >
          <ListItem onclick={exportPdf}
            ><DocumentExport size={24} />{$_('component.portfolioHeader.pdfExport')}</ListItem
          >
        {/if}
        <ListItem onclick={() => goto(routes.EDIT_PORTFOLIO(portfolio.id))}
          ><Edit size={24} />{$_('component.portfolioHeader.editPortfolio')}</ListItem
        >
        <ListItem
          onclick={() => {
            const duplicatedPortfolioId = portfolio.duplicate()
            if (duplicatedPortfolioId) {
              goto(routes.PORTFOLIO(duplicatedPortfolioId))
            }
          }}><Copy size={24} />{$_('component.portfolioHeader.duplicatePortfolio')}</ListItem
        >
        <ListItem onclick={() => confirmDeletePortfolio()}
          ><TrashCan size={24} />{$_('component.portfolioHeader.deletePortfolio')}</ListItem
        >
      </List>
    </Dropdown>
  </div>
</section>

<DeleteModal
  confirm={deletePortfolio}
  oncancel={() => (showConfirmModal = false)}
  bind:open={showConfirmModal}
  title={$_('component.portfolioHeader.deletePortfolioWarningTitle')}
  text={$_('component.portfolioHeader.deletePortfolioWarning')}
/>

<style>
  :global(.grower) {
    flex: 1;
  }
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: var(--half-padding);
  }
  .controls {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: var(--half-padding);
  }
</style>
