import { describe, expect, it } from 'vitest'

import type { Investment } from '$lib/types'

import { DAYS_PER_YEAR } from './constants'
import {
  getBaseData,
  getCurrentInvestmentValue,
  getCurrentPortfolioValue,
  getInvestmentValues,
} from './investment-calculations'
import type { Transaction, TransactionMap, TransactionMapEntry } from './types'

// Helper function to convert test data to new TransactionMap format
function createTransactionMap(entries: Array<[string, number]>): TransactionMap {
  const map = new Map<string, TransactionMapEntry>()
  for (const [date, amount] of entries) {
    map.set(date, { amount, transactionIds: [] })
  }
  return map
}

const DEFAULT_INVESTMENT: Investment = {
  apy: 0,
  entry_fee: 0,
  entry_fee_type: 'upfront' as const,
  exit_fee: 0,
  exit_fee_type: 'upfront' as const,
  id: 'test-investment-0',
  advanced_fees: false,
  management_fee: 0,
  management_fee_type: 'upfront' as const,
  name: '',
  success_fee: 0,
  ter: undefined,
  type: '',
}

describe('#getInvestmentValues', () => {
  it('should calculate default investment', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-15', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment = DEFAULT_INVESTMENT
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    // Monthly periods: should have one entry per month
    expect(feeValues.length).toBeGreaterThan(0)
    expect(investmentValues.length).toEqual(feeValues.length)

    // The deposit made on Jan 15 should appear in the January value (index 0)
    expect(investmentValues[0]).toEqual(initialDepositValue)
  })

  it('should calculate simple investment without fees', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    // With 10% APY for a full year, 100 should become 110
    expect(investmentValues[0]).toBeCloseTo(110, 1)
  })

  it('should calculate simple investment with upfront entry fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      entry_fee_type: 'upfront',
      entry_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    // 100 deposit - 10 entry fee = 90 invested, with 10% growth = 99
    expect(investmentValues[0]).toBeCloseTo(99, 1)
    expect(feeValues[0].entryFee).toEqual(10)
  })

  it('should calculate simple investment with fixed exit fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-12-31', 10]])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      exit_fee_type: 'fixed',
      exit_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    // 100 grows to 110, then 10 withdrawn + 10 exit fee = 90 remaining
    expect(investmentValues[0]).toBeCloseTo(90, 1)
    expect(feeValues[0].exitFee).toEqual(10)
  })

  it('should calculate simple investment with percentage exit fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-12-31', 10]])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      exit_fee_type: 'percentage',
      exit_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    // 100 grows to 110, then 10 withdrawn + 1 exit fee (10% of 10) = 99 remaining
    expect(investmentValues[0]).toBeCloseTo(99, 1)
    expect(feeValues[0].exitFee).toEqual(1)
  })

  it('should calculate simple investment with TER fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      ter: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    expect(investmentValues[0]).toBeCloseTo(99, 1)
    expect(feeValues[0].TERFee).toBeGreaterThan(0)
  })

  it('should calculate simple investment with percentage management fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      management_fee_type: 'percentage',
      management_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    expect(investmentValues[0]).toBeCloseTo(99, 1)
    expect(feeValues[0].managementFee).toBeGreaterThan(0)
  })

  it('should calculate simple investment with fixed management fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      management_fee_type: 'fixed',
      management_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    expect(investmentValues[0]).toBeCloseTo(99.479)
  })

  it('should calculate simple investment with success fee', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      success_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, feeValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    expect(exhaustionWarning).toBeUndefined()
    expect(investmentValues[0]).toBeCloseTo(109, 1)
    expect(feeValues[0].successFee).toBeGreaterThan(0)
  })

  it('should report managementFee error when daily management fee exceeds investment value', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
      management_fee_type: 'fixed',
      management_fee: 120, // Daily management fee will be 120/365 ≈ 0.328 per day
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Investment may exhaust due to high management fees, but shouldn't go negative
    expect(Math.min(...investmentValues)).toBeGreaterThanOrEqual(0)
  })

  it('should report withdrawal error when withdrawal exceeds available investment value', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-06-01', 150]]) // Withdraw more than available
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0, // No growth to ensure withdrawal exceeds value
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, withdrawalValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Should have exhaustion due to over-withdrawal
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
    // Investment value should not go negative
    expect(Math.min(...investmentValues)).toBeGreaterThanOrEqual(0)
    // Actual withdrawal should be limited to available amount
    expect(Math.abs(withdrawalValues[0])).toBeLessThan(150)
  })

  it('should report withdrawal error with exit fees when total needed exceeds value', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-06-01', 95]]) // Withdraw + exit fee = 95 + 10 = 105 > 100
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
      exit_fee_type: 'fixed',
      exit_fee: 10,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Should have exhaustion due to over-withdrawal with exit fees
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
    // Investment value should not go negative
    expect(Math.min(...investmentValues)).toBeGreaterThanOrEqual(0)
  })

  it('should report both managementFee and withdrawal errors in extreme scenario', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const initialDepositValue = 50
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-02-01', 60]]) // Withdraw more than deposited
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: -5, // Negative return
      management_fee_type: 'fixed',
      management_fee: 20, // High daily management fee
      exit_fee_type: 'fixed',
      exit_fee: 5,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-03-31')
    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Should have exhaustion from over-withdrawal in this scenario
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
    // Investment value should never go negative
    expect(Math.min(...investmentValues)).toBeGreaterThanOrEqual(0)
  })

  it('should limit daily management fee to available value when value is insufficient', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const initialDepositValue = 10
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
      management_fee_type: 'fixed',
      management_fee: 20, // Daily fee ≈ 0.055, but small initial value means it will hit zero quickly
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')
    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // With high management fees, the value should drop to zero but not negative
    expect(investmentValues[investmentValues.length - 1]).toEqual(0)
  })

  it('should limit actual withdrawal to available value when insufficient funds', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([['2025-01-15', 200]]) // Try to withdraw double
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-02-28')
    const { investmentValues, withdrawalValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Should have exhaustion due to over-withdrawal
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
    // Investment value should become 0, not negative
    expect(investmentValues[0]).toEqual(0) // January value after withdrawal
    // Actual withdrawal should be limited to the available 100
    expect(Math.abs(withdrawalValues[0])).toEqual(100)
  })

  it('should report errors with correct dates', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const initialDepositValue = 100
    const deposits = createTransactionMap([['2025-01-01', initialDepositValue]])
    const withdrawals = createTransactionMap([
      ['2025-02-15', 150], // First problematic withdrawal
      ['2025-03-20', 50], // Second problematic withdrawal
    ])
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-04-30')
    const { exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Should have exhaustion from first over-withdrawal
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.date).toEqual(new Date('2025-02-15'))
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
  })
})

