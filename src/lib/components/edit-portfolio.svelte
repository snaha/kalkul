<script lang="ts">
  import { Close, WarningAltFilled } from 'carbon-icons-svelte'
  import { _ } from 'svelte-i18n'
  import Button from '$lib/components/ui/button.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import type { PortfolioStore } from '$lib/types'
  import { appStore } from '$lib/stores/app.svelte'
  import Select from '$lib/components/ui/select/select.svelte'
  import Divider from '$lib/components/ui/divider.svelte'
  import { capitalizeFirstLetter, formatAge } from '$lib/utils'

  import DateAge from './date-age.svelte'
  import DeleteModal from './delete-modal.svelte'
  import Vertical from './ui/vertical.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import ResponsiveLayout from './ui/responsive-layout.svelte'
  import { layoutStore } from '$lib/stores/layout.svelte'
  import LoaderButton from './loader-button.svelte'

  type Props = {
    portfolio?: PortfolioStore
    close: () => void
  }

  let { portfolio, close }: Props = $props()

  let name = $state(
    capitalizeFirstLetter($_('common.portfolio')) +
      ' ' +
      (appStore.portfolios.length + 1).toString(),
  )
  let currency = $state('EUR')
  let inflation = $state('2.25')
  let nowDate = new Date()
  let startDate = $state(nowDate)
  let horizon = $state('0')
  let initialHorizonYears = 30
  let initialEndDate = new Date(nowDate)
  initialEndDate.setFullYear(nowDate.getFullYear() + initialHorizonYears)
  let endDate = $state(initialEndDate)
  let showConfirmModal = $state(false)
  let horizonError = $state(false)
  let createDisabled = $derived(name === '' || horizonError)
  let formType: 'edit' | 'create' = $derived(portfolio ? 'edit' : 'create')

  $effect(() => {
    if (!portfolio) {
      return
    }
    name = portfolio.name
    currency = portfolio.currency
    inflation = (portfolio.inflation_rate * 100).toString()
    startDate = new Date(portfolio.start_date)
    endDate = new Date(portfolio.end_date)
  })

  $effect(() => {
    if (startDate || endDate) {
      horizon = formatAge(new Date(startDate), new Date(endDate))
      if (startDate > endDate) {
        horizonError = true
      } else {
        horizonError = false
      }
    }
  })

  function createPortfolio() {
    appStore.addPortfolio({
      name,
      currency,
      start_date: startDate.toDateString(),
      end_date: endDate.toDateString(),
      inflation_rate: Number(inflation) / 100,
    })
    close()
  }

  function updatePortfolio() {
    if (!portfolio) {
      return
    }

    portfolio.update({
      name,
      currency,
      start_date: startDate.toDateString(),
      end_date: endDate.toDateString(),
      inflation_rate: Number(inflation) / 100,
    })
    close()
  }

  function cancel(event: Event) {
    // FIXME: not sure why this is needed here, but it won't work without it
    event.preventDefault()
    close()
  }

  function onHorizonInput() {
    if (!horizon) {
      endDate = startDate
      return
    }
    let horizonNumber = parseInt(horizon, 10)
    if (Number.isNaN(horizonNumber)) {
      return
    }
    if (horizonNumber < 0) {
      horizonNumber = Math.abs(horizonNumber)
    }

    const date = new Date(startDate)
    date.setFullYear(new Date(startDate).getFullYear() + horizonNumber)

    endDate = date
  }

  function checkHorizonInput() {
    if (!horizon) {
      horizon = formatAge(new Date(startDate), new Date(endDate))
      return
    }
    let horizonNumber = parseInt(horizon, 10)
    if (Number.isNaN(horizonNumber)) {
      horizon = formatAge(new Date(startDate), new Date(endDate))
      return
    }
    if (horizonNumber < 0) {
      horizon = Math.abs(horizonNumber).toString()
      return
    }
  }

  function confirmDeletePortfolio() {
    showConfirmModal = true
  }

  function deletePortfolio() {
    if (!portfolio) {
      return
    }
    showConfirmModal = false
    portfolio.delete()
    close()
  }
</script>

