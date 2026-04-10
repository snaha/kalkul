<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import type { Expense as ExpenseData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  type ExpenseUI = Omit<ExpenseData, 'amount'> & {
    amount: number | undefined
    showAdvanced: boolean
    editing: boolean
    editingName: boolean
  }

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

  let canContinue = $derived(expenses.some((e) => (e.amount ?? 0) > 0))

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

  function saveExpenses() {
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

  function handleContinue() {
    saveExpenses()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
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
        suffix={currencyLabel}
        sentiment="negative"
        startDescription={$_('page.setup.expenses.startDescription')}
        endDescription={$_('page.setup.expenses.endDescription')}
        matchInflationDescription={$_('page.setup.expenses.matchInflationDescription')}
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

  <OnboardingNav
    {canContinue}
    onBack={handleBack}
    onSkip={handleSkip}
    onContinue={handleContinue}
  />
</div>
