<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { sameYearMonthsInverted, timingComplete } from '$lib/schemas'
  import type {
    CashFlowEnd,
    CashFlowStart,
    ChangeOverTime,
    Expense,
    Frequency,
    Income,
  } from '$lib/schemas'
  import { getFrequencyItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'
  import {
    PROFILE_LISTS,
    duplicateProfileItem,
    isIncludedInPlan,
    removeProfileItem,
    toggleIncludedInPlan,
    upsertProfileItem,
  } from './profile-lists'

  type CashFlow = Income | Expense

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    kind: 'income' | 'expense'
    initial: CashFlow | undefined
    plan: PortfolioStore
    /** Called with the copy's id after a duplicate, so the caller can open it. */
    onDuplicated?: (id: string) => void
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, kind, initial, plan, onDuplicated }: Props = $props()

  interface FormState {
    id: string
    name: string
    amount: number | undefined
    frequency: Frequency
    withhold_taxes: boolean
    tax_percentage: number | undefined
    inflation_adjusted: boolean
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    end: CashFlowEnd
    end_year: number | undefined
    end_month: number | undefined
    end_age: number | undefined
    change_over_time: ChangeOverTime
    change_percentage: number | undefined
  }

  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))
  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let frequencyItems = $derived(getFrequencyItems($_))

  function blankForm(): FormState {
    const counter =
      kind === 'income'
        ? (appStore.profile.incomes ?? []).length + 1
        : (appStore.profile.expenses ?? []).length + 1
    return {
      id: crypto.randomUUID(),
      name:
        kind === 'income'
          ? $_('page.setup.income.defaultName', { values: { index: counter } })
          : $_('page.setup.expenses.defaultName', { values: { index: counter } }),
      amount: undefined,
      frequency: 'monthly',
      withhold_taxes: false,
      tax_percentage: undefined,
      // Default ON — most income/expense streams track inflation in real
      // terms, so this matches user intent for the common case.
      inflation_adjusted: true,
      start: 'immediately',
      // Timing fields start empty so 'at_specific_date'/'when_age_is' force an
      // explicit choice instead of silently defaulting to "now" (= plan year 1).
      start_year: undefined,
      start_month: undefined,
      start_age: undefined,
      end: 'never',
      end_year: undefined,
      end_month: undefined,
      end_age: undefined,
      change_over_time: 'none',
      change_percentage: undefined,
    }
  }

  function seedForm(src: CashFlow | undefined): FormState {
    if (!src) return blankForm()
    const isIncome = (s: CashFlow): s is Income => 'withhold_taxes' in s
    // Legacy migration: the old 'match_inflation' dropdown value maps onto
    // the new toggle so old data keeps behaving the same and saves into the
    // new shape on the next edit.
    const legacyInflation = src.change_over_time === 'match_inflation'
    const inflationAdjusted = src.inflation_adjusted === true || legacyInflation
    const changeOverTime: ChangeOverTime = legacyInflation ? 'none' : src.change_over_time
    return {
      id: src.id,
      name: src.name,
      amount: src.amount > 0 ? src.amount : undefined,
      frequency: src.frequency,
      withhold_taxes: isIncome(src) ? src.withhold_taxes : false,
      tax_percentage: isIncome(src) ? src.tax_percentage : undefined,
      inflation_adjusted: inflationAdjusted,
      start: src.start,
      start_year: src.start_year,
      start_month: src.start_month,
      start_age: src.start_age,
      end: src.end,
      end_year: src.end_year,
      end_month: src.end_month,
      end_age: src.end_age,
      change_over_time: changeOverTime,
      change_percentage: src.change_percentage,
    }
  }

  let form = $state<FormState>(blankForm())

  // Re-seed form whenever the dialog opens, so reopening discards prior edits.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const listConfig = $derived(PROFILE_LISTS[kind])

  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  function projectIncome(f: FormState): Income {
    return {
      id: f.id,
      name: f.name,
      amount: f.amount ?? 0,
      frequency: f.frequency,
      withhold_taxes: f.withhold_taxes,
      tax_percentage: f.withhold_taxes ? f.tax_percentage : undefined,
      inflation_adjusted: f.inflation_adjusted ? true : undefined,
      start: f.start,
      start_year: f.start === 'at_specific_date' ? f.start_year : undefined,
      start_month: f.start === 'at_specific_date' ? f.start_month : undefined,
      start_age: f.start === 'when_age_is' ? f.start_age : undefined,
      end: f.end,
      end_year: f.end === 'at_specific_date' ? f.end_year : undefined,
      end_month: f.end === 'at_specific_date' ? f.end_month : undefined,
      end_age: f.end === 'when_age_is' ? f.end_age : undefined,
      change_over_time: f.change_over_time,
      change_percentage:
        f.change_over_time === 'increase_yearly' || f.change_over_time === 'decrease_yearly'
          ? (f.change_percentage ?? 0)
          : undefined,
    }
  }

  function projectExpense(f: FormState): Expense {
    return {
      id: f.id,
      name: f.name,
      amount: f.amount ?? 0,
      frequency: f.frequency,
      inflation_adjusted: f.inflation_adjusted ? true : undefined,
      start: f.start,
      start_year: f.start === 'at_specific_date' ? f.start_year : undefined,
      start_month: f.start === 'at_specific_date' ? f.start_month : undefined,
      start_age: f.start === 'when_age_is' ? f.start_age : undefined,
      end: f.end,
      end_year: f.end === 'at_specific_date' ? f.end_year : undefined,
      end_month: f.end === 'at_specific_date' ? f.end_month : undefined,
      end_age: f.end === 'when_age_is' ? f.end_age : undefined,
      change_over_time: f.change_over_time,
      change_percentage:
        f.change_over_time === 'increase_yearly' || f.change_over_time === 'decrease_yearly'
          ? (f.change_percentage ?? 0)
          : undefined,
    }
  }

  // Same-year ranges can't end before they start: months before the start
  // month are disabled in the end dropdown, and an end month that a later
  // start/year change turned invalid is cleared so the user picks again
  // (Save stays disabled until they do).
  const endMinMonth = $derived(
    form.start === 'at_specific_date' &&
      form.end === 'at_specific_date' &&
      form.start_year !== undefined &&
      form.start_year === form.end_year
      ? form.start_month
      : undefined,
  )
  $effect(() => {
    if (
      sameYearMonthsInverted(
        form.start,
        form.start_year,
        form.start_month,
        form.end,
        form.end_year,
        form.end_month,
      )
    ) {
      form.end_month = undefined
    }
  })

  const canSave = $derived(
    timingComplete(form.start, form.start_year, form.start_month, form.start_age) &&
      timingComplete(form.end, form.end_year, form.end_month, form.end_age) &&
      !sameYearMonthsInverted(
        form.start,
        form.start_year,
        form.start_month,
        form.end,
        form.end_year,
        form.end_month,
      ),
  )

  function close() {
    onOpenChange(false)
  }

  function save() {
    if (kind === 'income') {
      upsertProfileItem(PROFILE_LISTS.income, projectIncome(form), plan)
    } else {
      upsertProfileItem(PROFILE_LISTS.expense, projectExpense(form), plan)
    }
    close()
  }

  function duplicate() {
    // Duplicating copies the SAVED item; edits sitting in the form would be
    // silently lost, so ask before discarding them (issue #65).
    const hasChanges = JSON.stringify(form) !== JSON.stringify(seedForm(initial))
    if (hasChanges && !window.confirm($_('page.plan.duplicateUnsavedConfirm'))) return
    const copyId = duplicateProfileItem(
      listConfig,
      form.id,
      (name) => $_('page.setup.common.copySuffix', { values: { name } }),
      plan,
    )
    close()
    if (copyId !== undefined) onDuplicated?.(copyId)
  }

  function toggleExclude() {
    toggleIncludedInPlan(listConfig, form.id, plan)
    close()
  }

  function remove() {
    const confirmMessage =
      kind === 'income' ? $_('page.plan.deleteIncomeConfirm') : $_('page.plan.deleteExpenseConfirm')
    if (!window.confirm(confirmMessage)) return
    removeProfileItem(listConfig, form.id)
    close()
  }
