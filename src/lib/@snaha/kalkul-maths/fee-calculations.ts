import Decimal from 'decimal.js'

import { type Investment } from '$lib/types'

import {
  DAYS_PER_YEAR,
  DECIMAL_0,
  DECIMAL_1,
  FORTY_SIXTY_FEE_RATIO,
  PERCENTAGE_DIVISOR,
} from './constants'
import { DEFAULT_FEE_TYPE, type EntryFeeType, type FeeType } from './types'

Decimal.set({ precision: 30 })

function toPercentage(n: number): number {
  return n / PERCENTAGE_DIVISOR
}

function feeValue(type: FeeType, value: number): number {
  switch (type) {
    case 'percentage':
      return toPercentage(value)
    case 'fixed':
      return value
  }
  return value
}

function stringToFeeType(feeType: string): FeeType {
  if (feeType === 'fixed') {
    return feeType
  } else {
    return DEFAULT_FEE_TYPE
  }
}

/**
 * Calculate the entry fee for a given amount
 *
 * @param amount The amount to calculate the fee for
 * @param entryFeeType The type of the entry fee
 * @param fee The fee percentage as a decimal 0-1
 * @param totalDepositAmount The total deposit amount
 * @param alreadyPaid The amount already paid
 *
 * @returns The entry fee amount
 */
export function calculateEntryFee(
  amount: number,
  entryFeeType: EntryFeeType,
  fee: number,
  totalDepositAmount: number,
  alreadyPaid: number,
): number {
  switch (entryFeeType) {
    case 'ongoing':
      return amount * fee
    case 'forty-sixty': {
      const stillToBePaid = totalDepositAmount * fee - alreadyPaid
      const currentFee = amount * FORTY_SIXTY_FEE_RATIO
      if (stillToBePaid >= currentFee) return currentFee
      return Math.max(stillToBePaid, 0)
    }
    case 'upfront': {
      const stillToBePaid = totalDepositAmount * fee - alreadyPaid
      if (stillToBePaid >= amount) return amount
      return Math.max(stillToBePaid, 0)
    }
  }
}

export function calculateExitFee(amount: number, exitFeeType: FeeType, fee: number): number {
  switch (exitFeeType) {
    case 'fixed':
      return fee
    case 'percentage':
      return amount * fee
  }
  return 0
}

export function calculateDailyAPY(investment: Investment, numDaysPerYear = DAYS_PER_YEAR) {
  const investmentAPY = toPercentage(investment.apy ?? 0)
  const apyWithSuccessFee = investment.success_fee
    ? investmentAPY - investmentAPY * toPercentage(investment.success_fee)
    : investmentAPY

  const normalizedAPYWithSuccessFee = DECIMAL_1.add(apyWithSuccessFee)
  const dailyAPYWithSuccessFee = normalizedAPYWithSuccessFee.pow(1 / numDaysPerYear)

  const normalizedAPY = DECIMAL_1.add(investmentAPY)
  const dailyAPY = normalizedAPY.pow(1 / numDaysPerYear)

  return { dailyAPY, dailyAPYWithSuccessFee }
}

export function calculateDailyManagementFees(
  investment: Investment,
  numDaysPerYear = DAYS_PER_YEAR,
) {
  const managementFeeType = stringToFeeType(investment.management_fee_type || DEFAULT_FEE_TYPE)

  return calculateDailyFees(investment.management_fee ?? 0, managementFeeType, numDaysPerYear)
}

export function calculateDailyFees(fee: number, feeType: FeeType, numDaysPerYear = DAYS_PER_YEAR) {
  const value = feeValue(feeType, fee)

  switch (feeType) {
    case 'fixed':
      return {
        dailyFee: new Decimal(value).div(numDaysPerYear),
        dailyFeeMultiplier: DECIMAL_1,
      }
    case 'percentage':
      return {
        dailyFee: DECIMAL_0,
        dailyFeeMultiplier: DECIMAL_1.sub(value).pow(1 / numDaysPerYear),
      }
  }
}
