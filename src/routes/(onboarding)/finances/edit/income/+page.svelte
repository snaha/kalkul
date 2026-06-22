<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { type IncomeUI, onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(
    Number(calculateAge(appStore.profile.birthDate, currentYear, currentMonth)) || undefined,
  )
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))

  let canContinue = $derived(draft.incomes.some((i) => (i.amount ?? 0) > 0))

  function addIncome() {
    draft.incomeCounter++
    for (const inc of draft.incomes) inc.editing = false
    draft.incomes.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index: draft.incomeCounter } }),
      amount: undefined,
      frequency: 'monthly',
      showAdvanced: false,
      withhold_taxes: false,
      tax_percentage: undefined,
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

  function duplicateIncome(income: IncomeUI) {
    draft.incomeCounter++
    const idx = draft.incomes.indexOf(income)
    draft.incomes.splice(idx + 1, 0, {
      ...income,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: income.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteIncome(income: IncomeUI) {
    const idx = draft.incomes.indexOf(income)
    if (idx !== -1) draft.incomes.splice(idx, 1)
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function handleContinue() {
    draft.commitIncomes()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_INCOME, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_INCOME, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_INCOME, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.income.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.income.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each draft.incomes as income (income.id)}
      <CashFlowItemCard
        item={income}
        suffix={currencyLabel}
        sentiment="positive"
        startDescription={$_('page.setup.income.startDescription')}
        endDescription={$_('page.setup.income.endDescription')}
        changeDescription={$_('page.setup.income.changeDescription')}
        {years}
        {months}
        formatCurrency={appStore.formatCurrency}
        formatNumber={appStore.formatNumber}
        onToggleEditing={() => {
          income.editing = !income.editing
        }}
        onDuplicate={() => duplicateIncome(income)}
        onDelete={() => deleteIncome(income)}
        onStartEditingName={() => {
          income.editingName = true
        }}
        onStopEditingName={() => {
          income.editingName = false
        }}
      >
        {#snippet extraAdvancedContent()}
          <div class="flex items-end gap-4">
            <div class="flex flex-1 flex-col justify-center">
              <label class="flex h-8 cursor-pointer items-center gap-2">
                <Checkbox
                  checked={income.withhold_taxes}
                  onCheckedChange={(v) => {
                    income.withhold_taxes = v === true
                  }}
                />
                <span class="text-sm font-medium leading-none">
                  {$_('page.setup.income.withholdTaxes')}
                </span>
              </label>
            </div>
            {#if income.withhold_taxes}
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.income.percentageToWithhold')}</Label>
                <SuffixedInput
                  value={income.tax_percentage}
                  suffix="%"
                  onValueChange={(v) => {
                    income.tax_percentage = v
                  }}
                />
              </div>
            {:else}
              <div class="flex-1"></div>
            {/if}
          </div>
        {/snippet}
      </CashFlowItemCard>
    {/each}

    <div>
      <Button variant="secondary" onclick={addIncome}>
        <Plus class="size-4" />
        {$_('page.setup.income.addIncome')}
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
