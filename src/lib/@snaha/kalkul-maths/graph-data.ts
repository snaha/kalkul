import { differenceInDays, differenceInYears } from 'date-fns'
import Decimal from 'decimal.js'

import { type Investment, type Portfolio, type PortfolioNested } from '$lib/types'

import { DAYS_PER_YEAR, DECIMAL_1, MONTHS_PER_YEAR } from './constants'
import type { FeeBreakdown } from './investment-calculations'
import { getBaseData, getInvestmentValues } from './investment-calculations'
import {
  type GraphData,
  type InvestmentData,
  type PortfolioPeriod,
  type PortfolioPeriodCount,
  type TransactionMapEntry,
} from './types'

Decimal.set({ precision: 30 })

export function generateGraphDateLabels(
  start: Date,
  end: Date,
  period: PortfolioPeriod,
  count = 1,
) {
  const res = []
  if (period === 'year') {
    // For yearly periods, generate labels based on calendar years
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()
    for (let year = startYear; year <= endYear; year += count) {
      res.push(year.toString())
    }
  } else if (period === 'month') {
    // For monthly periods, generate labels based on calendar months
    const startYear = start.getFullYear()
    const startMonth = start.getMonth()
    const endYear = end.getFullYear()
    const endMonth = end.getMonth()

    let currentYear = startYear
    let currentMonth = startMonth

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      res.push(`${currentYear}-${currentMonth + 1}`)
      currentMonth += count
      if (currentMonth > 11) {
        currentYear += Math.floor(currentMonth / 12)
        currentMonth = currentMonth % 12
      }
    }
  }
  return res
}

export function getSamplingPeriodCount(startDate: Date, endDate: Date): PortfolioPeriodCount {
  const years = differenceInYears(endDate, startDate)
  if (years < 5) return { period: 'month', count: 1 }

  return { period: 'year', count: 1 }
}

function getTotalFeeValue(fees: FeeBreakdown) {
  return fees.entryFee + fees.exitFee + fees.successFee + fees.managementFee + fees.TERFee
}

/**
 * Generates record dates aligned with calendar period ends (year-end or month-end).
 * These dates correspond to when investment value snapshots are taken.
 *
 * @param startDate - Portfolio start date
 * @param endDate - Portfolio end date
 * @param period - Sampling period (year or month)
 * @param count - Number of periods to skip between samples
 * @returns Array of record dates for value snapshots
 */
function generateRecordDates(
  startDate: Date,
  endDate: Date,
  period: PortfolioPeriod,
  count: number,
): Date[] {
  const recordDates: Date[] = []
  if (period === 'year') {
    let rd = new Date(startDate.getFullYear(), MONTHS_PER_YEAR - 1, 31)
    while (rd <= endDate) {
      recordDates.push(rd)
      const nextYear = rd.getFullYear() + count
      rd = new Date(nextYear, MONTHS_PER_YEAR - 1, 31)
    }
  } else {
    let rd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    while (rd <= endDate) {
      recordDates.push(rd)
      let nextMonth = rd.getMonth() + count
      let nextYear = rd.getFullYear()
      while (nextMonth > 11) {
        nextYear += 1
        nextMonth -= MONTHS_PER_YEAR
      }
      rd = new Date(nextYear, nextMonth + 1, 0)
    }
  }
  return recordDates
}

/**
 * Calculates period boundaries (start and end dates) for a given record date.
 *
 * @param recordDate - The end date of the period
 * @param period - Sampling period (year or month)
 * @returns Object with periodStart and periodEnd dates
 */
function getPeriodBoundaries(
  recordDate: Date,
  period: PortfolioPeriod,
): { periodStart: Date; periodEnd: Date } {
  if (period === 'year') {
    return {
      periodStart: new Date(recordDate.getFullYear(), 0, 1),
      periodEnd: new Date(recordDate.getFullYear(), MONTHS_PER_YEAR - 1, 31),
    }
  } else {
    return {
      periodStart: new Date(recordDate.getFullYear(), recordDate.getMonth(), 1),
      periodEnd: new Date(recordDate.getFullYear(), recordDate.getMonth() + 1, 0),
    }
  }
}

