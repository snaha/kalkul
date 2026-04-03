import { differenceInDays } from 'date-fns'
import Decimal from 'decimal.js'

import { DAYS_PER_YEAR, DECIMAL_1 } from './constants'
import { type TransactionMap } from './types'

Decimal.set({ precision: 30 })

// Performance optimization: Cache for inflation multipliers
const inflationCache = new Map<string, Decimal>()

function getCacheKey(baseDate: string, targetDate: string, inflationRate: number): string {
  return `${baseDate}:${targetDate}:${inflationRate}`
}

function getInflationMultiplier(
  baseDate: string,
  targetDate: string,
  inflationRate: number,
): Decimal {
  const cacheKey = getCacheKey(baseDate, targetDate, inflationRate)

  let multiplier = inflationCache.get(cacheKey)
  if (multiplier) {
    return multiplier
  }

  const baseDateObj = new Date(baseDate)
  const targetDateObj = new Date(targetDate)
  const daysDifference = differenceInDays(targetDateObj, baseDateObj)

  if (daysDifference === 0) {
    multiplier = DECIMAL_1
  } else {
    const yearsDifference = daysDifference / DAYS_PER_YEAR
    multiplier = DECIMAL_1.add(inflationRate).pow(yearsDifference)
  }

  inflationCache.set(cacheKey, multiplier)
  return multiplier
}

export function calculateTotalDepositAmount(deposits: TransactionMap): number {
  let total = 0
  for (const [, entry] of deposits) {
    total += entry.amount
  }
  return total
}

/**
 * Calculate inflation-adjusted amount for a transaction
 *
 * @param originalAmount The original transaction amount
 * @param transactionDate The date of the transaction (yyyy-MM-dd format)
 * @param baseDate The base date for inflation calculation (yyyy-MM-dd format)
 * @param inflationRate Annual inflation rate (e.g., 0.03 for 3%)
 * @returns The inflation-adjusted amount
 */
export function calculateInflationAdjustedAmount(
  originalAmount: number,
  transactionDate: string,
  baseDate: string,
  inflationRate: number,
): number {
  // Use cached inflation multiplier
  const inflationMultiplier = getInflationMultiplier(baseDate, transactionDate, inflationRate)

  // Apply inflation adjustment
  const adjustedAmount = new Decimal(originalAmount).mul(inflationMultiplier)

  return adjustedAmount.toNumber()
}

/**
 * Calculate both real and nominal terms in a single operation for performance
 */
export function calculateBothTerms(
  nominalAmount: number,
  transactionDate: string,
  baseDate: string,
  inflationRate: number,
): { real: number; nominal: number } {
  const inflationMultiplier = getInflationMultiplier(baseDate, transactionDate, inflationRate)
  const deflationMultiplier = DECIMAL_1.div(inflationMultiplier)
  const realTermsAmount = new Decimal(nominalAmount).mul(deflationMultiplier)

  return {
    real: realTermsAmount.toNumber(),
    nominal: nominalAmount,
  }
}
