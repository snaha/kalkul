<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { goto } from '$app/navigation'
  import PeriodicWithdrawalPreview from '$lib/components/goals-periodic-withdrawal-preview.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import {
    calculateRequiredDeposit,
    calculateWhatYouHave,
    generateYears,
    goalDataToCalculationInput,
  } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/periodic-withdrawal'
  import routes from '$lib/routes'
  import { page } from '$app/state'
  import { goalCalculatorStore } from '$lib/stores/goal-calculator.svelte'
  import { appStore } from '$lib/stores/app.svelte'
  import type { RetirementGoalData } from '$lib/types'
  import { goalToTransactions } from '$lib/@snaha/kalkul-calculators/periodic-withdrawal/goal-transactions'
  import { onMount } from 'svelte'

  const portfolioId = $derived(page.params.portfolio_id)

  // Get calculation data from store
  const calculatorData = $derived(goalCalculatorStore.goalInput)

  // Convert goal data to calculation input
  const calculationInput = $derived(
    calculatorData ? goalDataToCalculationInput(calculatorData.goalData) : undefined,
  )

  // Calculate required deposit
  const requiredDeposit = $derived(
    calculationInput ? calculateRequiredDeposit(calculationInput) : 0,
  )

  // Track deposit amount changes
  let depositAmount = $state(0)
  let desiredBudget = $state(0)

  onMount(() => {
    desiredBudget = calculatorData?.goalData.desiredBudget ?? 0
  })

  // Update deposit amount when goal changes
  $effect(() => {
    depositAmount = requiredDeposit
  })

  $effect(() => {
    if (
      calculatorData?.goalData &&
      calculatorData.goalData.desiredBudget !== desiredBudget &&
      desiredBudget
    ) {
      calculatorData.goalData.desiredBudget = desiredBudget
    }
  })

  // Ensure deposit amount is always a valid number
  const validDepositAmount = $derived(
    typeof depositAmount === 'number' && !isNaN(depositAmount) ? depositAmount : 0,
  )

  // Calculate data for charts
  const whatYouNeed = $derived(
    calculationInput ? calculateWhatYouHave(calculationInput, requiredDeposit) : [],
  )
  const whatYouHave = $derived(
    calculationInput ? calculateWhatYouHave(calculationInput, validDepositAmount) : [],
  )
  const years = $derived(
    calculationInput
      ? generateYears(
          calculationInput.depositStart,
          calculationInput.withdrawalStart,
          calculationInput.withdrawalDuration,
        )
      : [],
  )

  // Generate chart labels
  const chartLabels = $derived(() => {
    if (!years.length || !calculationInput) return []
    const startYear = years[0]
    const endYear = years[years.length - 1]
    const withdrawalStartYear = calculationInput.withdrawalStart.getFullYear()
    return years.map((year) => {
      if (year === startYear || year === endYear || year === withdrawalStartYear) {
        return year.toString()
      }
      return ''
    })
  })

  function close() {
    goalCalculatorStore.clearGoalInput()
    goto(routes.PORTFOLIO(portfolioId))
  }

  function goBack() {
    goto(routes.RETIREMENT_GOAL_CALCULATOR(portfolioId))
  }

  function saveGoal(finalDepositAmount: number) {
    if (!calculatorData) return

    const validFinalDepositAmount =
      typeof finalDepositAmount === 'number' && !isNaN(finalDepositAmount) ? finalDepositAmount : 0

    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: calculatorData.goalData.depositStart,
      depositPeriod: calculatorData.goalData.depositPeriod,
      currentSavings: calculatorData.goalData.currentSavings,
      customDepositAmount: validFinalDepositAmount,
      withdrawalStart: calculatorData.goalData.withdrawalStart,
      withdrawalDuration: calculatorData.goalData.withdrawalDuration,
      desiredBudget: calculatorData.goalData.desiredBudget,
      budgetPeriod: calculatorData.goalData.budgetPeriod,
      apy: calculatorData.goalData.apy,
      inflation: calculatorData.goalData.inflation,
    }

    const portfolio = appStore.portfolios.find((p) => p.id === portfolioId)
    if (!portfolio) return

    const goalId = portfolio.addGoal({
      name: $_('demo.investments.retirement'),
      type: 'goal',
      apy: calculatorData.goalData.apy,
      goal_data: goalData,
      advanced_fees: false,
      entry_fee: 0,
      exit_fee: 0,
      management_fee: 0,
      ter: 0,
    })

    const goalInvestment = portfolio.goals.find((g) => g.id === goalId)
    if (goalInvestment) {
      const transactions = goalToTransactions(goalData, {
        initialSavings: $_('demo.transactions.initialSavings'),
        regularDeposit: $_('demo.transactions.regularDeposit'),
        withdrawal: $_('demo.transactions.retirementWithdrawal'),
      })
      for (const transaction of transactions) {
        goalInvestment.addTransaction(transaction)
      }
    }

    goto(routes.PORTFOLIO(portfolioId)).then(() => {
      goalCalculatorStore.clearGoalInput()
    })
  }
</script>

<Fullscreen>
  {#if calculatorData}
    <PeriodicWithdrawalPreview
      calculatedDeposit={requiredDeposit}
      currency={calculatorData.currency}
      frequency={calculatorData.goalData.budgetPeriod}
      bind:depositAmount
      bind:desiredBudget
      chartLabels={chartLabels()}
      whatYouNeedData={whatYouNeed}
      whatYouHaveData={whatYouHave}
      {close}
      {goBack}
      {saveGoal}
      labels={{
        pageTitle: $_('page.retirement.preview.title'),
        budgetLabel: $_('page.retirement.preview.budgetLabel'),
      }}
    />
  {:else}
    <Typography variant="h2">404 - {$_('common.notFound')}</Typography>
  {/if}
</Fullscreen>