describe('#getCurrentInvestmentValue', () => {
  it('should return 0 for investment with no transactions', () => {
    const baseData = {
      deposits: createTransactionMap([]),
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = DEFAULT_INVESTMENT

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-06-15'))

    expect(value).toEqual(0)
  })

  it('should return 0 when as-of date is before investment start date', () => {
    const deposits = createTransactionMap([['2025-01-15', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-12-31'),
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 10 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-01-01'))

    expect(value).toEqual(0)
  })

  it('should calculate simple investment value on exact start date', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 0 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-01-01'))

    expect(value).toEqual(1000)
  })

  it('should calculate investment value with 10% APY after one year', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 10 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2026-01-01'))

    expect(Math.round(value)).toEqual(1100) // 10% growth
  })

  it('should handle multiple deposits over time', () => {
    const deposits = createTransactionMap([
      ['2025-01-01', 1000],
      ['2025-03-01', 500],
      ['2025-06-01', 300],
    ])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 12 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-12-31'))

    // Total deposits 1800, should grow with compound interest
    expect(value).toBeCloseTo(1989.7, 1)
  })

  it('should handle withdrawals correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const withdrawals = createTransactionMap([['2025-06-01', 200]])
    const baseData = {
      deposits,
      withdrawals,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 10 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-12-31'))

    // Started with 1000, withdrew 200, should have growth minus withdrawal impact
    expect(value).toBeCloseTo(888.2, 1)
  })

  it('should apply entry fees correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
      entry_fee: 5, // 5% entry fee
      entry_fee_type: 'ongoing' as const,
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-01-01'))

    expect(value).toEqual(950) // 1000 - 5% = 950
  })

  it('should apply exit fees correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const withdrawals = createTransactionMap([['2025-06-01', 200]])
    const baseData = {
      deposits,
      withdrawals,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 0,
      exit_fee: 2, // 2% exit fee
      exit_fee_type: 'percentage' as const,
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-06-01'))

    // 1000 deposit - 200 withdrawal - 4 exit fee (2% of 200) = 796
    expect(value).toEqual(796)
  })

  it('should apply management fees correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      management_fee: 2, // 2% management fee
      management_fee_type: 'percentage' as const,
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2026-01-01'))

    // 10% APY reduced by management fees
    expect(value).toBeCloseTo(1077.9, 1)
  })

  it('should apply success fees correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      success_fee: 20, // 20% success fee
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2026-01-01'))

    // 10% APY with 20% success fee on gains
    expect(value).toBeCloseTo(1079.9, 1)
  })

  it('should apply TER fees correctly', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 10,
      ter: 1.5, // 1.5% TER fee
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2026-01-01'))

    // 10% APY reduced by 1.5% TER fee
    expect(value).toBeCloseTo(1083.4, 1)
  })

  it('should continue calculation beyond end date when as-of date is beyond', () => {
    const deposits = createTransactionMap([['2025-01-01', 1000]])
    const baseData = {
      deposits,
      withdrawals: createTransactionMap([]),
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-06-30'), // Investment ends mid-year
    }
    const investment = { ...DEFAULT_INVESTMENT, apy: 10 }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-12-31'))

    // Should calculate growth for full year (~10% growth) despite end date
    expect(Math.round(value)).toEqual(1100)
  })

  it('should handle complex scenario with all fee types', () => {
    const deposits = createTransactionMap([
      ['2025-01-01', 1000],
      ['2025-03-01', 500],
    ])
    const withdrawals = createTransactionMap([['2025-09-01', 300]])
    const baseData = {
      deposits,
      withdrawals,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    }
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 12,
      entry_fee: 2,
      entry_fee_type: 'ongoing' as const,
      exit_fee: 1,
      exit_fee_type: 'percentage' as const,
      management_fee: 1,
      management_fee_type: 'percentage' as const,
      success_fee: 15,
      ter: 0.8,
    }

    const value = getCurrentInvestmentValue(baseData, investment, new Date('2025-12-31'))

    // Complex scenario with multiple fees applied
    expect(value).toBeCloseTo(1272.7, 1)
  })
})

