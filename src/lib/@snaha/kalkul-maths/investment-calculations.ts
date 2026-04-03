import { addDays } from 'date-fns'
import Decimal from 'decimal.js'

import { type Investment } from '$lib/types'

import { calculateTotalDepositAmount } from './calculation-utils'
import { DAYS_PER_YEAR, DECIMAL_0, MONTHS_PER_YEAR, PERCENTAGE_DIVISOR } from './constants'
import { formatDate } from './date'
import {
  calculateDailyAPY,
  calculateDailyFees,
  calculateDailyManagementFees,
  calculateEntryFee,
  calculateExitFee,
} from './fee-calculations'
import { createTransactionMap } from './transaction-map'
import {
  DEFAULT_ENTRY_FEE_TYPE,
  DEFAULT_FEE_TYPE,
  type EntryFeeType,
  type ExhaustionWarning,
  type FeeType,
  type InvestmentData,
  type PortfolioPeriodCount,
  type Transaction,
} from './types'

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

function stringToEntryFeeType(entryFeeType: string): EntryFeeType {
  if (entryFeeType === 'forty-sixty') {
    return entryFeeType
  } else if (entryFeeType === 'upfront') {
    return entryFeeType
  } else {
    return DEFAULT_ENTRY_FEE_TYPE
  }
}

function stringToFeeType(feeType: string): FeeType {
  if (feeType === 'fixed') {
    return feeType
  } else {
    return DEFAULT_FEE_TYPE
  }
}

export interface FeeBreakdown<T = number> {
  entryFee: T
  exitFee: T
  managementFee: T
  successFee: T
  TERFee: T
}

function resetFeeBreakdown<T>(value: T): FeeBreakdown<T> {
  return {
    entryFee: value,
    exitFee: value,
    managementFee: value,
    successFee: value,
    TERFee: value,
  }
}

function convertFeeBreakdownToNumbers(fees: FeeBreakdown<Decimal>): FeeBreakdown {
  return {
    entryFee: fees.entryFee.toNumber(),
    exitFee: fees.exitFee.toNumber(),
    managementFee: fees.managementFee.toNumber(),
    successFee: fees.successFee.toNumber(),
    TERFee: fees.TERFee.toNumber(),
  }
}

/**
 * Core calculation engine for daily investment value updates
 * Handles the complex financial math for a single day
 *
 * Performance Note:
 * This function creates an object on every call which adds overhead compared
 * to inline calculation. Benchmarks show:
 * - 5-year calculation: ~35ms (vs ~13ms inline)
 * - 20-year calculation: ~150ms (vs ~58ms inline)
 * - 80-year calculation: ~600ms (vs ~230ms inline)
 *
 * For typical use cases (5-20 years), the overhead is acceptable given the
 * maintainability benefits. For extreme cases (80+ years), consider caching
 * or lazy evaluation strategies if performance becomes critical.
 *
 * @internal
 */
