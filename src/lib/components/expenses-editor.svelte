<script lang="ts">
  import { untrack } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import { Button } from '$lib/components/ui/button'
  import type { Expense as ExpenseData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  type ExpenseUI = Omit<ExpenseData, 'amount'> & {
    amount: number | undefined
    showAdvanced: boolean
    editing: boolean
    editingName: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(
    Number(calculateAge(appStore.profile.birthDate, currentYear, currentMonth)) || undefined,
  )
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))

  function storedToUI(stored: ExpenseData[]): ExpenseUI[] {
    return stored.map((exp) => ({
      ...exp,
      amount: exp.amount > 0 ? exp.amount : undefined,
      showAdvanced: false,
      editing: false,
      editingName: false,
    }))
  }

  let expenses = $state<ExpenseUI[]>([])
  let expenseCounter = $state(0)
  let hydrated = $state(false)

  $effect(() => {
    if (hydrated || appStore.loading) return
    const stored = appStore.profile.expenses
    if (stored && stored.length > 0) {
      expenses = storedToUI(stored)
      expenseCounter = expenses.length
    }
    hydrated = true
  })

  $effect(() => {
    onHasValueChange?.(expenses.some((e) => (e.amount ?? 0) > 0))
  })

  function addExpense() {
    expenseCounter++
    for (const exp of expenses) exp.editing = false
    expenses.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.expenses.defaultName', { values: { index: expenseCounter } }),
      amount: undefined,
      frequency: 'monthly',
      showAdvanced: false,
      start: 'immediately',
      start_year: currentYear,
      start_month: currentMonth,
      start_age: currentAge,
      end: 'never',
      end_year: currentYear,
      end_month: currentMonth,
      end_age: currentAge,
      change_over_time: 'none',
      change_percentage: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateExpense(expense: ExpenseUI) {
    expenseCounter++
    const idx = expenses.indexOf(expense)
    expenses.splice(idx + 1, 0, {
      ...expense,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: expense.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteExpense(expense: ExpenseUI) {
    const idx = expenses.indexOf(expense)
    if (idx !== -1) expenses.splice(idx, 1)
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function save() {
    const data: ExpenseData[] = expenses
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount ?? 0,
        frequency: e.frequency,
        start: e.start,
        start_year: e.start === 'at_specific_date' ? e.start_year : undefined,
        start_month: e.start === 'at_specific_date' ? e.start_month : undefined,
        start_age: e.start === 'when_age_is' ? e.start_age : undefined,
        end: e.end,
        end_year: e.end === 'at_specific_date' ? e.end_year : undefined,
        end_month: e.end === 'at_specific_date' ? e.end_month : undefined,
        end_age: e.end === 'when_age_is' ? e.end_age : undefined,
        change_over_time: e.change_over_time,
        change_percentage:
          e.change_over_time === 'increase_yearly' || e.change_over_time === 'decrease_yearly'
            ? (e.change_percentage ?? 0)
            : undefined,
      }))
    appStore.updateProfile({ expenses: data })
  }
  // Auto-save on any edit. Skip the first post-hydration run so merely viewing the
  // page doesn't rewrite the profile (and bump "last updated") without a real change.
  let autoSaveArmed = false
  $effect(() => {
    if (!hydrated) return
    $state.snapshot(expenses) // track every field so edits re-run this effect
    if (!autoSaveArmed) {
      autoSaveArmed = true
      return
    }
    untrack(save)
  })
</script>

<div class="flex w-full flex-col gap-4">
  {#each expenses as expense (expense.id)}
    <CashFlowItemCard
      item={expense}
      suffix={currencyLabel}
      sentiment="negative"
      startDescription={$_('page.setup.expenses.startDescription')}
      endDescription={$_('page.setup.expenses.endDescription')}
      changeDescription={$_('page.setup.expenses.changeDescription')}
      {years}
      {months}
      formatCurrency={appStore.formatCurrency}
      formatNumber={appStore.formatNumber}
      onToggleEditing={() => {
        expense.editing = !expense.editing
      }}
      onDuplicate={() => duplicateExpense(expense)}
      onDelete={() => deleteExpense(expense)}
      onStartEditingName={() => {
        expense.editingName = true
      }}
      onStopEditingName={() => {
        expense.editingName = false
      }}
    />
  {/each}

  <div>
    <Button variant="secondary" onclick={addExpense}>
      <Plus class="size-4" />
      {$_('page.setup.expenses.addExpense')}
    </Button>
  </div>
</div>
