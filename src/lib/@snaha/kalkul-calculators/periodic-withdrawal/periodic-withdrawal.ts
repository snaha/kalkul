import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths/constants'
import type { PeriodicWithdrawalGoalData } from '$lib/types'

// Calculation input uses Date objects for date math
export type PeriodicWithdrawalCalculationInput = Omit<
  PeriodicWithdrawalGoalData,
  'depositStart' | 'withdrawalStart' | 'customDepositAmount'
> & {
  depositStart: Date
  withdrawalStart: Date
}

/**
 * Converts goal data (with ISO date strings) to calculation input (with Date objects)
 *
 * @param goalData - The periodic withdrawal goal data from database
 * @returns Calculation input with Date objects ready for use in calculator functions
 */
export function goalDataToCalculationInput(
  goalData: PeriodicWithdrawalGoalData,
): PeriodicWithdrawalCalculationInput {
  return {
    depositStart: new Date(goalData.depositStart),
    withdrawalStart: new Date(goalData.withdrawalStart),
    withdrawalDuration: goalData.withdrawalDuration,
    desiredBudget: goalData.desiredBudget,
    budgetPeriod: goalData.budgetPeriod,
    currentSavings: goalData.currentSavings,
    apy: goalData.apy,
    inflation: goalData.inflation,
    depositPeriod: goalData.depositPeriod,
  }
}

/**
 * Calculates the target portfolio balance needed at withdrawal phase start.
 *
 * Works backward from withdrawal phase end (when balance should reach zero) to determine
 * the starting balance needed at the beginning of the withdrawal phase. Takes into account:
 * - Monthly or yearly budget withdrawals during the withdrawal phase
 * - Inflation adjustments for withdrawals over time
 * - Monthly portfolio growth during the withdrawal phase (APY compounded monthly)
 *
 * @param input - Periodic withdrawal calculation parameters including withdrawal dates, budget, APY, and inflation
 * @returns The required balance at withdrawal start to sustain withdrawals until the end
 */
function calculateTargetBalanceAtWithdrawal(input: PeriodicWithdrawalCalculationInput): number {
  const {
    withdrawalStart,
    withdrawalDuration,
    desiredBudget,
    budgetPeriod,
    inflation,
    depositStart,
    apy,
  } = input

  const startYear = depositStart.getFullYear()
  const withdrawalStartYear = withdrawalStart.getFullYear()
  const withdrawalStartMonth = withdrawalStart.getMonth()

  const apyRate = new Decimal(apy).div(100)
  const inflationRate = new Decimal(inflation).div(100)

  // Pre-calculate common values
  const oneOverTwelve = DECIMAL_1.div(12)
  const monthlyRate = DECIMAL_1.plus(apyRate).pow(oneOverTwelve)
  const monthlyInflationRate = DECIMAL_1.plus(inflationRate).pow(oneOverTwelve)

  // Calculate withdrawal phase month-by-month, working backwards from end
  const withdrawalMonthlyBalances: Decimal[] = []
  const totalWithdrawalMonths = withdrawalDuration * 12

  // At end of withdrawal phase, balance should be 0
  withdrawalMonthlyBalances[totalWithdrawalMonths] = DECIMAL_0

  // Work backwards through withdrawal phase
  // Pre-calculate inflation multipliers for efficiency (working backwards)
  const totalMonths = (withdrawalStartYear - startYear) * 12 + totalWithdrawalMonths
  let inflationMultiplier = monthlyInflationRate.pow(totalMonths)

  for (let monthIndex = totalWithdrawalMonths - 1; monthIndex >= 0; monthIndex--) {
    // Update inflation multiplier (going backwards means dividing)
    inflationMultiplier = inflationMultiplier.div(monthlyInflationRate)

    // Calculate withdrawal for this month
    let withdrawal = DECIMAL_0
    if (budgetPeriod === 'month') {
      withdrawal = new Decimal(desiredBudget).mul(inflationMultiplier)
    } else if (budgetPeriod === 'year') {
      // Yearly withdrawal at withdrawal start month
      const monthInYear = monthIndex % 12
      if (monthInYear === withdrawalStartMonth) {
        withdrawal = new Decimal(desiredBudget).mul(inflationMultiplier)
      }
    }

    // Work backwards: balance after growth and withdrawal = next month's balance
    // balance * monthlyRate - withdrawal = nextBalance
    // So: balance = (nextBalance + withdrawal) / monthlyRate
    const nextBalance = withdrawalMonthlyBalances[monthIndex + 1]
    const thisBalance = nextBalance.plus(withdrawal).div(monthlyRate)
    withdrawalMonthlyBalances[monthIndex] = thisBalance
  }

  // The balance needed at withdrawal start (beginning of first withdrawal month)
  return withdrawalMonthlyBalances[0].toNumber()
}

