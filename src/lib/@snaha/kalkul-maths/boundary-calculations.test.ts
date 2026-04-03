import { describe, expect, it } from 'vitest'

import type { Investment } from '$lib/types'

import { DAYS_PER_YEAR } from './constants'
import { getInvestmentValues } from './investment-calculations'
import type { TransactionMap, TransactionMapEntry } from './types'

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
  id: 'test-investment-1',
  advanced_fees: false,
  management_fee: 0,
  management_fee_type: 'upfront' as const,
  name: '',
  success_fee: 0,
  ter: undefined,
  type: '',
}

describe('Year boundary investment value calculation bug', () => {
  it('should fix the year boundary issue - values should be recorded at calendar year ends', () => {
    // The user's exact scenario: portfolio 2024-09-13 → 2049-09-13, deposit 2025-05-14
    // After fix: 2025 should show the deposit value, not 0

    const depositValue = 100000
    const deposits = createTransactionMap([['2025-05-14', depositValue]])
    const withdrawals = createTransactionMap([])
    const investment = DEFAULT_INVESTMENT
    const startDate = new Date('2024-09-13')
    const endDate = new Date('2049-09-13')

    const yearlyPeriod = { count: 1, period: 'year' as const }
    const { investmentValues } = getInvestmentValues(
      yearlyPeriod,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // After the fix, values should now be recorded at calendar year-ends:
    // - Index 0: value as of 2024-12-31 (0 - no deposits yet)
    // - Index 1: value as of 2025-12-31 (100k - deposit from 2025-05-14)
    // - Index 2: value as of 2026-12-31 (100k - no change)

    expect(investmentValues[0]).toEqual(0) // 2024-12-31: no deposits yet
    expect(investmentValues[1]).toEqual(depositValue) // 2025-12-31: deposit from 2025-05-14
    expect(investmentValues[2]).toEqual(depositValue) // 2026-12-31: still 100k
  })

  it('should calculate values correctly for year-end dates', () => {
    // Test with a deposit that should be included in the same year
    const periodCount = { count: 1, period: 'year' as const }
    const depositValue = 50000
    const deposits = createTransactionMap([['2025-12-31', depositValue]]) // End of year deposit
    const withdrawals = createTransactionMap([])
    const investment = DEFAULT_INVESTMENT
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2026-12-31')

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // A deposit on 2025-12-31 should be counted in 2025's value, not 2026's
    expect(investmentValues[1]).toEqual(depositValue) // Should be 50000 for year 2025
    expect(investmentValues[2]).toEqual(depositValue) // Should remain 50000 for year 2026
  })

  it('should handle deposits made mid-period with growth (precise values)', () => {
    const periodCount = { count: 1, period: 'year' as const }
    const depositValue = 100000
    const deposits = createTransactionMap([['2025-05-14', depositValue]])
    const withdrawals = createTransactionMap([])
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 5, // 5% APY to see growth
    }
    const startDate = new Date('2024-09-13')
    const endDate = new Date('2049-09-13')

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Index 0: 2024-12-31 - should be 0 (no deposits yet)
    expect(investmentValues[0]).toEqual(0)

    expect(investmentValues[1]).toBeCloseTo(103133.80364952929, 6)
    expect(investmentValues[2]).toBeCloseTo(108286.87752622103, 6)
  })
})

describe('Monthly boundary investment value calculation', () => {
  it('should record monthly values at end of each calendar month', () => {
    // Test monthly periods: portfolio from 2025-01-15 to 2025-04-30, deposit on 2025-02-14
    const periodCount = { count: 1, period: 'month' as const }
    const depositValue = 50000
    const deposits = createTransactionMap([['2025-02-14', depositValue]])
    const withdrawals = createTransactionMap([])
    const investment = DEFAULT_INVESTMENT
    const startDate = new Date('2025-01-15')
    const endDate = new Date('2025-04-30')

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // After fix, values should be recorded at calendar month-ends:
    // Index 0: value as of 2025-01-31 (0 - no deposits yet)
    // Index 1: value as of 2025-02-28 (50k - deposit from 2025-02-14)
    // Index 2: value as of 2025-03-31 (50k - no change)
    // Index 3: value as of 2025-04-30 (50k - no change)

    expect(investmentValues[0]).toEqual(0) // 2025-01-31: no deposits yet
    expect(investmentValues[1]).toEqual(depositValue) // 2025-02-28: deposit from 2025-02-14
    expect(investmentValues[2]).toEqual(depositValue) // 2025-03-31: still 50k
    expect(investmentValues[3]).toEqual(depositValue) // 2025-04-30: still 50k
  })

  it('should handle monthly deposits correctly across different months', () => {
    // Test multiple deposits in different months
    const periodCount = { count: 1, period: 'month' as const }
    const deposits = createTransactionMap([
      ['2025-01-20', 30000],
      ['2025-03-10', 20000],
    ])
    const withdrawals = createTransactionMap([])
    const investment = DEFAULT_INVESTMENT
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-04-30')

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Values recorded at end of each calendar month:
    // Index 0: 2025-01-31 (30k from Jan deposit)
    // Index 1: 2025-02-29 (30k - no activity in Feb)
    // Index 2: 2025-03-31 (50k - Mar deposit added)
    // Index 3: 2025-04-30 (50k - no activity in Apr)

    expect(investmentValues[0]).toEqual(30000) // Jan deposit
    expect(investmentValues[1]).toEqual(30000) // No change in Feb
    expect(investmentValues[2]).toEqual(50000) // Mar deposit added
    expect(investmentValues[3]).toEqual(50000) // No change in Apr
  })

  it('should handle monthly periods with growth (precise values)', () => {
    // With positive APY, compute exact month-end values
    const periodCount = { count: 1, period: 'month' as const }
    const depositValue = 60000
    const deposits = createTransactionMap([['2025-02-15', depositValue]])
    const withdrawals = createTransactionMap([])
    const investment = {
      ...DEFAULT_INVESTMENT,
      apy: 12, // 12% APY (1% per month) for easier calculations
    }
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-05-31')

    const { investmentValues } = getInvestmentValues(
      periodCount,
      { deposits, withdrawals, startDate, endDate },
      investment,
      DAYS_PER_YEAR,
    )

    // Month-ends:
    expect(investmentValues[0]).toEqual(0)

    expect(investmentValues[1]).toBeCloseTo(60242.50483874539, 6)
    expect(investmentValues[2]).toBeCloseTo(60824.74836047031, 6)
    expect(investmentValues[3]).toBeCloseTo(61393.56729377448, 6)
    expect(investmentValues[4]).toBeCloseTo(61986.935828633155, 6)
  })
})
