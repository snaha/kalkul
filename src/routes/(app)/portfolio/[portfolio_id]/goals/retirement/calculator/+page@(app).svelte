<script lang="ts">
  import RetirementCalculator from '$lib/components/goals-retirement-calculator.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import { page } from '$app/state'
  import { appStore } from '$lib/stores/app.svelte'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import { goalCalculatorStore } from '$lib/stores/goal-calculator.svelte'
  import type { PeriodicWithdrawalCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'
  import { goalDataToCalculationInput } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'
  import type { RetirementGoalData } from '$lib/types'

  const portfolioId = $derived(page.params.portfolio_id)
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  // Convert goalData to calculationInput for the calculator component
  const initialData = $derived(
    goalCalculatorStore.goalInput && goalCalculatorStore.goalInput.goalData.type === 'retirement'
      ? {
          calculationInput: goalDataToCalculationInput(goalCalculatorStore.goalInput.goalData),
          currency: goalCalculatorStore.goalInput.currency,
        }
      : undefined,
  )

  function close() {
    history.back()
  }

  function handleCalculate(input: PeriodicWithdrawalCalculationInput, currency: string) {
    const goalData: RetirementGoalData = {
      type: 'retirement',
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
    goto(routes.RETIREMENT_GOAL_PREVIEW(portfolioId))
  }
</script>

{#if portfolio}
  <Fullscreen>
    <RetirementCalculator
      profile={appStore.profile}
      {portfolio}
      {close}
      onCalculate={handleCalculate}
      {initialData}
    />
  </Fullscreen>
{/if}