/**
 * Calculates the required regular deposit amount to reach periodic withdrawal goals.
 *
 * Uses binary search to efficiently find the deposit amount that will result in
 * the target balance at withdrawal phase start. The algorithm:
 * - Determines target balance needed at withdrawal start using backwards calculation
 * - Iteratively tests deposit amounts to find one that reaches the target
 * - Converges to within 0.1% tolerance or 50 iterations
 *
 * @param input - Periodic withdrawal calculation parameters including savings, deposits, and goals
 * @returns The required deposit amount per period (rounded to 2 decimal places)
 * @example
 * // Returns monthly deposit needed to reach withdrawal goal
 * calculateRequiredDeposit({
 *   withdrawalStart: new Date('2050-01-01'),
 *   withdrawalDuration: 30,
 *   desiredBudget: 50000,
 *   budgetPeriod: 'year',
 *   currentSavings: 10000,
 *   apy: 7,
 *   inflation: 3,
 *   depositStart: new Date('2025-01-01'),
 *   depositPeriod: 'month'
 * })
 */
export function calculateRequiredDeposit(input: PeriodicWithdrawalCalculationInput): number {
  const targetAtWithdrawal = calculateTargetBalanceAtWithdrawal(input)
  const withdrawalStartIndex =
    input.withdrawalStart.getFullYear() - input.depositStart.getFullYear()

  // If target is 0 or we're already at withdrawal phase, no deposit needed
  if (targetAtWithdrawal <= 0 || withdrawalStartIndex <= 0) {
    return 0
  }

  // Binary search for the right deposit amount
  let low = 0
  let high = targetAtWithdrawal // Upper bound (way more than needed)
  let iterations = 0
  const maxIterations = 50
  const tolerance = targetAtWithdrawal * 0.001 // 0.1% tolerance

  while (iterations < maxIterations && high - low > 0.01) {
    const mid = (low + high) / 2
    const whatYouHave = calculateWhatYouHave(input, mid)
    const balanceAtWithdrawal = whatYouHave[withdrawalStartIndex]

    if (Math.abs(balanceAtWithdrawal - targetAtWithdrawal) < tolerance) {
      return Math.round(mid * 100) / 100 // Round to 2 decimal places
    }

    if (balanceAtWithdrawal < targetAtWithdrawal) {
      low = mid
    } else {
      high = mid
    }

    iterations++
  }

  // Return the midpoint of final range
  return Math.round(((low + high) / 2) * 100) / 100
}

/**
 * Calculates projected portfolio balance over time with regular deposits and withdrawals.
 *
 * Simulates the entire financial lifecycle month-by-month:
 * - **Accumulation phase**: Regular deposits (monthly or yearly) with growth until withdrawal phase
 * - **Withdrawal phase**: Regular withdrawals (monthly or yearly) with continued growth
 * - All amounts are adjusted for inflation over time
 * - Growth is compounded monthly based on APY
 *
 * @param input - Periodic withdrawal calculation parameters including all financial assumptions
 * @param depositAmount - The amount to deposit each period (monthly or yearly)
 * @returns Array of year-end balances (December 31) from deposit start through withdrawal phase end
 * @example
 * // Returns [balance_year1, balance_year2, ..., balance_yearN]
 * calculateWhatYouHave(input, 1000) // With $1000 monthly deposits
 */
