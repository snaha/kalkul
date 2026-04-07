<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight, Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import type { Expense as ExpenseData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  interface ExpenseUI {
    id: string
    name: string
    amount: string
    frequency: string
    showAdvanced: boolean
    start: string
    startYear: string
    startMonth: string
    startAge: string
    end: string
    endYear: string
    endMonth: string
    endAge: string
    changeOverTime: string
    changePercentage: string
    editing: boolean
    editingName: boolean
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(calculateAge(appStore.profile.birthDate, currentYear, currentMonth))
  const years = getYearOptions()
  const months = getMonthOptions()

  function storedToUI(stored: ExpenseData[]): ExpenseUI[] {
    return stored.map((exp) => ({
      id: exp.id,
      name: exp.name,
      amount: exp.amount > 0 ? String(exp.amount) : '',
      frequency: exp.frequency,
      showAdvanced: false,
      start: exp.start,
      startYear: exp.start_year !== undefined ? String(exp.start_year) : String(currentYear),
      startMonth: exp.start_month !== undefined ? String(exp.start_month) : String(currentMonth),
      startAge: exp.start_age !== undefined ? String(exp.start_age) : currentAge,
      end: exp.end,
      endYear: exp.end_year !== undefined ? String(exp.end_year) : String(currentYear),
      endMonth: exp.end_month !== undefined ? String(exp.end_month) : String(currentMonth),
      endAge: exp.end_age !== undefined ? String(exp.end_age) : currentAge,
      changeOverTime: exp.change_over_time,
      changePercentage: exp.change_percentage !== undefined ? String(exp.change_percentage) : '',
      editing: false,
      editingName: false,
    }))
  }

  let expenses = $state<ExpenseUI[]>([])
  let expenseCounter = $state(0)
  let loaded = $state(false)

  $effect(() => {
    const stored = appStore.profile.expenses
    if (!loaded && stored && stored.length > 0) {
      expenses = storedToUI(stored)
      expenseCounter = expenses.length
      loaded = true
    }
  })

  let canContinue = $derived(
    expenses.some((e) => e.amount.trim().length > 0 && Number(e.amount) > 0),
  )

  function addExpense() {
    expenseCounter++
    for (const exp of expenses) {
      exp.editing = false
    }
    expenses.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.expenses.defaultName', { values: { index: expenseCounter } }),
      amount: '',
      frequency: 'monthly',
      showAdvanced: false,
      start: 'immediately',
      startYear: String(currentYear),
      startMonth: String(currentMonth),
      startAge: currentAge,
      end: 'never',
      endYear: String(currentYear),
      endMonth: String(currentMonth),
      endAge: currentAge,
      changeOverTime: 'none',
      changePercentage: '',
      editing: true,
      editingName: false,
    })
  }

  function duplicateExpense(expense: ExpenseUI) {
    expenseCounter++
    const idx = expenses.indexOf(expense)
    const copy: ExpenseUI = {
      ...expense,
      id: crypto.randomUUID(),
      name: `${expense.name} (copy)`,
      editing: true,
      editingName: false,
    }
    expenses.splice(idx + 1, 0, copy)
  }

  function deleteExpense(expense: ExpenseUI) {
    const idx = expenses.indexOf(expense)
    if (idx !== -1) expenses.splice(idx, 1)
  }

  let currencyLabel = $derived(appStore.profile.currency || 'EUR')

  function formatAmount(amount: string): string {
    const num = Number(amount)
    if (isNaN(num) || num === 0) return ''
    return `-${num.toLocaleString()} ${currencyLabel}`
  }

  function saveExpenses() {
    const data: ExpenseData[] = expenses
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        id: e.id,
        name: e.name,
        amount: Number(e.amount) || 0,
        frequency: e.frequency,
        start: e.start,
        start_year: e.start === 'at_specific_date' ? Number(e.startYear) : undefined,
        start_month: e.start === 'at_specific_date' ? Number(e.startMonth) : undefined,
        start_age: e.start === 'when_age_is' ? Number(e.startAge) : undefined,
        end: e.end,
        end_year: e.end === 'at_specific_date' ? Number(e.endYear) : undefined,
        end_month: e.end === 'at_specific_date' ? Number(e.endMonth) : undefined,
        end_age: e.end === 'when_age_is' ? Number(e.endAge) : undefined,
        change_over_time: e.changeOverTime,
        change_percentage:
          e.changeOverTime === 'increase_yearly' || e.changeOverTime === 'decrease_yearly'
            ? Number(e.changePercentage) || 0
            : undefined,
      }))
    appStore.updateProfile({ expenses: data })
  }

  function handleContinue() {
    saveExpenses()
    goto(resolve(routes.HOME))
  }

  function handleSkip() {
    goto(resolve(routes.HOME))
  }

  function handleBack() {
    goto(resolve(routes.FINANCES_EDIT_INCOME))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.expenses.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.expenses.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each expenses as expense (expense.id)}
      <CashFlowItemCard
        item={expense}
        {currencyLabel}
        amountColor="destructive"
        startDescription={$_('page.setup.expenses.startDescription')}
        endDescription={$_('page.setup.expenses.endDescription')}
        matchInflationDescription={$_('page.setup.expenses.matchInflationDescription')}
        changeDescription={$_('page.setup.expenses.changeDescription')}
        {years}
        {months}
        {formatAmount}
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

  <div class="flex w-full items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.setup.back')}
    </Button>
    <div class="flex flex-1 items-center justify-end gap-2">
      <Button variant="ghost" onclick={handleSkip}>
        {$_('page.setup.skip')}
      </Button>
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.setup.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