function calculateDailyInvestmentUpdate(
  currentValue: Decimal,
  currentFeeBreakdown: FeeBreakdown<Decimal>,
  depositsOnDate: number,
  withdrawalsOnDate: number,
  investment: Investment,
  dailyAPY: Decimal,
  dailyAPYWithSuccessFee: Decimal,
  dailyManagementFee: Decimal,
  dailyManagementFeeMultiplier: Decimal,
  dailyTERFeeMulitplier: Decimal,
  totalDepositAmount: number,
) {
  const investmentCalculationErrors: string[] = []

  const depositFee = calculateEntryFee(
    depositsOnDate,
    stringToEntryFeeType(investment.entry_fee_type || DEFAULT_ENTRY_FEE_TYPE),
    toPercentage(investment.entry_fee || 0),
    totalDepositAmount,
    currentFeeBreakdown.entryFee.toNumber(),
  )

  const exitFeeType = stringToFeeType(investment.exit_fee_type || DEFAULT_FEE_TYPE)
  const withdrawalFee = calculateExitFee(
    withdrawalsOnDate,
    exitFeeType,
    withdrawalsOnDate > 0 ? feeValue(exitFeeType, investment.exit_fee || 0) : 0,
  )

  const successFee = currentValue.mul(dailyAPY).sub(currentValue.mul(dailyAPYWithSuccessFee))
  const managementFee = currentValue
    .mul(dailyAPYWithSuccessFee)
    .sub(currentValue.mul(dailyAPYWithSuccessFee).mul(dailyManagementFeeMultiplier))
    .add(dailyManagementFee)

  const TERFee = currentValue
    .mul(dailyAPYWithSuccessFee)
    .sub(currentValue.mul(dailyAPYWithSuccessFee).mul(dailyTERFeeMulitplier))

  // Update fee breakdown
  currentFeeBreakdown.entryFee = currentFeeBreakdown.entryFee.add(depositFee)
  currentFeeBreakdown.exitFee = currentFeeBreakdown.exitFee.add(withdrawalFee)
  currentFeeBreakdown.managementFee = currentFeeBreakdown.managementFee.add(managementFee)
  currentFeeBreakdown.successFee = currentFeeBreakdown.successFee.add(successFee)
  currentFeeBreakdown.TERFee = currentFeeBreakdown.TERFee.add(TERFee)

  // Calculate new current value
  const multilpliedValue = currentValue
    .mul(dailyAPYWithSuccessFee)
    .mul(dailyTERFeeMulitplier)
    .mul(dailyManagementFeeMultiplier)

  const depositedValue = multilpliedValue.add(depositsOnDate - depositFee) // Deposit fee is subtracted from the deposit

  const valueAfterDailyManagementFee = depositedValue.sub(
    depositedValue.greaterThanOrEqualTo(dailyManagementFee) ? dailyManagementFee : depositedValue,
  )

  if (depositedValue.lessThan(dailyManagementFee)) {
    investmentCalculationErrors.push('managementFee')
  }

  const totalWithdrawalNeeded = new Decimal(withdrawalsOnDate + withdrawalFee) // The exit fee is taken from the withdrawn amount
  const actualWithdrawal = valueAfterDailyManagementFee.greaterThanOrEqualTo(totalWithdrawalNeeded)
    ? totalWithdrawalNeeded
    : valueAfterDailyManagementFee

  if (valueAfterDailyManagementFee.lessThan(totalWithdrawalNeeded)) {
    investmentCalculationErrors.push('withdrawal')
  }

  const calculatedValue = valueAfterDailyManagementFee.sub(actualWithdrawal)
  const newCurrentValue = calculatedValue.greaterThanOrEqualTo(0) ? calculatedValue : DECIMAL_0

  // Amount that couldn't be withdrawn
  const missingWithdrawalAmount = totalWithdrawalNeeded.sub(actualWithdrawal)

  return {
    newCurrentValue,
    depositFee,
    actualWithdrawal,
    withdrawalFee,
    successFee,
    managementFee,
    TERFee,
    investmentCalculationErrors,
    missingWithdrawalAmount,
  }
}

/**
 * Get investment values normalized for a certain period
 *
 * Uses the shared calculateDailyInvestmentUpdate engine for consistency
 * with getCurrentInvestmentValue. See that function for performance notes.
 *
 * @param param0 Period and count of the investment
 * @param param1 Investment data
 * @param investment Investment parameters
 * @param numDaysPerYear Number of days per year for calculations
 * @returns An object containing the investment values, fees, withdrawals and deposits for a certain period defined by arity
 */
