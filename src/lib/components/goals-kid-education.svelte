<script lang="ts">
  import { ArrowLeft } from 'carbon-icons-svelte'
  import { _, locale } from 'svelte-i18n'
  import Button from '$lib/components/ui/button.svelte'
  import LoaderButton from '$lib/components/loader-button.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import FormattedNumberInput from '$lib/components/ui/input/formatted-number/input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import type { Profile, Portfolio } from '$lib/types'
  import Select from '$lib/components/ui/select/select.svelte'
  import Divider from '$lib/components/ui/divider.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import ResponsiveLayout from '$lib/components/ui/responsive-layout.svelte'
  import DatePicker from '$lib/components/ui/input/date/picker.svelte'
  import { addYears } from 'date-fns'
  import type { PeriodicWithdrawalCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'

  type Props = {
    profile: Profile
    portfolio: Portfolio
    close: () => void
    onCalculate: (
      input: PeriodicWithdrawalCalculationInput,
      currency: string,
      name: string,
      childName: string,
    ) => void
    initialData?: {
      calculationInput: PeriodicWithdrawalCalculationInput
      currency: string
    }
  }

  let { portfolio, close, onCalculate, initialData }: Props = $props()

  const EDUCATION_DEFAULTS = {
    EDUCATION_LENGTH: 20,
    INFLATION: 2.5,
    DESIRED_BUDGET: 0,
    BUDGET_PERIOD: 'month' as const,
    CURRENT_SAVINGS: 0,
    APY: 5.5,
    DEPOSIT_PERIOD: 'month' as const,
  }

  // Calculate current age
  const today = new Date()
  let currentAge = $state(6)
  let educationStartDate = $state(calculateEducationStartDate(today))
  let educationLength = $state(EDUCATION_DEFAULTS.EDUCATION_LENGTH)
  let annualCost = $state<number>((initialData?.calculationInput.desiredBudget ?? 0) * 12)

  let kidName = $state('Kid')
  const defaultGoalName = $derived(goalNameFromKidName())
  let isGoalNameChanged = $state(false)
  let goalName = $state(goalNameFromKidName())

  let withdrawalStart = $derived(educationStartDate)
  let currency = $state(initialData?.currency ?? portfolio.currency)
  let inflation = $state(initialData?.calculationInput.inflation ?? EDUCATION_DEFAULTS.INFLATION)
  let currentSavings = $state<number>(
    initialData?.calculationInput.currentSavings ?? EDUCATION_DEFAULTS.CURRENT_SAVINGS,
  )
  let apy = $state(initialData?.calculationInput.apy ?? EDUCATION_DEFAULTS.APY)
  let depositPeriod = $state(
    initialData?.calculationInput.depositPeriod ?? EDUCATION_DEFAULTS.DEPOSIT_PERIOD,
  )
  let depositStart = $state(initialData?.calculationInput.depositStart ?? today)

  function cancel(event: Event) {
    event.preventDefault()
    close()
  }

  function calculateDeposit() {
    const input: PeriodicWithdrawalCalculationInput = {
      withdrawalStart,
      withdrawalDuration: currentAge,
      desiredBudget: annualCost / 12,
      budgetPeriod: 'month',
      currentSavings,
      apy,
      inflation,
      depositStart,
      depositPeriod: depositPeriod as 'month' | 'year',
    }

    onCalculate(input, currency, goalName, kidName)
  }

  function onGoalNameChange() {
    if (goalName === '') {
      isGoalNameChanged = false
    } else {
      isGoalNameChanged = true
    }
  }

  function goalNameFromKidName() {
    return `${kidName} - ${$_('page.education.defaultName')}`
  }

  function onKidNameChange() {
    if (!isGoalNameChanged) {
      goalName = defaultGoalName
    }
  }

  function calculateEducationStartDate(date: Date) {
    const yearsToAdd = date.getMonth() < 9 ? 18 : 19
    const startDate = addYears(date, yearsToAdd)
    startDate.setMonth(8)
    startDate.setDate(0)
    return startDate
  }
</script>

<Vertical class="max-width-560" --vertical-gap="var(--double-padding)">
  <Horizontal>
    <Button variant="ghost" dimension="compact" onclick={close}><ArrowLeft size={20} /></Button>
    <Typography variant="h4">{$_('page.education.form.title')}</Typography>
  </Horizontal>

  <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
    <Input
      type="text"
      variant="solid"
      dimension="compact"
      placeholder={$_('page.education.form.kidNamePlaceholder')}
      label={$_('page.education.form.kidName')}
      bind:value={kidName}
      class="grower"
      oninput={onKidNameChange}
    ></Input>

    <Input
      type="text"
      variant="solid"
      dimension="compact"
      placeholder={$_('page.education.form.goalNamePlaceholder')}
      label={$_('page.education.form.goalName')}
      bind:value={goalName}
      class="grower"
      oninput={onGoalNameChange}
    ></Input>
  </Horizontal>

  <Divider --margin="0" />

  <Vertical --vertical-gap="var(--padding)">
    <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
      <DatePicker
        dimension="compact"
        label={$_('page.education.form.educationStart')}
        bind:value={educationStartDate}
      />
      <Input
        type="number"
        variant="solid"
        dimension="compact"
        placeholder={$_('page.education.form.educationLength')}
        label={$_('page.education.form.educationLength')}
        unit={$_('common.years')}
        bind:value={educationLength}
        class="grower"
        style="max-width: 100%"
        step={1}
        min={0}
      ></Input>
    </Horizontal>
    <FormattedNumberInput
      variant="solid"
      dimension="compact"
      placeholder="0"
      label={$_('page.education.form.annualEducationCost')}
      helperText={$_('page.education.form.inTodaysMoney')}
      unit={currency}
      bind:value={annualCost}
      step={1}
      min={0}
      class="grower"
      locale={$locale}
    ></FormattedNumberInput>
  </Vertical>

  <Divider --margin="0" />

  <Vertical --vertical-gap="var(--padding)">
    <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-start">
      <FormattedNumberInput
        variant="solid"
        dimension="compact"
        placeholder="0"
        label={$_('page.education.form.currentSavings')}
        helperText={$_('page.education.form.currentSavingsHelper')}
        unit={currency}
        bind:value={currentSavings}
        step={1}
        min={0}
        class="grower"
        locale={$locale}
      ></FormattedNumberInput>
      <Input
        type="number"
        variant="solid"
        dimension="compact"
        placeholder="0"
        label="APY"
        unit="%"
        bind:value={apy}
        step={'.01'}
        class="grower"
      ></Input>
    </Horizontal>

    <Horizontal --horizontal-gap="var(--half-padding)" --horizontal-align-items="flex-end">
      <Select
        variant="solid"
        dimension="compact"
        bind:value={depositPeriod}
        label={$_('page.education.form.depositFrequency')}
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
  </Vertical>

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