</script>

<ItemEditDialogShell
  bind:open
  {onOpenChange}
  name={form.name}
  onNameChange={(v) => (form.name = v)}
  {isNew}
  {isIncluded}
  saveDisabled={!canSave}
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  <!-- Amount + Frequency -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-amount">{$_('page.setup.common.amount')}</Label>
      <SuffixedInput
        id="{uid}-amount"
        value={form.amount}
        suffix={currencyLabel}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (form.amount = v)}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-frequency">{$_('page.setup.common.frequency')}</Label>
      <SelectField
        id="{uid}-frequency"
        value={form.frequency}
        items={frequencyItems}
        onValueChange={(v) => {
          if (v) form.frequency = v
        }}
      />
    </div>
  </div>

  <InflationAdjustToggle
    checked={form.inflation_adjusted}
    onCheckedChange={(v) => (form.inflation_adjusted = v)}
  />

  {#if kind === 'income'}
    <!-- Withhold taxes -->
    <div class="flex items-end gap-4">
      <div class="flex flex-1 flex-col justify-center">
        <label class="flex h-8 cursor-pointer items-center gap-2">
          <Checkbox
            checked={form.withhold_taxes}
            onCheckedChange={(v) => (form.withhold_taxes = v === true)}
          />
          <span class="text-sm font-medium leading-none">
            {$_('page.setup.income.withholdTaxes')}
          </span>
        </label>
      </div>
      {#if form.withhold_taxes}
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-percentageToWithhold"
            >{$_('page.setup.income.percentageToWithhold')}</Label
          >
          <SuffixedInput
            id="{uid}-percentageToWithhold"
            value={form.tax_percentage}
            suffix="%"
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.tax_percentage = v)}
          />
        </div>
      {:else}
        <div class="flex-1"></div>
      {/if}
    </div>
  {/if}

  <Separator />

  <DateAgeSelector
    mode="start"
    value={form.start}
    year={form.start_year}
    month={form.start_month}
    age={form.start_age}
    {years}
    {months}
    birthDateSet={appStore.profile.birthDate !== undefined}
    formatNumber={appStore.formatNumber}
    onValueChange={(v) => (form.start = v)}
    onYearChange={(v) => (form.start_year = v)}
    onMonthChange={(v) => (form.start_month = v)}
    onAgeChange={(v) => (form.start_age = v)}
  />

  <DateAgeSelector
    mode="end"
    value={form.end}
    year={form.end_year}
    month={form.end_month}
    age={form.end_age}
    {years}
    {months}
    minMonth={endMinMonth}
    birthDateSet={appStore.profile.birthDate !== undefined}
    formatNumber={appStore.formatNumber}
    onValueChange={(v) => (form.end = v)}
    onYearChange={(v) => (form.end_year = v)}
    onMonthChange={(v) => (form.end_month = v)}
    onAgeChange={(v) => (form.end_age = v)}
  />

  <ChangeOverTimeSelector
    value={form.change_over_time}
    percentage={form.change_percentage}
    formatNumber={appStore.formatNumber}
    onValueChange={(v) => (form.change_over_time = v)}
    onPercentageChange={(v) => (form.change_percentage = v)}
  />
</ItemEditDialogShell>