/**
 * Calculates inflation-adjusted sum of transactions within a period.
 * Converts nominal amounts to real values at baseline date.
 *
 * @param transactionEntries - Array of [date, TransactionMapEntry] transaction entries
 * @param periodStart - Start date of the period
 * @param periodEnd - End date of the period
 * @param startDate - Baseline date for inflation adjustment
 * @param inflationRate - Annual inflation rate
 * @returns Sum of inflation-adjusted transaction amounts
 */
function calculateInflationAdjustedSum(
  transactionEntries: Array<[string, TransactionMapEntry]>,
  periodStart: Date,
  periodEnd: Date,
  startDate: Date,
  inflationRate: number,
  exhaustionDate?: Date,
): number {
  let sum = 0
  for (const [date, entry] of transactionEntries) {
    const d = new Date(date)
    // Skip transactions after exhaustion date (but include the transaction that causes exhaustion)
    if (exhaustionDate && d > exhaustionDate) {
      continue
    }
    if (d >= periodStart && d <= periodEnd) {
      const yearsAtEvent = differenceInDays(d, startDate) / DAYS_PER_YEAR
      const inflationAtEvent = DECIMAL_1.add(inflationRate).pow(yearsAtEvent)
      sum += new Decimal(entry.amount).div(inflationAtEvent).toNumber()
    }
  }
  return sum
}

export function getGraphData(
  { deposits, withdrawals, startDate, endDate }: InvestmentData,
  investment: Investment,
  portfolio: Portfolio,
): GraphData {
  const { period, count } = getSamplingPeriodCount(startDate, endDate)

  const graphLabels = generateGraphDateLabels(startDate, endDate, period, count)

  const {
    investmentValues: graphInvestmentValues,
    feeValues: fees,
    withdrawalValues: graphWithdrawals,
    depositValues: graphDeposits,
    exhaustionWarning,
  } = getInvestmentValues(
    { period, count },
    { deposits, withdrawals, startDate, endDate },
    investment,
  )

  const graphFeeValues = fees.map((fee) => -getTotalFeeValue(fee))

  // Build record dates aligned with getInvestmentValues snapshots (calendar period ends)
  const recordDates = generateRecordDates(startDate, endDate, period, count)

  // Calculate inflation-adjusted values alongside nominal values for optimal performance
  const graphInflationDeposits: number[] = []
  const graphInflationWithdrawals: number[] = []
  const graphInflationInvestmentValues: number[] = []
  const graphInflationFeeValues: number[] = []

  const depositEntries = Array.from(deposits.entries())
  const withdrawalEntries = Array.from(withdrawals.entries())

  for (let i = 0; i < graphLabels.length; i++) {
    const rd = recordDates[i] ?? endDate
    const years = differenceInDays(rd, startDate) / DAYS_PER_YEAR
    const inflationAtRecord = DECIMAL_1.add(portfolio.inflation_rate).pow(years)

    // Calculate period boundaries for deposits/withdrawals
    const { periodStart, periodEnd } = getPeriodBoundaries(rd, period)

    // Process deposits for this period (convert to real terms using baseline date)
    const depSum = calculateInflationAdjustedSum(
      depositEntries,
      periodStart,
      periodEnd,
      startDate,
      portfolio.inflation_rate,
      exhaustionWarning?.date,
    )

    // Process withdrawals for this period (convert to real terms using baseline date)
    const wdSum = calculateInflationAdjustedSum(
      withdrawalEntries,
      periodStart,
      periodEnd,
      startDate,
      portfolio.inflation_rate,
      exhaustionWarning?.date,
    )

    // Store both nominal and inflation-adjusted values
    graphInflationDeposits.push(depSum)
    graphInflationWithdrawals.push(-wdSum) // Graph withdrawals are negative by convention

    // Convert investment values and fees to real terms at record date
    graphInflationInvestmentValues.push(
      new Decimal(graphInvestmentValues[i] ?? 0).div(inflationAtRecord).toNumber(),
    )
    graphInflationFeeValues.push(
      new Decimal(graphFeeValues[i] ?? 0).div(inflationAtRecord).toNumber(),
    )
  }

  return {
    label: investment.name,
    graphLabels,
    graphDeposits,
    graphWithdrawals,
    graphInvestmentValues,
    graphFeeValues,
    graphInflationDeposits,
    graphInflationWithdrawals,
    graphInflationInvestmentValues,
    graphInflationFeeValues,
    exhaustionWarning,
  }
}