<Vertical class="max-width-560" --vertical-gap="var(--double-padding)">
  <Horizontal>
    {#if formType === 'create'}
      <Typography variant="h4">{$_('component.editPortfolio.addPortfolio')}</Typography>
    {:else}
      <Typography variant="h4">{$_('component.editPortfolio.editPortfolio')}</Typography>
    {/if}
    <div class="grower"></div>
    <Button variant="ghost" dimension="compact" onclick={close}><Close size={24} /></Button>
  </Horizontal>
  <Vertical --vertical-gap="var(--padding)">
    <Input
      autofocus={!layoutStore.mobile}
      dimension="compact"
      variant="solid"
      placeholder={$_('component.editPortfolio.portfolioName')}
      label={$_('component.editPortfolio.portfolioName')}
      bind:value={name}
    ></Input>
    <section class="horizontal">
      <Select
        variant="solid"
        dimension="compact"
        bind:value={currency}
        placeholder={$_('common.currency')}
        label={$_('common.currency')}
        class="grower"
        items={[
          { value: 'EUR', label: 'EUR' },
          { value: 'USD', label: 'USD' },
          { value: 'CZK', label: 'CZK' },
        ]}
      ></Select>
      <Input
        type="number"
        variant="solid"
        dimension="compact"
        placeholder={$_('common.inflation')}
        label={$_('common.inflation')}
        unit="%"
        bind:value={inflation}
        step={'.01'}
        class="grower"
      ></Input>
    </section>
  </Vertical>
  <Divider />

  <Vertical --vertical-gap="var(--padding)">
    <DateAge
      dimension="compact"
      dateInputLabel={$_('common.startDate')}
      bind:date={startDate}
      ageLabel={$_('common.age') + ' ' + $_('component.editPortfolio.atPortfolioStart')}
      agePlaceholder={$_('common.age')}
      birthDate={appStore.profile.birthDate}
    />

    <Input
      variant="solid"
      dimension="compact"
      placeholder={$_('component.editPortfolio.horizon')}
      label={$_('component.editPortfolio.horizon')}
      unit={$_('common.years')}
      bind:value={horizon}
      oninput={onHorizonInput}
      onblur={checkHorizonInput}
    ></Input>

    <DateAge
      dimension="compact"
      dateInputLabel={$_('common.endDate')}
      bind:date={endDate}
      ageLabel={$_('common.age') + ' ' + $_('component.editPortfolio.atPortfolioEnd')}
      agePlaceholder={$_('common.age')}
      birthDate={appStore.profile.birthDate}
    />
  </Vertical>

  {#if horizonError}
    <Horizontal --horizontal-gap="var(--half-padding)" class="error-bar">
      <WarningAltFilled size={24} />
      {$_('component.editPortfolio.invalidDateRangeError')}
    </Horizontal>
  {/if}

  <ResponsiveLayout --responsive-justify-content="stretch">
    {#if formType === 'create'}
      <LoaderButton
        variant="strong"
        dimension="compact"
        onclick={createPortfolio}
        disabled={createDisabled}>{$_('component.editPortfolio.createPortfolio')}</LoaderButton
      >
    {:else}
      <LoaderButton
        variant="strong"
        dimension="compact"
        onclick={updatePortfolio}
        disabled={createDisabled}>{$_('common.saveChanges')}</LoaderButton
      >
    {/if}
    <Button variant="ghost" dimension="compact" onclick={cancel}>{$_('common.cancel')}</Button>
    {#if formType === 'edit'}
      {#if !layoutStore.mobile}<div class="grower"></div>{/if}
      <Button variant="ghost" dimension="compact" onclick={confirmDeletePortfolio} danger
        >{$_('component.editPortfolio.deletePortfolio')}</Button
      >
    {/if}
  </ResponsiveLayout>
</Vertical>

<DeleteModal
  confirm={deletePortfolio}
  oncancel={() => (showConfirmModal = false)}
  bind:open={showConfirmModal}
  title={$_('component.editPortfolio.deletePortfolioWarningTitle')}
  text={$_('component.editPortfolio.deletePortfolioWarning')}
/>

<style>
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-end;
    gap: var(--half-padding);
  }
  .horizontal :global(.grower) {
    flex: 1;
    min-width: 0;
  }
  .grower {
    flex: 1;
  }
  :global(.max-width-560) {
    max-width: 560px;
    width: 100%;
  }
  .horizontal :global(.grower .col),
  .horizontal :global(.grower .wrapper),
  .horizontal :global(.grower .relative),
  .horizontal :global(.grower input) {
    min-width: 0;
  }
  :global(.error-bar) {
    background-color: var(--colors-red);
    color: var(--colors-ultra-low);
    padding: var(--half-padding) !important;
  }
</style>