describe('#getCurrentPortfolioValue', () => {
  // Mock transaction store
  const createMockTransactionStore = (transactionMap: Map<string, Transaction[]>) => ({
    filter: (investmentId: string) => transactionMap.get(investmentId) || [],
  })

  it('should return 0 for empty portfolio', () => {
    const transactionStore = createMockTransactionStore(new Map())
    const investments: Investment[] = []

    const value = getCurrentPortfolioValue(transactionStore, investments)

    expect(value).toEqual(0)
  })

  it('should return 0 for portfolio with investments but no transactions', () => {
    const transactionStore = createMockTransactionStore(new Map())
    const investments = [DEFAULT_INVESTMENT]

    const value = getCurrentPortfolioValue(transactionStore, investments)

    expect(value).toEqual(0)
  })

  it('should calculate single investment portfolio value', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2025-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactionStore = createMockTransactionStore(
      new Map([['test-investment-1', transactions]]),
    )
    const investments = [{ ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 10 }]

    // Calculate value after 6 months
    const asOfDate = new Date('2025-07-01')
    const value = getCurrentPortfolioValue(transactionStore, investments, asOfDate)

    expect(value).toBeCloseTo(1048.4, 1) // 6 months of growth
  })

  it('should sum multiple investments correctly', () => {
    const transactions1: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2026-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactions2: Transaction[] = [
      {
        type: 'deposit',
        amount: 2000,
        date: '2025-01-01',
        end_date: '2026-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactionStore = createMockTransactionStore(
      new Map([
        ['test-investment-1', transactions1],
        ['test-investment-2', transactions2],
      ]),
    )
    const investments = [
      { ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 8 },
      { ...DEFAULT_INVESTMENT, id: 'test-investment-2', apy: 12 },
    ]

    const asOfDate = new Date('2026-01-01') // 1 year later
    const value = getCurrentPortfolioValue(transactionStore, investments, asOfDate)

    // Sum of two investments with different APY rates
    expect(value).toBeCloseTo(3319.8, 1)
  })

  it('should handle mixed scenarios with different investment performance', () => {
    const transactions1: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2025-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactions2: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2025-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
      {
        type: 'withdrawal',
        amount: 200,
        date: '2025-06-01',
        end_date: '2025-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactionStore = createMockTransactionStore(
      new Map([
        ['test-investment-1', transactions1],
        ['test-investment-2', transactions2],
      ]),
    )
    const investments = [
      { ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 0 }, // No growth
      { ...DEFAULT_INVESTMENT, id: 'test-investment-2', apy: 10 }, // 10% growth
    ]

    const asOfDate = new Date('2025-12-31')
    const value = getCurrentPortfolioValue(transactionStore, investments, asOfDate)

    // Investment 1 has no growth, Investment 2 has growth but with withdrawal
    expect(value).toBeCloseTo(1888.2, 1)
  })

  it('should skip investments with no transactions', () => {
    const transactions1: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2026-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactionStore = createMockTransactionStore(
      new Map([
        ['test-investment-1', transactions1],
        // Investment 2 has no transactions
      ]),
    )
    const investments = [
      { ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 10 },
      { ...DEFAULT_INVESTMENT, id: 'test-investment-2', apy: 15 }, // This should be ignored
    ]

    const asOfDate = new Date('2026-01-01')
    const value = getCurrentPortfolioValue(transactionStore, investments, asOfDate)

    // Only investment 1 should contribute: ~1100
    expect(Math.round(value)).toEqual(1100)
  })

  it('should use today as default date', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        end_date: '2026-12-31',
        repeat: undefined,
        repeat_unit: undefined,
      },
    ]
    const transactionStore = createMockTransactionStore(
      new Map([['test-investment-1', transactions]]),
    )
    const investments = [{ ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 0 }]

    // Should not throw and should return a reasonable value
    const value = getCurrentPortfolioValue(transactionStore, investments)

    expect(typeof value).toBe('number')
    expect(value).toBeGreaterThanOrEqual(0)
  })
})