/**
 * Aggregates multiple investment graph data into a portfolio total.
 * Sums all array values at each index and determines the earliest exhaustion date.
 *
 * @param data - Array of GraphData from individual investments
 * @returns Aggregated GraphData representing the portfolio total
 */
export function aggregateGraphData(data: GraphData[]): GraphData {
  if (data.length === 0) {
    throw new Error('Cannot aggregate empty data array')
  }

  // Initialize total from first investment
  const first = data[0]
  const total: GraphData = {
    label: 'Total',
    graphLabels: [...first.graphLabels],
    graphDeposits: [...first.graphDeposits],
    graphWithdrawals: [...first.graphWithdrawals],
    graphInvestmentValues: [...first.graphInvestmentValues],
    graphFeeValues: [...first.graphFeeValues],
    graphInflationDeposits: [...first.graphInflationDeposits],
    graphInflationWithdrawals: [...first.graphInflationWithdrawals],
    graphInflationInvestmentValues: [...first.graphInflationInvestmentValues],
    graphInflationFeeValues: [...first.graphInflationFeeValues],
    exhaustionWarning: first.exhaustionWarning,
  }

  // Aggregate remaining investments
  for (let i = 1; i < data.length; i++) {
    const investmentData = data[i]

    // Track earliest exhaustion date (if same date, keep first by order)
    if (investmentData.exhaustionWarning) {
      if (!total.exhaustionWarning) {
        total.exhaustionWarning = investmentData.exhaustionWarning
      } else if (investmentData.exhaustionWarning.date < total.exhaustionWarning.date) {
        total.exhaustionWarning = investmentData.exhaustionWarning
      }
      // If same date, keep the existing one (first by order)
    }

    // Sum all array values at each index
    for (let j = 0; j < total.graphLabels.length; j++) {
      total.graphDeposits[j] += investmentData.graphDeposits[j]
      total.graphWithdrawals[j] += investmentData.graphWithdrawals[j]
      total.graphInvestmentValues[j] += investmentData.graphInvestmentValues[j]
      total.graphFeeValues[j] += investmentData.graphFeeValues[j]

      total.graphInflationDeposits[j] += investmentData.graphInflationDeposits[j]
      total.graphInflationWithdrawals[j] += investmentData.graphInflationWithdrawals[j]
      total.graphInflationInvestmentValues[j] += investmentData.graphInflationInvestmentValues[j]
      total.graphInflationFeeValues[j] += investmentData.graphInflationFeeValues[j]
    }
  }

  return total
}

function getCumulativeSum(array: number[], index: number): number {
  return array.slice(0, index + 1).reduce((acc, val) => acc + val, 0)
}

export interface CumulativeValues {
  cumulativeDeposits: number
  cumulativeWithdrawals: number
  cumulativeFees: number
  currentValue: number
  cumulativeInterest: number
}

