import { calculateBothTerms, calculateInflationAdjustedAmount } from './calculation-utils'
import { calculatePeriodDifference, formatDate, incrementDate } from './date'
import type { Transaction } from './types'

export function calculateTotalAmount(
  transactions: Transaction[],
  type: string,
  inflationRate = 0,
  portfolioStartDate?: string,
) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((prev, transaction) => {
      // If not inflation-adjusted or no portfolio context, use original calculation
      if (!transaction.inflation_adjusted || !portfolioStartDate) {
        const periods = calculateNumOccurrences(transaction)
        return prev + transaction.amount * periods
      }

      // For inflation-adjusted transactions, calculate each occurrence
      if (!transaction.repeat || !transaction.end_date) {
        // Single transaction
        const adjustedAmount = calculateInflationAdjustedAmount(
          transaction.amount,
          transaction.date,
          portfolioStartDate,
          inflationRate,
        )
        return prev + adjustedAmount
      }

      // Recurring transaction - calculate each occurrence with its own inflation adjustment
      let totalForTransaction = 0
      const startDate = new Date(transaction.date)
      const endDate = new Date(transaction.end_date)

      if (!transaction.repeat_unit || !transaction.repeat) {
        return prev + transaction.amount
      }

      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const currentDateString = formatDate(currentDate)
        const adjustedAmount = calculateInflationAdjustedAmount(
          transaction.amount,
          currentDateString,
          portfolioStartDate,
          inflationRate,
        )
        totalForTransaction += adjustedAmount

        // Move to next occurrence
        currentDate = incrementDate(currentDate, transaction.repeat_unit, transaction.repeat)
      }

      return prev + totalForTransaction
    }, 0)
}

export function calculateNumOccurrences({
  date,
  end_date,
  repeat_unit,
  repeat,
}: Omit<Transaction, 'amount' | 'type'>): number {
  if (typeof end_date !== 'string') return 1
  if (!repeat_unit || !repeat) {
    throw new Error('invalidTransactionInput')
  }

  const startDate = new Date(date)
  const endDate = new Date(end_date)

  return (calculatePeriodDifference(endDate, startDate, repeat_unit) + 1) / repeat
}

/**
 * Calculate both inflation-adjusted and nominal total amounts in a single pass.
 * This is the main function that should be used for performance-critical calculations.
 *
 * @param transactions Array of transactions to calculate
 * @param type Transaction type to filter by
 * @param inflationRate Annual inflation rate (e.g., 0.03 for 3%)
 * @param portfolioStartDate Portfolio start date for inflation calculations
 * @returns Object with { adjusted: inflation-adjusted total, nominal: nominal total }
 */
export function calculateTotalDisplayAmount(
  transactions: Transaction[],
  type: string,
  inflationRate = 0,
  portfolioStartDate?: string,
): { adjusted: number; nominal: number } {
  let adjustedTotal = 0
  let nominalTotal = 0

  transactions
    .filter((transaction) => transaction.type === type)
    .forEach((transaction) => {
      const signMultiplier = transaction.type === 'withdrawal' ? -1 : 1
      // If no portfolio context, use original calculation
      if (!portfolioStartDate) {
        const periods = calculateNumOccurrences(transaction)
        const amount = transaction.amount * periods
        adjustedTotal += amount * signMultiplier
        nominalTotal += amount * signMultiplier
        return
      }

      // For all transactions, calculate each occurrence with display adjustments
      if (!transaction.repeat || !transaction.end_date) {
        // Single transaction - use optimized calculation
        const adjustedAmount = transaction.inflation_adjusted
          ? calculateInflationAdjustedAmount(
              transaction.amount,
              transaction.date,
              portfolioStartDate,
              inflationRate,
            )
          : transaction.amount

        // Calculate both terms in one operation for better performance
        const { real, nominal } = calculateBothTerms(
          adjustedAmount,
          transaction.date,
          portfolioStartDate,
          inflationRate,
        )

        adjustedTotal += real * signMultiplier
        nominalTotal += nominal * signMultiplier
        return
      }

      // Recurring transaction - calculate each occurrence with its own inflation adjustment
      let adjustedForTransaction = 0
      let nominalForTransaction = 0
      const startDate = new Date(transaction.date)
      const endDate = new Date(transaction.end_date)

      if (!transaction.repeat_unit || !transaction.repeat) {
        adjustedTotal += transaction.amount * signMultiplier
        nominalTotal += transaction.amount * signMultiplier
        return
      }

      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const currentDateString = formatDate(currentDate)
        const adjustedAmount = transaction.inflation_adjusted
          ? calculateInflationAdjustedAmount(
              transaction.amount,
              currentDateString,
              portfolioStartDate,
              inflationRate,
            )
          : transaction.amount

        // Calculate both terms in one operation for better performance
        const { real, nominal } = calculateBothTerms(
          adjustedAmount,
          currentDateString,
          portfolioStartDate,
          inflationRate,
        )

        adjustedForTransaction += real
        nominalForTransaction += nominal

        // Move to next occurrence
        currentDate = incrementDate(currentDate, transaction.repeat_unit, transaction.repeat)
      }

      adjustedTotal += adjustedForTransaction * signMultiplier
      nominalTotal += nominalForTransaction * signMultiplier
    })

  return { adjusted: adjustedTotal, nominal: nominalTotal }
}