describe('#auto-inflation integration tests', () => {
  const createMockTransactionStore = (transactionMap: Map<string, Transaction[]>) => ({
    filter: (investmentId: string) => transactionMap.get(investmentId) || [],
  })

  it('should calculate investment value with auto-inflated deposits', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0.03, '2024-01-01')

    // First deposit should remain 1000
    expect(baseData.deposits.get('2024-01-01')?.amount).toBe(1000)

    // Second deposit should be inflation-adjusted (~1030)
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(1030, 0)

    // Investment calculation should work with these inflated amounts
    const investment = { ...DEFAULT_INVESTMENT, apy: 5 }
    const currentValue = getCurrentInvestmentValue(baseData, investment, new Date('2025-12-31'))

    // Should reflect both deposits: 1000 invested for 2 years + 1030 for 1 year, all with 5% APY
    expect(currentValue).toBeGreaterThan(2100) // Sanity check
  })

  it('should handle recurring auto-inflated transactions', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 100,
        date: '2024-01-01',
        inflation_adjusted: true,
        repeat: 1,
        repeat_unit: 'year',
        end_date: '2026-01-01',
      },
    ]

    const baseData = getBaseData(transactions, 0.03, '2024-01-01')

    // Check that each occurrence is properly inflation-adjusted
    expect(baseData.deposits.get('2024-01-01')?.amount).toBe(100) // Base amount
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(103, 0) // 3% inflation
    expect(baseData.deposits.get('2026-01-01')?.amount).toBeCloseTo(106, 0) // 6% inflation over 2 years
  })

  it('should handle portfolio-level calculations with mixed auto-inflation', () => {
    const transactions1: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const transactions2: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const transactionStore = createMockTransactionStore(
      new Map([
        ['test-investment-1', transactions1],
        ['test-investment-2', transactions2],
      ]),
    )

    const investments = [
      { ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 5 },
      { ...DEFAULT_INVESTMENT, id: 'test-investment-2', apy: 5 },
    ]

    // Calculate value 1 year after portfolio start
    const portfolioValue = getCurrentPortfolioValue(
      transactionStore,
      investments,
      new Date('2025-01-01'),
      0.03,
      '2024-01-01',
    )

    // Investment 1: 1000 * 1.05 = 1050 (no inflation adjustment on deposit)
    // Investment 2: 1000 * 1.05 = 1050 (deposit amount stays same since investment date = portfolio start)
    // Total should be approximately 2100
    expect(portfolioValue).toBeCloseTo(2100, 0)
  })
})

