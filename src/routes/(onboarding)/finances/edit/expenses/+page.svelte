<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { type ExpenseUI, onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(
    Number(calculateAge(appStore.profile.birthDate, currentYear, currentMonth)) || undefined,
  )
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))

  let canContinue = $derived(draft.expenses.some((e) => (e.amount ?? 0) > 0))

  function addExpense() {
    draft.expenseCounter++
    for (const exp of draft.expenses) exp.editing = false
    draft.expenses.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.expenses.defaultName', { values: { index: draft.expenseCounter } }),
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
    draft.expenseCounter++
    const idx = draft.expenses.indexOf(expense)
    draft.expenses.splice(idx + 1, 0, {
      ...expense,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: expense.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteExpense(expense: ExpenseUI) {
    const idx = draft.expenses.indexOf(expense)
    if (idx !== -1) draft.expenses.splice(idx, 1)
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function handleContinue() {
    draft.commitExpenses()
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
    {#each draft.expenses as expense (expense.id)}
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

  <OnboardingNav
    {canContinue}
    onBack={handleBack}
    onSkip={handleSkip}
    onContinue={handleContinue}
  />
</div>
