<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import type { PeriodicWithdrawalCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'
  import { goalDataToCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'
  import ContentLayout from '$lib/components/content-layout.svelte'
  import KidEducation from '$lib/components/goals-kid-education.svelte'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { goalCalculatorStore } from '$lib/stores/goal-calculator.svelte'
  import type { EducationGoalData } from '$lib/types'

  const portfolioId = $derived(page.params.portfolio_id)
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  // Convert goalData to calculationInput for the calculator component
  const initialData = $derived(
    goalCalculatorStore.goalInput && goalCalculatorStore.goalInput.goalData.type === 'education'
      ? {
          calculationInput: goalDataToCalculationInput(goalCalculatorStore.goalInput.goalData),
          currency: goalCalculatorStore.goalInput.currency,
        }
      : undefined,
  )

  function close() {
    history.back()
  }

  function handleCalculate(
    input: PeriodicWithdrawalCalculationInput,
    currency: string,
    name: string,
    childName: string,
  ) {
    const goalData: EducationGoalData = {
      type: 'education',
      name,
      childName,
      depositStart: input.depositStart.toISOString(),
      depositPeriod: input.depositPeriod,
      currentSavings: input.currentSavings,
      withdrawalStart: input.withdrawalStart.toISOString(),
      withdrawalDuration: input.withdrawalDuration,
      desiredBudget: input.desiredBudget,
      budgetPeriod: input.budgetPeriod,
      apy: input.apy,
      inflation: input.inflation,
    }
    goalCalculatorStore.setGoalInput(goalData, currency)
    goto(routes.KID_EDUCATION_GOAL_PREVIEW(portfolioId))
  }
</script>

{#if portfolio}
  <ContentLayout>
    <KidEducation
      profile={appStore.profile}
      {portfolio}
      {close}
      onCalculate={handleCalculate}
      {initialData}
    />
  </ContentLayout>
{/if}