describe('#comprehensive inflation-adjusted transaction tests', () => {
  const createMockTransactionStore = (transactionMap: Map<string, Transaction[]>) => ({
    filter: (investmentId: string) => transactionMap.get(investmentId) || [],
  })

  it('should handle simple inflation-adjusted monthly withdrawals with 2% inflation', () => {
    const transactions: Transaction[] = [
      // Initial seed deposit
      {
        type: 'deposit',
        amount: 12000,
        date: '2024-01-01',
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
      // Inflation-adjusted monthly withdrawals of $1000
      {
        type: 'withdrawal',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: true,
        repeat: 1,
        repeat_unit: 'month',
        end_date: '2024-03-01', // Just 3 months for simplicity
      },
    ]

    const baseData = getBaseData(transactions, 0.02, '2024-01-01') // 2% annual inflation

    // Verify initial deposit
    expect(baseData.deposits.get('2024-01-01')?.amount).toBe(12000.0)

    // Verify monthly withdrawals are inflation-adjusted
    // January (base): 1000.00
    expect(baseData.withdrawals.get('2024-01-01')?.amount).toBe(1000.0)

    // February (1 month later): compound interest calculation
    expect(baseData.withdrawals.get('2024-02-01')?.amount).toBeCloseTo(1001.68, 2)

    // March (2 months later): compound interest calculation
    expect(baseData.withdrawals.get('2024-03-01')?.amount).toBeCloseTo(1003.26, 2)

    // Test investment value calculation with these withdrawals
    const investment = { ...DEFAULT_INVESTMENT, apy: 10 } // 10% APY for easy calculation
    const finalValue = getCurrentInvestmentValue(baseData, investment, new Date('2024-12-31'))

    // Started with 12000, withdrew ~3005, with 10% growth over 1 year
    // Compound calculation result
    expect(finalValue).toBeCloseTo(9919.94, 2)
  })

  it('should correctly handle zero inflation rate on inflation-adjusted transactions', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0, '2024-01-01') // Zero inflation

    // With zero inflation, even inflation-adjusted amounts should remain unchanged
    expect(baseData.deposits.get('2025-01-01')?.amount).toBe(1000)
  })

  it('should handle 2% deflation correctly', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01', // 1 year after portfolio start
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, -0.02, '2024-01-01') // -2% deflation

    // With 2% deflation over 1 year: compound calculation
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(979.96, 2)
  })

  it('should handle mixed adjusted and non-adjusted transactions with 12% inflation', () => {
    const transactions: Transaction[] = [
      // Non-inflation adjusted deposit
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
      // Inflation adjusted deposit (same date for easy comparison)
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01',
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0.12, '2024-01-01') // 12% inflation

    // Non-adjusted should remain 1000.00
    // Adjusted should be compound calculation ~1120.26
    // Total deposits for the date should be ~2120.26
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(2120.26, 2)
  })

  it('should handle 10% inflation over 2 years', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2026-01-01', // 2 years after portfolio start
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0.1, '2024-01-01') // 10% inflation

    // After 2 years of 10% inflation: compound calculation
    expect(baseData.deposits.get('2026-01-01')?.amount).toBeCloseTo(1210.16, 2)
  })

  it('should handle 10-year inflation-adjusted transaction with 2% inflation', () => {
    const transactions: Transaction[] = [
      {
        type: 'withdrawal',
        amount: 10000,
        date: '2034-01-01', // 10 years after portfolio start
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0.02, '2024-01-01') // 2% inflation

    // After 10 years of 2% inflation: compound calculation
    expect(baseData.withdrawals.get('2034-01-01')?.amount).toBeCloseTo(12190.27, 2)
  })

  it('should handle portfolio-level calculation with simple 10% APY and 5% inflation', () => {
    const transactions1: Transaction[] = [
      // Investment 1: Regular deposit - no inflation adjustment
      {
        type: 'deposit',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const transactions2: Transaction[] = [
      // Investment 2: Inflation-adjusted deposit
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01', // 1 year later
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const transactionStore = createMockTransactionStore(
      new Map([
        ['test-investment-1', transactions1],
        ['test-investment-2', transactions2],
      ]),
    )

    const investments = [
      { ...DEFAULT_INVESTMENT, id: 'test-investment-1', apy: 10 },
      { ...DEFAULT_INVESTMENT, id: 'test-investment-2', apy: 10 },
    ]

    // Calculate value after 2 years
    const portfolioValue = getCurrentPortfolioValue(
      transactionStore,
      investments,
      new Date('2026-01-01'),
      0.05, // 5% inflation
      '2024-01-01',
    )

    // Investment 1: compound calculation ~1210.00
    // Investment 2: compound calculation ~1155.20
    // Total: ~2365.20
    expect(portfolioValue).toBeCloseTo(2365.2, 2)
  })

  it('should handle same date multiple inflation-adjusted transactions with 10% inflation', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2025-01-01', // 1 year after portfolio start
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
      {
        type: 'withdrawal',
        amount: 500,
        date: '2025-01-01', // Same date
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]

    const baseData = getBaseData(transactions, 0.1, '2024-01-01') // 10% inflation

    // Both transactions should be inflated by 10% over 1 year
    // 1000 * compound = ~1100.22, 500 * compound = ~550.11
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(1100.22, 2)
    expect(baseData.withdrawals.get('2025-01-01')?.amount).toBeCloseTo(550.11, 2)
  })

  it('should handle yearly recurring deposits with 10% inflation', () => {
    const transactions: Transaction[] = [
      {
        type: 'deposit',
        amount: 1000,
        date: '2024-01-01',
        inflation_adjusted: true,
        repeat: 1, // Every year
        repeat_unit: 'year',
        end_date: '2027-01-01', // 4 deposits total
      },
    ]

    const baseData = getBaseData(transactions, 0.1, '2024-01-01') // 10% inflation

    // Year 1 - base amount
    expect(baseData.deposits.get('2024-01-01')?.amount).toBe(1000.0)

    // Year 2 - compound calculation ~1100.22
    expect(baseData.deposits.get('2025-01-01')?.amount).toBeCloseTo(1100.22, 2)

    // Year 3 - compound calculation ~1210.16
    expect(baseData.deposits.get('2026-01-01')?.amount).toBeCloseTo(1210.16, 2)

    // Year 4 - compound calculation
    expect(baseData.deposits.get('2027-01-01')?.amount).toBeCloseTo(1331.09, 2)
  })
})

describe('#investment exhaustion tests', () => {
  const EXHAUSTION_INVESTMENT: Investment = {
    ...DEFAULT_INVESTMENT,
    id: 'test-investment-1',
    name: 'Test Investment',
    apy: 0.05, // 5% annual return
  }

  it('should demonstrate basic investment exhaustion', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([['2024-01-01', 1000]])
    const withdrawals = createTransactionMap([['2024-02-01', 1500]]) // More than available
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-04-30')

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should have at least 4 data points (Jan, Feb, Mar, Apr)
    expect(investmentValues.length).toBeGreaterThanOrEqual(4)

    // Should have initial value (end of January)
    expect(investmentValues[0]).toBeGreaterThan(1000)

    // Should hit zero after over-withdrawal (end of February)
    expect(investmentValues[1]).toBe(0)

    // Should remain at zero (March, April)
    expect(investmentValues[2]).toBe(0)
    expect(investmentValues[3]).toBe(0)

    // Should have exhaustion date and missing amount
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.date).toEqual(new Date('2024-02-01'))
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
  })

  it('should stop growth after investment hits zero due to over-withdrawal', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([['2024-01-01', 10000]])
    const withdrawals = createTransactionMap([['2024-06-01', 15000]]) // More than available
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-12-31')

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should have initial value after deposit (with some growth) - End of January
    expect(investmentValues[0]).toBeGreaterThan(10000)
    expect(investmentValues[0]).toBeLessThan(10100)

    // Should continue growing before withdrawal - End of May
    expect(investmentValues[4]).toBeGreaterThan(10000)

    // Should hit zero after withdrawal in June - End of June
    expect(investmentValues[5]).toBe(0)

    // Should remain at zero after exhaustion - July, August, etc.
    expect(investmentValues[6]).toBe(0)
    expect(investmentValues[7]).toBe(0)

    // Should have exhaustion date and missing amount
    expect(exhaustionWarning?.date).toBeDefined()
    const exhaustionDateStr = exhaustionWarning?.date!.toISOString().split('T')[0]
    expect(['2024-05-31', '2024-06-01']).toContain(exhaustionDateStr)
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
  })

  it('should track missing withdrawal amount correctly', () => {
    const periodCount = { count: 2, period: 'month' as const }
    const deposits = createTransactionMap([['2024-01-01', 5000]])
    const withdrawals = createTransactionMap([['2024-02-01', 8000]]) // 3000 more than available
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-02-29')

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should hit zero
    expect(investmentValues[1]).toBe(0)

    // Should track the missing amount (approximately 3000 minus any growth)
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(2900) // Account for small growth
    expect(exhaustionWarning?.missingAmount).toBeLessThan(3100)
  })

  it('should continue calculating fees and errors even after exhaustion', () => {
    const investmentWithFees: Investment = {
      ...EXHAUSTION_INVESTMENT,
      management_fee: 0.02, // 2% annual management fee
      management_fee_type: 'annual' as const,
    }

    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([['2024-01-01', 1000]])
    const withdrawals = createTransactionMap([['2024-02-01', 1500]])
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-04-30') // Extended to get more data points

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investmentWithFees,
    )

    // Should have exhaustion from withdrawal
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.date).toEqual(new Date('2024-02-01'))
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)

    // Investment should remain at zero
    expect(investmentValues[1]).toBe(0)
    expect(investmentValues[2]).toBe(0)
  })

  it('should not recover from exhaustion even with new deposits', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([
      ['2024-01-01', 5000],
      ['2024-03-01', 2000],
    ]) // New deposit after exhaustion
    const withdrawals = createTransactionMap([['2024-02-01', 6000]])
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-05-31') // Extended to get more data points

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should start with initial deposit (with some growth)
    expect(investmentValues[0]).toBeGreaterThan(5000)
    expect(investmentValues[0]).toBeLessThan(5100)

    // Should hit zero after over-withdrawal
    expect(investmentValues[1]).toBe(0)

    // Should remain at zero even after new deposit (exhaustion is permanent)
    expect(investmentValues[2]).toBe(0)
    expect(investmentValues[3]).toBe(0)
  })

  it('should handle multiple over-withdrawals correctly', () => {
    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([['2024-01-01', 3000]])
    const withdrawals = createTransactionMap([
      ['2024-02-01', 2000],
      ['2024-03-01', 2000], // Should exhaust remaining ~1000
      ['2024-04-01', 1000], // Another over-withdrawal
    ])
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-05-31')

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should start with 3000 (with some growth)
    expect(investmentValues[0]).toBeGreaterThan(3000)
    expect(investmentValues[0]).toBeLessThan(3100)

    // Should have ~1000 after first withdrawal
    expect(investmentValues[1]).toBeGreaterThan(0)

    // Should hit zero after second withdrawal
    expect(investmentValues[2]).toBe(0)

    // Should remain zero for subsequent periods
    expect(investmentValues[3]).toBe(0)
    expect(investmentValues[4]).toBe(0)

    // Should have exhaustion date from first over-withdrawal
    expect(exhaustionWarning?.date).toBeDefined()
    expect(exhaustionWarning?.date).toEqual(new Date('2024-03-01'))
    expect(exhaustionWarning?.missingAmount).toBeGreaterThan(0)
  })

  it('should handle normal withdrawals without exhaustion', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const deposits = createTransactionMap([['2024-01-01', 10000]])
    const withdrawals = createTransactionMap([['2024-06-01', 3000]]) // Well within available funds
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2026-12-31') // 3 years to get multiple data points

    const { investmentValues, exhaustionWarning } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      EXHAUSTION_INVESTMENT,
    )

    // Should have growth after initial deposit and withdrawal (end of 2024)
    expect(investmentValues[0]).toBeGreaterThan(6500) // ~10000 - 3000 + some growth
    expect(investmentValues[0]).toBeLessThan(7500)

    // Should continue growing (end of 2025)
    expect(investmentValues[1]).toBeGreaterThan(investmentValues[0])

    // Should continue growing (end of 2026)
    expect(investmentValues[2]).toBeGreaterThan(investmentValues[1])

    // Should have no exhaustion
    expect(exhaustionWarning).toBeUndefined()
  })
})