export function getInvestmentValues(
  { period, count }: PortfolioPeriodCount,
  { deposits, withdrawals, startDate, endDate }: InvestmentData,
  investment: Investment,
  numDaysPerYear = DAYS_PER_YEAR,
): {
  investmentValues: number[]
  feeValues: FeeBreakdown[]
  withdrawalValues: number[]
  depositValues: number[]
  exhaustionWarning?: ExhaustionWarning
} {
  const investmentValues: number[] = []
  const feeValues: FeeBreakdown[] = []
  const withdrawalValues: number[] = []
  const depositValues: number[] = []

  let exhaustionDate: Date | undefined
  let totalMissingAmount = DECIMAL_0
  let exhaustedTransactionIds: string[] | undefined

  let currentValue = DECIMAL_0
  let currentFeeBreakdown: FeeBreakdown<Decimal> = resetFeeBreakdown(DECIMAL_0)
  let withdrawal = DECIMAL_0
  let deposit = DECIMAL_0

  const { dailyAPY, dailyAPYWithSuccessFee } = calculateDailyAPY(investment, numDaysPerYear)
  const { dailyFee: dailyManagementFee, dailyFeeMultiplier: dailyManagementFeeMultiplier } =
    calculateDailyManagementFees(investment, numDaysPerYear)
  const { dailyFeeMultiplier: dailyTERFeeMulitplier } = calculateDailyFees(
    investment.ter ?? 0,
    'percentage',
    numDaysPerYear,
  )

  const totalDepositAmount = calculateTotalDepositAmount(deposits)

  // Initialize the next date to record values (end of first period)
  let nextRecordDate: Date
  if (period === 'year') {
    nextRecordDate = new Date(startDate.getFullYear(), MONTHS_PER_YEAR - 1, 31)
  } else {
    const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    nextRecordDate = lastDayOfMonth
  }

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const dateKey = formatDate(date)
    const depositEntry = deposits.get(dateKey)
    const withdrawalEntry = withdrawals.get(dateKey)
    const depositsOnDate = depositEntry?.amount ?? 0
    const withdrawalsOnDate = withdrawalEntry?.amount ?? 0

    const {
      newCurrentValue,
      actualWithdrawal,
      investmentCalculationErrors,
      missingWithdrawalAmount,
    } = calculateDailyInvestmentUpdate(
      currentValue,
      currentFeeBreakdown,
      exhaustionDate ? 0 : depositsOnDate,
      withdrawalsOnDate,
      investment,
      exhaustionDate ? DECIMAL_0 : dailyAPY,
      exhaustionDate ? DECIMAL_0 : dailyAPYWithSuccessFee,
      dailyManagementFee,
      dailyManagementFeeMultiplier,
      dailyTERFeeMulitplier,
      totalDepositAmount,
    )

    // Record when investment reaches zero due to insufficient funds
    if (
      investmentCalculationErrors.includes('withdrawal') &&
      newCurrentValue.equals(0) &&
      !exhaustionDate
    ) {
      exhaustionDate = date
      // Track which transaction(s) caused the exhaustion
      if (withdrawalEntry?.transactionIds && withdrawalEntry.transactionIds.length > 0) {
        exhaustedTransactionIds = withdrawalEntry.transactionIds
      }
    }

    // Accumulate unfulfilled withdrawal amounts
    totalMissingAmount = totalMissingAmount.add(missingWithdrawalAmount)

    currentValue = newCurrentValue
    deposit = deposit.add(exhaustionDate ? 0 : depositsOnDate)
    withdrawal = withdrawal.add(actualWithdrawal)

    if (date >= nextRecordDate) {
      if (period === 'year') {
        // Move to the end of the next calendar year
        const nextYear = nextRecordDate.getFullYear() + count
        nextRecordDate = new Date(nextYear, MONTHS_PER_YEAR - 1, 31) // December 31st of next year
      } else {
        // period === 'month' - move to the end of the next calendar month
        let nextMonth = nextRecordDate.getMonth() + count
        let nextYear = nextRecordDate.getFullYear()

        // Handle month overflow
        while (nextMonth > 11) {
          nextYear += 1
          nextMonth -= MONTHS_PER_YEAR
        }

        // Last day of the next month
        nextRecordDate = new Date(nextYear, nextMonth + 1, 0)
      }

      investmentValues.push(currentValue.toNumber())

      feeValues.push(convertFeeBreakdownToNumbers(currentFeeBreakdown))
      currentFeeBreakdown = resetFeeBreakdown(DECIMAL_0)

      withdrawalValues.push(-withdrawal.toNumber())
      withdrawal = DECIMAL_0

      depositValues.push(deposit.toNumber())
      deposit = DECIMAL_0
    }
  }

  if (endDate < nextRecordDate) {
    investmentValues.push(currentValue.toNumber())
    feeValues.push(convertFeeBreakdownToNumbers(currentFeeBreakdown))
    withdrawalValues.push(-withdrawal.toNumber())
    depositValues.push(deposit.toNumber())
  }

  const exhaustionWarning = exhaustionDate
    ? {
        date: exhaustionDate,
        missingAmount: totalMissingAmount.toNumber(),
        transactionIds: exhaustedTransactionIds ?? [],
      }
    : undefined

  return {
    investmentValues,
    feeValues,
    withdrawalValues,
    depositValues,
    exhaustionWarning,
  }
}

export function getBaseData(
  transactions: Transaction[],
  inflationRate = 0,
  portfolioStartDate?: string,
): InvestmentData {
  const { startDate, endDate } = getInvestmentStartAndEndDates(transactions)
  const portfolioStart = portfolioStartDate || formatDate(startDate)

  const deposits = createTransactionMap(
    transactions.filter((transaction) => transaction.type === 'deposit'),
    portfolioStart,
    inflationRate,
  )
  const withdrawals = createTransactionMap(
    transactions.filter((transaction) => transaction.type === 'withdrawal'),
    portfolioStart,
    inflationRate,
  )

  return { deposits, withdrawals, startDate, endDate }
}

