<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import TrendingUp from '@lucide/svelte/icons/trending-up'

  import {
    type CashFlowFields,
    blankCashFlowFields,
    cashFlowFromFields,
    cashFlowToFields,
    endMinMonth,
  } from '$lib/cash-flow-form'
  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { itemsForPlan } from '$lib/plan-owned'
  import { summarizeCashFlow } from '$lib/plan-projection'
  import { sameYearMonthsInverted, timingComplete } from '$lib/schemas'
  import type { CashFlowSchedule, Expense, Income } from '$lib/schemas'
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

  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))
  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let frequencyItems = $derived(getFrequencyItems($_))
  let scheduleItems: SelectFieldItem<CashFlowSchedule>[] = $derived([
    { value: 'one_time', label: $_('page.plan.scheduleOneTime') },
    { value: 'recurring', label: $_('page.plan.scheduleRecurring') },
  ])
  let yearItems = $derived(years.map((y) => ({ value: y, label: y })))

  const isNew = $derived(initial === undefined)

  function blankForm(): CashFlowFields {
    const counter =
      kind === 'income'
        ? itemsForPlan(appStore.profile.incomes, plan.id).length + 1
        : itemsForPlan(appStore.profile.expenses, plan.id).length + 1
    const name =
      kind === 'income'
        ? $_('page.setup.income.defaultName', { values: { index: counter } })
        : $_('page.setup.expenses.defaultName', { values: { index: counter } })
    return blankCashFlowFields(crypto.randomUUID(), name)
  }

  function seedForm(src: CashFlow | undefined): CashFlowFields {
    return src ? cashFlowToFields(src) : blankForm()
  }

  let form = $state<CashFlowFields>(blankForm())

  // Re-seed form whenever the dialog opens, so reopening discards prior edits.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
    }
    wasOpen = open
  })

  const listConfig = $derived(PROFILE_LISTS[kind])

  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  // Same-year ranges can't end before they start: an end month that a later
  // start/year change turned invalid is cleared so the user picks again (Save
  // stays disabled until they do).
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
    (form.amount ?? 0) > 0 &&
      (form.schedule === 'one_time' ||
        (timingComplete(form.start, form.start_year, form.start_month, form.start_age) &&
          timingComplete(form.end, form.end_year, form.end_month, form.end_age) &&
          !sameYearMonthsInverted(
            form.start,
            form.start_year,
            form.start_month,
            form.end,
            form.end_year,
            form.end_month,
          ))),
  )

  function close() {
    onOpenChange(false)
  }

  function save() {
    upsertProfileItem(listConfig, cashFlowFromFields(form), plan)
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

  // Preview of what the cash flow moves over the plan (Figma 941-71859 and
  // 941-72501). A one-time item without inflation has nothing to add beyond
  // the amount itself, so the box is hidden for it — mirrors the transfer
  // dialog.
  const summary = $derived.by(() => {
    if (!canSave) return undefined
    if (form.schedule === 'one_time' && !form.inflation_adjusted) return undefined
    return summarizeCashFlow(
      cashFlowFromFields(form),
      plan,
      appStore.profile.birthDate?.getFullYear(),
    )
  })
</script>

{#snippet cashFlowFooter()}
  <!-- Figma 941-71859: Create + Cancel on the left in a muted footer. -->
  <div class="flex flex-1 items-center gap-2">
    <Button disabled={!canSave} onclick={save}>
      {isNew ? $_('page.plan.createItem') : $_('page.plan.saveChanges')}
    </Button>
    <Button variant="outline" onclick={() => onOpenChange(false)}>
      {$_('page.plan.cancel')}
    </Button>
  </div>
{/snippet}

<!-- Figma 941-71859 / 941-72501: the header carries the title and the close X
     only — no rename/duplicate/include/delete toolbar. -->
<ItemEditDialogShell
  bind:open
  {onOpenChange}
  name={form.name}
  onNameChange={(v) => (form.name = v)}
  {isNew}
  {isIncluded}
  renamable={false}
  toolbar={false}
  newTitle={isNew
    ? kind === 'income'
      ? $_('page.plan.newIncome')
      : $_('page.plan.newExpense')
    : undefined}
  footer={cashFlowFooter}
  footerClass="bg-muted"
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  <!-- Label -->
  <div class="flex flex-col gap-2">
    <Label for="{uid}-cashFlowName">{$_('page.plan.cashFlowLabelLabel')}</Label>
    <Input
      id="{uid}-cashFlowName"
      value={form.name}
      oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
    />
  </div>

  <!-- Type + (one-time) Date / (recurring) Frequency -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-schedule">
        {kind === 'income'
          ? $_('page.plan.incomeScheduleLabel')
          : $_('page.plan.expenseScheduleLabel')}
      </Label>
      <SelectField
        id="{uid}-schedule"
        value={form.schedule}
        items={scheduleItems}
        onValueChange={(v) => {
          if (v) form.schedule = v
        }}
      />
    </div>
    {#if form.schedule === 'one_time'}
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-transactionYear">{$_('page.plan.transactionDateLabel')}</Label>
        <div class="flex items-center gap-2">
          <SelectField
            id="{uid}-transactionYear"
            class="max-w-24"
            aria-label={$_('page.setup.aboutYou.selectYear')}
            value={form.transaction_year !== undefined ? String(form.transaction_year) : ''}
            items={yearItems}
            onValueChange={(v) => {
              if (v) form.transaction_year = Number(v)
            }}
          />
          <SelectField
            aria-label={$_('page.setup.aboutYou.selectMonth')}
            value={form.transaction_month !== undefined ? String(form.transaction_month - 1) : ''}
            items={months}
            onValueChange={(v) => {
              if (v) form.transaction_month = Number(v) + 1
            }}
          />
        </div>
      </div>
    {:else}
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
    {/if}
  </div>

  <!-- Amount + Adjust for inflation -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-amount">
        {kind === 'income' ? $_('page.setup.income.netAmount') : $_('page.setup.common.amount')}
      </Label>
      <SuffixedInput
        id="{uid}-amount"
        value={form.amount}
        suffix={currencyLabel}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (form.amount = v)}
      />
    </div>
    <div class="flex h-8 flex-1 items-center">
      <InflationAdjustToggle
        checked={form.inflation_adjusted}
        onCheckedChange={(v) => (form.inflation_adjusted = v)}
      />
    </div>
  </div>

  {#if form.schedule === 'recurring'}
    <DateAgeSelector
      mode="start"
      value={form.start}
      year={form.start_year}
      month={form.start_month}
      age={form.start_age}
      {years}
      {months}
      birthDateSet={appStore.profile.birthDate !== undefined}
      description={kind === 'income'
        ? $_('page.plan.incomeStartDescription')
        : $_('page.plan.expenseStartDescription')}
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
      minMonth={endMinMonth(form)}
      birthDateSet={appStore.profile.birthDate !== undefined}
      neverLabel={$_('page.plan.cashFlowEndNever')}
      description={kind === 'income'
        ? $_('page.plan.incomeEndDescription')
        : $_('page.plan.expenseEndDescription')}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.end = v)}
      onYearChange={(v) => (form.end_year = v)}
      onMonthChange={(v) => (form.end_month = v)}
      onAgeChange={(v) => (form.end_age = v)}
    />

    <ChangeOverTimeSelector
      value={form.change_over_time}
      percentage={form.change_percentage}
      noneLabel={$_('page.plan.cashFlowChangeNone')}
      changeDescription={kind === 'income'
        ? $_('page.plan.incomeChangeDescription')
        : $_('page.plan.expenseChangeDescription')}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.change_over_time = v)}
      onPercentageChange={(v) => (form.change_percentage = v)}
    />
  {/if}

  {#if summary}
    <div class="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      {#if form.schedule === 'recurring'}
        <span>
          {$_('page.plan.cashFlowOccurrences', { values: { count: summary.occurrences } })}
        </span>
      {/if}
      {#if !form.inflation_adjusted}
        <span>
          {$_('page.plan.cashFlowTotal', {
            values: { total: appStore.formatCurrencyCode(summary.nominalTotal) },
          })}
        </span>
      {:else}
        <span class="flex items-center gap-2">
          <TrendingUp class="size-4 shrink-0" />
          {#if form.schedule === 'one_time'}
            {$_('page.plan.cashFlowNominalValue', {
              values: {
                nominal: appStore.formatCurrencyCode(summary.nominalTotal),
                real: appStore.formatCurrencyCode(summary.realTotal),
              },
            })}
          {:else}
            {$_('page.plan.cashFlowNominalTotal', {
              values: {
                nominal: appStore.formatCurrencyCode(summary.nominalTotal),
                real: appStore.formatCurrencyCode(summary.realTotal),
              },
            })}
          {/if}
        </span>
      {/if}
    </div>
  {/if}
</ItemEditDialogShell>
