<script lang="ts">
  import Button from '$lib/components/ui/button.svelte'
  import SearchInput from '$lib/components/ui/input/search-input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import {
    OverflowMenuVertical,
    Folder,
    FolderDetails,
    TrashCan,
    ArrowRight,
    Copy,
    Edit,
  } from 'carbon-icons-svelte'
  import { _, locale } from 'svelte-i18n'
  import { formatCurrency } from '$lib/utils'
  import { formatDate } from '$lib/@snaha/kalkul-maths/date'
  import Loader from '$lib/components/ui/loader.svelte'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import Header from '$lib/components/header.svelte'
  import Dropdown from '$lib/components/ui/dropdown.svelte'
  import List from '$lib/components/ui/list/list.svelte'
  import ListItem from '$lib/components/ui/list/list-item.svelte'
  import DeleteModal from '$lib/components/delete-modal.svelte'
  import { base } from '$app/paths'
  import DesktopOnly from '$lib/components/desktop-only.svelte'
  import MobileOnly from '$lib/components/mobile-only.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import ContentLayout from '$lib/components/content-layout.svelte'
  import { getCurrentPortfolioValue } from '$lib/@snaha/kalkul-maths'
  import {
    differenceInDays,
    differenceInMonths,
    differenceInWeeks,
    differenceInYears,
  } from 'date-fns'
  import type { Portfolio } from '$lib/types'
  import EditProfile from '$lib/components/edit-profile.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'

  const needsOnboarding = $derived(!appStore.loading && appStore.profile.name === '')

  let showConfirmModal = $state(false)
  let portfolioToBeDeleted: string | undefined = $state()
  let searchQuery = $state('')
  let filteredPortfolios = $derived(searchByName(searchQuery))

  function addPortfolio() {
    goto(routes.NEW_PORTFOLIO)
  }

  function confirmDeletePortfolio(portfolioId: string) {
    showConfirmModal = true
    portfolioToBeDeleted = portfolioId
  }

  function deletePortfolio() {
    if (portfolioToBeDeleted) {
      appStore.portfolios.find((p) => p.id === portfolioToBeDeleted)?.delete()
      portfolioToBeDeleted = undefined
      showConfirmModal = false
    }
  }

  function searchByName(searchQuery: string) {
    if (searchQuery) {
      return appStore.portfolios.filter((portfolio) =>
        portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    } else {
      return appStore.portfolios
    }
  }

  function portfolioValue(portfolioId: string): number {
    const portfolio = appStore.portfolios.find((p) => p.id === portfolioId)
    if (!portfolio) return 0
    return getCurrentPortfolioValue(
      {
        filter: (id: string) => portfolio.investments.find((i) => i.id === id)?.transactions ?? [],
      },
      portfolio.investments,
    )
  }

  function portfolioPeriod(portfolio: Portfolio) {
    const yearDiff = differenceInYears(portfolio.end_date, portfolio.start_date)
    if (yearDiff > 0) {
      return `${yearDiff}${$_('common.abbreviations.year')}`
    }
    const monthDiff = differenceInMonths(portfolio.end_date, portfolio.start_date)
    if (monthDiff > 0) {
      return `${monthDiff}${$_('common.abbreviations.month')}`
    }
    const weekDiff = differenceInWeeks(portfolio.end_date, portfolio.start_date)
    if (weekDiff > 0) {
      return `${weekDiff}${$_('common.abbreviations.week')}`
    }
    const dayDiff = differenceInDays(portfolio.end_date, portfolio.start_date)
    return `${dayDiff}${$_('common.abbreviations.day')}`
  }
</script>

{#snippet portfolioDropdown(portfolioId: string)}
  <Dropdown left buttonDimension="compact">
    {#snippet button()}
      <OverflowMenuVertical size={24} />
    {/snippet}
    <List>
      <ListItem onclick={() => goto(routes.PORTFOLIO(portfolioId))}
        ><Folder size={24} />{$_('page.portfolio.openPortfolio')}</ListItem
      >
      <ListItem onclick={() => goto(routes.EDIT_PORTFOLIO(portfolioId))}
        ><FolderDetails size={24} />{$_('page.portfolio.editPortfolioDetails')}</ListItem
      >
      <ListItem onclick={() => appStore.portfolios.find((p) => p.id === portfolioId)?.duplicate()}
        ><Copy size={24} />{$_('page.portfolio.duplicatePortfolio')}</ListItem
      >
      <ListItem onclick={() => confirmDeletePortfolio(portfolioId)}
        ><TrashCan size={24} />{$_('page.portfolio.deletePortfolio')}</ListItem
      >
    </List>
  </Dropdown>
{/snippet}

{#if needsOnboarding}
  <Fullscreen>
    <EditProfile />
  </Fullscreen>
{:else}
  <Header />
  <ContentLayout centered={false}>
    {#if appStore.loading}
      <Typography>{$_('common.loading')}</Typography><Loader />
    {:else if appStore.portfolios.length === 0}
      <section class="empty">
        <img src={`${base}/images/no-portfolio.svg`} alt={$_('common.noPortfolioYet')} />
        <Typography variant="h4">{$_('page.home.noPortfoliosYet')}</Typography>
        <Typography>{$_('page.home.createYourFirstPortfolio')}</Typography>
        <div class="spacer"></div>
        <Button variant="strong" dimension="compact" onclick={addPortfolio}
          >{$_('page.portfolio.addPortfolio')}</Button
        >
      </section>
    {:else}
      <DesktopOnly>
        <section class="horizontal">
          <Typography variant="h4">{$_('page.home.allPortfolios')}</Typography>
          <div class="grower"></div>
          <SearchInput
            bind:value={searchQuery}
            dimension="compact"
            variant="solid"
            placeholder={$_('common.search')}
          ></SearchInput>
          <Button dimension="compact" variant="strong" onclick={addPortfolio}
            >{$_('page.portfolio.addPortfolio')}</Button
          >
          <Button dimension="compact" variant="ghost" onclick={() => goto(routes.EDIT_PROFILE)}
            ><Edit size={24} />{$_('page.home.editProfile')}</Button
          >
        </section>

        <ul>
          <li class="portfolios title">
            <span>{$_('common.portfolioName')}</span>
            <span>{$_('common.currency')}</span>
            <span>{$_('common.startDate')}</span>
            <span>{$_('common.period')}</span>
            <span class="right-aligned">{$_('common.inflation')}</span>
            <span class="right-aligned">{$_('common.currentValue')}</span>
            <span></span>
          </li>
          {#each filteredPortfolios as portfolio}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li
              class="portfolios portfolio"
              onclick={(e: MouseEvent) => {
                if (!e.defaultPrevented) {
                  goto(routes.PORTFOLIO(portfolio.id))
                }
              }}
            >
              <span>{portfolio.name}</span>
              <span>{portfolio.currency}</span>
              <span>{formatDate(new Date(portfolio.start_date))}</span>
              <span>{portfolioPeriod(portfolio)}</span>
              <span class="right-aligned">{portfolio.inflation_rate * 100}%</span>
              <span class="right-aligned"
                >{formatCurrency(portfolioValue(portfolio.id), portfolio.currency, $locale, {
                  maximumFractionDigits: 0,
                })}</span
              >
              <span class="right-aligned">{@render portfolioDropdown(portfolio.id)}</span>
            </li>
          {/each}
        </ul>
      </DesktopOnly>
      <MobileOnly>
        <Vertical>
          <Horizontal --horizontal-justify-content="space-between">
            <Typography variant="h4">{$_('page.home.allPortfolios')}</Typography>

            <Button dimension="compact" variant="strong" onclick={addPortfolio}
              >{$_('page.portfolio.addPortfolio')}</Button
            >
          </Horizontal>
          <Horizontal>
            <SearchInput
              bind:value={searchQuery}
              dimension="compact"
              variant="solid"
              placeholder={$_('common.search')}
              class="grower"
            ></SearchInput>
            {#if searchQuery.length > 0}
              <Button dimension="compact" variant="ghost" onclick={() => (searchQuery = '')}
                >{$_('page.home.clearSearch')}</Button
              >
            {/if}
          </Horizontal>
        </Vertical>

        <ul class="mobile">
          {#each filteredPortfolios as portfolio}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li
              class="portfolio mobile"
              onclick={(e: MouseEvent) => {
                if (!e.defaultPrevented) {
                  goto(routes.PORTFOLIO(portfolio.id))
                }
              }}
            >
              <span>{portfolio.name}</span>
              <span class="right-aligned"><ArrowRight /></span>
            </li>
          {/each}
        </ul>

        <Horizontal --horizontal-justify-content="space-between">
          <Button variant="ghost" dimension="compact" onclick={addPortfolio}
            >{$_('page.portfolio.addPortfolio')}</Button
          >
          <Button dimension="compact" variant="ghost" onclick={() => goto(routes.EDIT_PROFILE)}
            ><Edit size={24} />{$_('page.home.editProfile')}</Button
          >
        </Horizontal>
      </MobileOnly>
    {/if}
  </ContentLayout>
{/if}

<DeleteModal
  confirm={deletePortfolio}
  oncancel={() => (showConfirmModal = false)}
  bind:open={showConfirmModal}
  title={$_('page.home.deletePortfolio')}
  text={$_('page.home.deletePortfolioWarning')}
/>

<style>
  :root {
    --max-width: 1370px;
  }
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: var(--half-padding);
  }
  :global(.grower) {
    flex: 1;
  }
  ul {
    padding-left: 0;
    margin: 0;
  }
  ul.mobile {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--colors-low);
    margin: 0;
  }
  li > span {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--half-padding);
    overflow-wrap: anywhere;
  }
  .portfolios {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 42px;
    align-items: center;
    gap: var(--half-padding);
    border-bottom: 1px solid var(--colors-low);
    background-color: var(--colors-ultra-low);
    padding-top: var(--half-padding);
    padding-bottom: var(--half-padding);
    width: 100%;
  }
  .title {
    border-bottom: 1px solid var(--colors-ultra-high);
    color: var(--colors-ultra-high);
    font-size: var(--font-size-h5);
    font-family: var(--font-family-sans-serif);
    font-weight: 700;
  }
  .portfolio {
    border-bottom: 1px solid var(--colors-low);
    font-size: var(--font-size);
    font-family: var(--font-family-sans-serif);
    cursor: pointer;
  }
  .portfolio.mobile {
    display: flex;
    justify-content: space-between;
    padding: var(--padding) var(--half-padding);
    width: 100%;
    gap: var(--half-padding);
  }
  .portfolio:hover {
    background-color: color-mix(in srgb, var(--colors-low) 25%, transparent);
  }
  .right-aligned {
    display: flex;
    justify-content: flex-end;
    text-align: right;
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
  :global(.text-center) {
    text-align: center;
  }
  :global(.max560) {
    max-width: 560px;
    width: 100%;
  }
  :global(.bg-ultra-low) {
    background-color: var(--colors-ultra-low);
  }
</style>