export function calculateWhatYouHave(
  input: PeriodicWithdrawalCalculationInput,
  depositAmount: number,
): number[] {
  const {
    withdrawalStart,
    withdrawalDuration,
    currentSavings,
    apy,
    inflation,
    depositStart,
    depositPeriod,
    desiredBudget,
    budgetPeriod,
  } = input

  const startYear = depositStart.getFullYear()
  const startMonth = depositStart.getMonth() // 0-11
  const withdrawalStartYear = withdrawalStart.getFullYear()
  const withdrawalStartMonth = withdrawalStart.getMonth()
  const endYear = withdrawalStartYear + withdrawalDuration

  const apyRate = new Decimal(apy).div(100)
  const inflationRate = new Decimal(inflation).div(100)

  // Pre-calculate common values
  const oneOverTwelve = DECIMAL_1.div(12)
  const monthlyRate = DECIMAL_1.plus(apyRate).pow(oneOverTwelve)
  const monthlyInflationRate = DECIMAL_1.plus(inflationRate).pow(oneOverTwelve)

  const values: number[] = []
  let balance = DECIMAL_0
  let inflationMultiplier = DECIMAL_1

  // Work month by month
  let currentYear = startYear
  let currentMonth = startMonth
  let monthsSinceStart = 0

  // Track when we've passed withdrawal start
  let inWithdrawalPhase = false

  while (currentYear <= endYear) {
    // Check if we've entered withdrawal phase (happens at withdrawal start month)
    if (
      currentYear > withdrawalStartYear ||
      (currentYear === withdrawalStartYear && currentMonth >= withdrawalStartMonth)
    ) {
      inWithdrawalPhase = true
    }

    // Handle initial deposit on the very first month
    if (monthsSinceStart === 0) {
      balance = new Decimal(currentSavings)
    } else {
      // Update inflation multiplier incrementally for all months after the first
      inflationMultiplier = inflationMultiplier.mul(monthlyInflationRate)
    }

    // Add deposits BEFORE withdrawal phase starts (stop at the month before withdrawal)
    const isBeforeWithdrawal =
      currentYear < withdrawalStartYear ||
      (currentYear === withdrawalStartYear && currentMonth < withdrawalStartMonth)

    if (monthsSinceStart > 0 && isBeforeWithdrawal) {
      // Accumulation phase: add monthly deposit (inflation-adjusted)
      if (depositPeriod === 'month') {
        const inflatedDeposit = new Decimal(depositAmount).mul(inflationMultiplier)
        balance = balance.plus(inflatedDeposit)
      } else if (depositPeriod === 'year' && currentMonth === startMonth) {
        // Yearly deposits happen on the same month as start
        const inflatedDeposit = new Decimal(depositAmount).mul(inflationMultiplier)
        balance = balance.plus(inflatedDeposit)
      }
    }

    // Apply monthly growth
    balance = balance.mul(monthlyRate)

    // Handle withdrawals during withdrawal phase
    if (inWithdrawalPhase) {
      let withdrawal = DECIMAL_0
      if (budgetPeriod === 'month') {
        withdrawal = new Decimal(desiredBudget).mul(inflationMultiplier)
      } else if (budgetPeriod === 'year' && currentMonth === withdrawalStartMonth) {
        // Yearly withdrawals happen on the same month as withdrawal start
        withdrawal = new Decimal(desiredBudget).mul(inflationMultiplier)
      }

      balance = balance.minus(withdrawal)

      // Don't go negative
      if (balance.lessThan(DECIMAL_0)) {
        balance = DECIMAL_0
      }
    }

    // Record year-end balance (December = month 11)
    if (currentMonth === 11) {
      values.push(balance.toNumber())
    }

    // Move to next month
    currentMonth++
    monthsSinceStart++
    if (currentMonth > 11) {
      currentMonth = 0
      currentYear++
    }
  }

  return values
}

/**
 * Generates an array of years for charting projections.
 *
 * Creates a sequential array of years from the deposit start year through
 * the end of the withdrawal period. Used as x-axis values for periodic withdrawal charts.
 *
 * @param depositStart - The date when deposits begin
 * @param withdrawalStart - The date when the withdrawal phase begins
 * @param withdrawalDuration - Duration of the withdrawal phase in years
 * @returns Array of years from deposit start to withdrawal phase end
 * @example
 * // Returns [2025, 2026, 2027, ..., 2055]
 * generateYears(new Date('2025-01-01'), new Date('2050-01-01'), 5)
 */
export function generateYears(
  depositStart: Date,
  withdrawalStart: Date,
  withdrawalDuration: number,
): number[] {
  const startYear = depositStart.getFullYear()
  const endYear = withdrawalStart.getFullYear() + withdrawalDuration
  const years: number[] = []

  for (let year = startYear; year <= endYear; year++) {
    years.push(year)
  }

  return years
}