function getInvestmentStartAndEndDates(transaction: Transaction[]) {
  if (transaction.length === 0) return { startDate: new Date(), endDate: new Date() }

  let startDate = new Date(transaction[0].date)
  let endDate = new Date(transaction[0].end_date ?? transaction[0].date)

  for (const tx of transaction) {
    const sd = new Date(tx.date)
    const ed = tx.end_date ? new Date(tx.end_date) : sd
    startDate = sd < startDate ? sd : startDate
    endDate = ed > endDate ? ed : endDate
  }
  return { startDate, endDate }
}

/**
 * Calculate the current value of an investment as of a specific date
 *
 * Uses the shared calculateDailyInvestmentUpdate engine for consistency
 * with getInvestmentValues. See that function for performance notes.
 *
 * @param param0 Investment data containing deposits, withdrawals, and date range
 * @param investment Investment parameters
 * @param asOfDate The date to calculate the value as of (defaults to today)
 * @param numDaysPerYear Number of days per year for calculations
 * @returns The current value of the investment
 */
export function getCurrentInvestmentValue(
  { deposits, withdrawals, startDate }: InvestmentData,
  investment: Investment,
  asOfDate: Date = new Date(),
  numDaysPerYear = DAYS_PER_YEAR,
): number {
  // If the as-of date is before the investment starts, value is 0
  if (asOfDate < startDate) {
    return 0
  }

  // Calculate up to the asOfDate, continuing beyond endDate if needed
  const calculationEndDate = asOfDate

  let currentValue = new Decimal(0)
  const currentFeeBreakdown: FeeBreakdown<Decimal> = resetFeeBreakdown(new Decimal(0))

  const { dailyAPY, dailyAPYWithSuccessFee } = calculateDailyAPY(investment, numDaysPerYear)
  const { dailyFee: dailyManagementFee, dailyFeeMultiplier: dailyManagementFeeMultiplier } =
    calculateDailyManagementFees(investment, numDaysPerYear)
  const { dailyFeeMultiplier: dailyTERFeeMulitplier } = calculateDailyFees(
    investment.ter ?? 0,
    'percentage',
    numDaysPerYear,
  )

  const totalDepositAmount = calculateTotalDepositAmount(deposits)

  // Calculate day by day up to the as-of date
  for (let date = startDate; date <= calculationEndDate; date = addDays(date, 1)) {
    const depositsOnDate = deposits.get(formatDate(date))?.amount ?? 0
    const withdrawalsOnDate = withdrawals.get(formatDate(date))?.amount ?? 0

    const { newCurrentValue } = calculateDailyInvestmentUpdate(
      currentValue,
      currentFeeBreakdown,
      depositsOnDate,
      withdrawalsOnDate,
      investment,
      dailyAPY,
      dailyAPYWithSuccessFee,
      dailyManagementFee,
      dailyManagementFeeMultiplier,
      dailyTERFeeMulitplier,
      totalDepositAmount,
    )

    currentValue = newCurrentValue
  }

  return currentValue.toNumber()
}

/**
 * Calculate the current total value of a portfolio as of a specific date (typically today)
 *
 * @param transactionStore Transaction store to get transaction data
 * @param investments Array of investments in the portfolio
 * @param asOfDate The date to calculate the value as of (defaults to today)
 * @param inflationRate Portfolio inflation rate for auto-inflated transactions
 * @param portfolioStartDate Portfolio start date for inflation calculations
 * @returns The total current value of the portfolio
 */
export function getCurrentPortfolioValue(
  transactionStore: { filter: (investmentId: string) => Transaction[] },
  investments: Investment[],
  asOfDate: Date = new Date(),
  inflationRate = 0,
  portfolioStartDate?: string,
): number {
  let totalValue = 0

  for (const investment of investments) {
    const transactions = transactionStore.filter(investment.id)
    if (transactions.length === 0) {
      continue // Skip investments with no transactions
    }

    const baseData = getBaseData(transactions, inflationRate, portfolioStartDate)
    const currentValue = getCurrentInvestmentValue(baseData, investment, asOfDate)
    totalValue += currentValue
  }

  return totalValue
}