export function getCumulativeValues(
  graphData: GraphData,
  index: number,
  useInflation = false,
): CumulativeValues {
  const deposits = useInflation ? graphData.graphInflationDeposits : graphData.graphDeposits
  const withdrawals = useInflation
    ? graphData.graphInflationWithdrawals
    : graphData.graphWithdrawals
  const fees = useInflation ? graphData.graphInflationFeeValues : graphData.graphFeeValues
  const values = useInflation
    ? graphData.graphInflationInvestmentValues
    : graphData.graphInvestmentValues

  const cumulativeDeposits = getCumulativeSum(deposits, index)
  const cumulativeWithdrawals = getCumulativeSum(withdrawals, index)
  const cumulativeFees = getCumulativeSum(fees, index)
  const currentValue = values[index]

  let cumulativeInterest = 0
  for (let i = 0; i <= index; i++) {
    const valueChange = i === 0 ? values[i] : values[i] - values[i - 1]
    const periodDeposits = deposits[i] || 0
    const periodWithdrawals = withdrawals[i] || 0
    const periodFees = fees[i] || 0

    const periodInterest = valueChange - periodDeposits - periodWithdrawals - periodFees
    cumulativeInterest += periodInterest
  }

  return {
    cumulativeDeposits,
    cumulativeWithdrawals,
    cumulativeFees,
    currentValue,
    cumulativeInterest,
  }
}

function createHash(data: unknown): string {
  const dataToHash = JSON.stringify(data)

  let hash = 0
  for (let i = 0; i < dataToHash.length; i++) {
    const char = dataToHash.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36)
}

const portfolioDataCache = new Map<
  string,
  { data: GraphData[]; total: GraphData; timestamp: number }
>()

function getPortfolioCacheKey(portfolio: PortfolioNested): string {
  return createHash({
    investments: portfolio.investments,
    portfolio: portfolio,
  })
}

/**
 * Prepares base calculation data for each investment using its nested transactions
 * and computing initial date ranges and transaction maps.
 *
 * @param investments - Array of investments with nested transactions
 * @param portfolio - Portfolio configuration
 * @returns Array of base data with investment reference
 */
export function prepareInvestmentBaseData(
  portfolio: PortfolioNested,
): Array<{ baseData: ReturnType<typeof getBaseData>; investment: Investment }> {
  return portfolio.investments.map((i) => ({
    baseData: getBaseData(i.transactions, portfolio.inflation_rate, portfolio.start_date),
    investment: i,
  }))
}

/**
 * Calculates the overall date range from base data of multiple investments,
 * constrained by portfolio start/end dates.
 *
 * @param baseData - Array of base data from investments
 * @param portfolio - Portfolio configuration with start_date and end_date
 * @returns Object with startDate and endDate
 */
export function calculateDateRange(
  baseData: Array<{ baseData: ReturnType<typeof getBaseData> }>,
  portfolio: Portfolio,
): { startDate: Date; endDate: Date } {
  return baseData.reduce(
    (acc, i) => ({
      startDate: i.baseData.startDate < acc.startDate ? i.baseData.startDate : acc.startDate,
      endDate: i.baseData.endDate > acc.endDate ? i.baseData.endDate : acc.endDate,
    }),
    {
      startDate: new Date(portfolio.start_date),
      endDate: new Date(portfolio.end_date),
    },
  )
}

export function getGraphDataForPortfolio(portfolio: PortfolioNested): {
  total: GraphData
  data: GraphData[]
} {
  const cacheKey = getPortfolioCacheKey(portfolio)
  const now = Date.now()

  // Check cache and return if valid (cache for 5 minutes)
  const cached = portfolioDataCache.get(cacheKey)
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return { data: cached.data, total: cached.total }
  }

  const baseData = prepareInvestmentBaseData(portfolio)
  const { startDate, endDate } = calculateDateRange(baseData, portfolio)

  const data = baseData.map((d) =>
    getGraphData({ ...d.baseData, startDate, endDate }, d.investment, portfolio),
  )

  const total = aggregateGraphData(data)

  portfolioDataCache.set(cacheKey, { data, total, timestamp: now })

  return { data, total }
}
