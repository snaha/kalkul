<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Copy, Eye, EyeOff, SquarePen, Trash2, X } from '@lucide/svelte'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
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

  type CashFlow = Income | Expense

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    kind: 'income' | 'expense'
    initial: CashFlow | undefined
    plan: PortfolioStore
  }

  let { open = $bindable(), onOpenChange, kind, initial, plan }: Props = $props()

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
  let editingName = $state(false)
  let nameInputRef: HTMLInputElement | undefined = $state()

  // Re-seed form whenever the dialog opens, so reopening discards prior edits.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
      editingName = initial === undefined
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  // Plan-level "included" state for the current item kind. `undefined` means
  // all items are included (no exclusion list yet).
  const isIncluded = $derived.by(() => {
    if (isNew) return true
    const ids = kind === 'income' ? plan.included_income_ids : plan.included_expense_ids
    if (ids === undefined) return true
    return ids.includes(form.id)
  })

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

  // A timing edge ('start' or 'end') is complete only once the mode-specific
  // field is filled — otherwise the projection would silently fall back to the
  // plan's first year (see schemas.ts cashFlowTemporalRefinement).
  function timingComplete(
    mode: CashFlowStart | CashFlowEnd,
    year: number | undefined,
    month: number | undefined,
    age: number | undefined,
  ): boolean {
    if (mode === 'at_specific_date') return year !== undefined && month !== undefined
    if (mode === 'when_age_is') return age !== undefined
    return true
  }

  const canSave = $derived(
    timingComplete(form.start, form.start_year, form.start_month, form.start_age) &&
      timingComplete(form.end, form.end_year, form.end_month, form.end_age),
  )

  function close() {
    onOpenChange(false)
  }

  function save() {
    if (kind === 'income') {
      const existing = appStore.profile.incomes ?? []
      const projected = projectIncome(form)
      const idx = existing.findIndex((i) => i.id === form.id)
      const next =
        idx === -1
          ? [...existing, projected]
          : existing.map((it, i) => (i === idx ? projected : it))
      appStore.updateProfile({ incomes: next })
      // If the plan has an explicit include list, append the new id so the
      // item is visible in this plan by default.
      if (idx === -1 && plan.included_income_ids !== undefined) {
        plan.update({ included_income_ids: [...plan.included_income_ids, form.id] })
      }
    } else {
      const existing = appStore.profile.expenses ?? []
      const projected = projectExpense(form)
      const idx = existing.findIndex((e) => e.id === form.id)
      const next =
        idx === -1
          ? [...existing, projected]
          : existing.map((it, i) => (i === idx ? projected : it))
      appStore.updateProfile({ expenses: next })
      if (idx === -1 && plan.included_expense_ids !== undefined) {
        plan.update({ included_expense_ids: [...plan.included_expense_ids, form.id] })
      }
    }
    close()
  }

  function duplicate() {
    if (kind === 'income') {
      const existing = appStore.profile.incomes ?? []
      const idx = existing.findIndex((i) => i.id === form.id)
      if (idx === -1) return
      const copy: Income = {
        ...existing[idx],
        id: crypto.randomUUID(),
        name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
      }
      const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
      appStore.updateProfile({ incomes: next })
    } else {
      const existing = appStore.profile.expenses ?? []
      const idx = existing.findIndex((e) => e.id === form.id)
      if (idx === -1) return
      const copy: Expense = {
        ...existing[idx],
        id: crypto.randomUUID(),
        name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
      }
      const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
      appStore.updateProfile({ expenses: next })
    }
    close()
  }

  function toggleExclude() {
    const currentIds = kind === 'income' ? plan.included_income_ids : plan.included_expense_ids
    const allIds =
      kind === 'income'
        ? (appStore.profile.incomes ?? []).map((i) => i.id)
        : (appStore.profile.expenses ?? []).map((e) => e.id)
    const seeded = currentIds ?? allIds
    const nextIds = seeded.includes(form.id)
      ? seeded.filter((id) => id !== form.id)
      : [...seeded, form.id]
    if (kind === 'income') {
      plan.update({ included_income_ids: nextIds })
    } else {
      plan.update({ included_expense_ids: nextIds })
    }
    close()
  }

  function remove() {
    const confirmMessage =
      kind === 'income' ? $_('page.plan.deleteIncomeConfirm') : $_('page.plan.deleteExpenseConfirm')
    if (!window.confirm(confirmMessage)) return
    if (kind === 'income') {
      const next = (appStore.profile.incomes ?? []).filter((i) => i.id !== form.id)
      appStore.updateProfile({ incomes: next })
    } else {
      const next = (appStore.profile.expenses ?? []).filter((e) => e.id !== form.id)
      appStore.updateProfile({ expenses: next })
    }
    close()
  }

  function startRenaming() {
    editingName = true
    queueMicrotask(() => {
      nameInputRef?.focus()
      nameInputRef?.select()
    })
  }

  function stopRenaming() {
    editingName = false
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      {#if editingName}
        <Input
          bind:ref={nameInputRef}
          value={form.name}
          oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
          onblur={isNew ? undefined : stopRenaming}
          onkeydown={(e) => {
            if (!isNew && (e.key === 'Enter' || e.key === 'Escape')) stopRenaming()
          }}
          class="flex-1 text-lg font-semibold"
        />
      {:else}
        <Dialog.Title class="flex-1 truncate text-lg font-semibold">{form.name}</Dialog.Title>
      {/if}

      {#if !isNew}
        <Button
          variant="ghost"
          size="icon"
          onclick={startRenaming}
          aria-label={$_('page.plan.renameItem')}
        >
          <SquarePen class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={duplicate}
          aria-label={$_('page.plan.duplicateItem')}
        >
          <Copy class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={toggleExclude}
          aria-label={isIncluded ? $_('page.plan.excludeFromPlan') : $_('page.plan.includeInPlan')}
        >
          {#if isIncluded}
            <Eye class="size-4" />
          {:else}
            <EyeOff class="size-4 text-destructive" />
          {/if}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
      <!-- Amount + Frequency -->
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.setup.common.amount')}</Label>
          <SuffixedInput
            value={form.amount}
            suffix={currencyLabel}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.amount = v)}
          />
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.setup.common.frequency')}</Label>
          <SelectField
            value={form.frequency}
            items={frequencyItems}
            onValueChange={(v) => {
              if (v) form.frequency = v as Frequency
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
              <Label>{$_('page.setup.income.percentageToWithhold')}</Label>
              <SuffixedInput
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
        onValueChange={(v) => (form.start = v as CashFlowStart)}
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
        birthDateSet={appStore.profile.birthDate !== undefined}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (form.end = v as CashFlowEnd)}
        onYearChange={(v) => (form.end_year = v)}
        onMonthChange={(v) => (form.end_month = v)}
        onAgeChange={(v) => (form.end_age = v)}
      />

      <ChangeOverTimeSelector
        value={form.change_over_time}
        percentage={form.change_percentage}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (form.change_over_time = v as ChangeOverTime)}
        onPercentageChange={(v) => (form.change_percentage = v)}
      />
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={save} disabled={!canSave}>{$_('page.plan.saveChanges')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
