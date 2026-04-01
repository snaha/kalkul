<script lang="ts">
  import { Close } from 'carbon-icons-svelte'
  import { _, locale } from 'svelte-i18n'
  import Button from '$lib/components/ui/button.svelte'
  import LoaderButton from '$lib/components/loader-button.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import FormattedNumberInput from '$lib/components/ui/input/formatted-number/input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import type { Portfolio } from '$lib/types'
  import Select from '$lib/components/ui/select/select.svelte'
  import Divider from '$lib/components/ui/divider.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import ResponsiveLayout from '$lib/components/ui/responsive-layout.svelte'
  import DateAge from '$lib/components/date-age.svelte'
  import DatePicker from '$lib/components/ui/input/date/picker.svelte'
  import { addYears } from 'date-fns'
  import type { PeriodicWithdrawalCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'

  type Props = {
    birthDate?: Date
    portfolio: Portfolio
    close: () => void
    onCalculate: (input: PeriodicWithdrawalCalculationInput, currency: string) => void
    initialData?: {
      calculationInput: PeriodicWithdrawalCalculationInput
      currency: string
    }
  }

  let { birthDate, portfolio, close, onCalculate, initialData }: Props = $props()

  const RETIREMENT_DEFAULTS = {
    RETIREMENT_AGE: 65,
    RETIREMENT_LENGTH: 20,
    INFLATION: 2.5,
    DESIRED_BUDGET: 0,
    BUDGET_PERIOD: 'month' as const,
    CURRENT_SAVINGS: 0,
    APY: 5.5,
    DEPOSIT_PERIOD: 'month' as const,
  }

  // Calculate current age
  const today = new Date()
  const initialAge = birthDate ? today.getFullYear() - birthDate.getFullYear() : 0

  let currentAge = $state(initialAge)
  let withdrawalStart = $state(
    initialData?.calculationInput.withdrawalStart ??
      addYears(birthDate ?? today, RETIREMENT_DEFAULTS.RETIREMENT_AGE),
  )
  let withdrawalDuration = $state(
    initialData?.calculationInput.withdrawalDuration ?? RETIREMENT_DEFAULTS.RETIREMENT_LENGTH,
  )
  let currency = $state(initialData?.currency ?? portfolio.currency)
  let inflation = $state(initialData?.calculationInput.inflation ?? RETIREMENT_DEFAULTS.INFLATION)
  let desiredBudget = $state<number>(
    initialData?.calculationInput.desiredBudget ?? RETIREMENT_DEFAULTS.DESIRED_BUDGET,
  )
  let budgetPeriod = $state(
    initialData?.calculationInput.budgetPeriod ?? RETIREMENT_DEFAULTS.BUDGET_PERIOD,
  )
  let currentSavings = $state<number>(
    initialData?.calculationInput.currentSavings ?? RETIREMENT_DEFAULTS.CURRENT_SAVINGS,
  )
  let apy = $state(initialData?.calculationInput.apy ?? RETIREMENT_DEFAULTS.APY)
  let depositPeriod = $state(
    initialData?.calculationInput.depositPeriod ?? RETIREMENT_DEFAULTS.DEPOSIT_PERIOD,
  )
  let depositStart = $state(initialData?.calculationInput.depositStart ?? today)

  function cancel(event: Event) {
    event.preventDefault()
    close()
  }

  function calculateDeposit() {
    const input: PeriodicWithdrawalCalculationInput = {
      withdrawalStart,
      withdrawalDuration,
      desiredBudget,
      budgetPeriod: budgetPeriod as 'month' | 'year',
      currentSavings,
      apy,
      inflation,
      depositStart,
      depositPeriod: depositPeriod as 'month' | 'year',
    }

    onCalculate(input, currency)
  }
</script>

<Vertical class="max-width-560">
  <Horizontal>
    <Typography variant="h4">{$_('page.retirement.title')}</Typography>
    <div class="grower"></div>
    <Button variant="ghost" dimension="compact" onclick={close}><Close size={24} /></Button>
  </Horizontal>
  <div class="spacer"></div>

  <Input
    type="number"
    variant="solid"
    dimension="compact"
    placeholder={$_('page.retirement.ageToday')}
    label={$_('page.retirement.ageToday')}
    unit={$_('page.retirement.yearsOld')}
    bind:value={currentAge}
    disabled
  ></Input>

  <DateAge
    dimension="compact"
    dateInputLabel={$_('page.retirement.withdrawalStart')}
    bind:date={withdrawalStart}
    ageLabel={$_('page.retirement.retirementAge')}
    agePlaceholder={$_('page.retirement.retirementAge')}
    {birthDate}
  />

  <Input
    type="number"
    variant="solid"
    dimension="compact"
    placeholder={$_('page.retirement.withdrawalDuration')}
    label={$_('page.retirement.withdrawalDuration')}
    unit={$_('common.years')}
    bind:value={withdrawalDuration}
  ></Input>

  <Divider />

  <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
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
      placeholder={$_('page.retirement.inflation')}
      label={$_('page.retirement.inflation')}
      unit="%"
      bind:value={inflation}
      step={'.01'}
      class="grower"
    ></Input>
  </Horizontal>

  <Vertical --vertical-gap="var(--quarter-padding)">
    <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
      <FormattedNumberInput
        variant="solid"
        dimension="compact"
        placeholder={$_('page.retirement.desiredRetirementBudget')}
        label={$_('page.retirement.desiredRetirementBudget')}
        unit={currency}
        bind:value={desiredBudget}
        locale={$locale}
        class="grower"
      />
      <Select
        variant="solid"
        dimension="compact"
        bind:value={budgetPeriod}
        class="grower"
        items={[
          { value: 'month', label: $_('page.retirement.perMonth') },
          { value: 'year', label: $_('page.retirement.perYear') },
        ]}
      ></Select>
    </Horizontal>
    <Typography variant="small" --typography-color="var(--colors-medium)"
      >{$_('page.retirement.inTodaysMoney')}</Typography
    >
  </Vertical>

  <Divider />

  <Vertical --vertical-gap="var(--quarter-padding)">
    <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
      <FormattedNumberInput
        variant="solid"
        dimension="compact"
        placeholder={$_('page.retirement.currentSavings')}
        label={$_('page.retirement.currentSavings')}
        unit={currency}
        bind:value={currentSavings}
        locale={$locale}
        class="grower"
      />
      <Input
        type="number"
        variant="solid"
        dimension="compact"
        placeholder={$_('common.apy')}
        label={$_('common.apy')}
        unit="%"
        bind:value={apy}
        step={'.01'}
        class="grower"
      ></Input>
    </Horizontal>
    <Typography variant="small" --typography-color="var(--colors-medium)"
      >{$_('page.retirement.earmarkedForRetirement')}</Typography
    >
  </Vertical>

  <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
    <Select
      variant="solid"
      dimension="compact"
      bind:value={depositPeriod}
      label={$_('page.retirement.depositPeriod')}
      class="grower"
      items={[
        { value: 'month', label: $_('page.retirement.monthly') },
        { value: 'year', label: $_('page.retirement.yearly') },
      ]}
    ></Select>
    <DatePicker
      dimension="compact"
      label={$_('page.retirement.depositStart')}
      bind:value={depositStart}
      style="max-width: 100%"
    />
  </Horizontal>

  <ResponsiveLayout --responsive-justify-content="stretch">
    <LoaderButton variant="strong" dimension="compact" onclick={calculateDeposit}
      >{$_('page.retirement.calculateDepositAmount')}</LoaderButton
    >
    <Button variant="ghost" dimension="compact" onclick={cancel}>{$_('common.cancel')}</Button>
  </ResponsiveLayout>
</Vertical>

<style>
  :global(.horizontal .grower) {
    flex: 1;
    min-width: 0;
  }
  .spacer {
    margin-top: var(--half-padding);
  }
  .grower {
    flex: 1;
  }
  :global(.max-width-560) {
    max-width: 560px;
    width: 100%;
  }
  :global(.horizontal .grower .col),
  :global(.horizontal .grower .wrapper),
  :global(.horizontal .grower .relative),
  :global(.horizontal .grower input) {
    min-width: 0;
  }
</style>
