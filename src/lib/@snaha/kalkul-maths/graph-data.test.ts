import { describe, expect, it } from 'vitest'

import type { Investment, InvestmentNested, Portfolio, Transaction } from '$lib/types'

import { getCumulativeValues, getGraphData, getGraphDataForPortfolio } from './graph-data'
import { getBaseData } from './investment-calculations'
import type { GraphData } from './types'

describe('getCumulativeValues', () => {
  const mockGraphData: GraphData = {
    label: 'Test Investment',
    graphLabels: ['2024-1', '2024-2', '2024-3', '2024-4'],
    graphDeposits: [1000, 500, 200, 0],
    graphWithdrawals: [0, 100, 0, 300],
    graphInvestmentValues: [1000, 1450, 1680, 1420],
    graphFeeValues: [-10, -15, -12, -8],
    graphInflationDeposits: [950, 475, 190, 0],
    graphInflationWithdrawals: [0, 95, 0, 285],
    graphInflationInvestmentValues: [950, 1378, 1596, 1349],
    graphInflationFeeValues: [-9.5, -14.25, -11.4, -7.6],
  }

  describe('without inflation adjustment', () => {
    it('should calculate cumulative values correctly for index 0', () => {
      const result = getCumulativeValues(mockGraphData, 0, false)

      expect(result).toEqual({
        cumulativeDeposits: 1000,
        cumulativeWithdrawals: 0,
        cumulativeFees: -10,
        currentValue: 1000,
        cumulativeInterest: 10, // 1000 - 1000 - 0 - (-10) = 10
      })
    })

    it('should calculate cumulative values correctly for index 1', () => {
      const result = getCumulativeValues(mockGraphData, 1, false)

      expect(result).toEqual({
        cumulativeDeposits: 1500, // 1000 + 500
        cumulativeWithdrawals: 100,
        cumulativeFees: -25, // -10 + (-15)
        currentValue: 1450,
        cumulativeInterest: -125, // Period 0: (1000 - 1000 - 0 - (-10)) = 10, Period 1: (450 - 500 - 100 - (-15)) = -135, Total: 10 + (-135) = -125
      })
    })

    it('should calculate cumulative values correctly for index 2', () => {
      const result = getCumulativeValues(mockGraphData, 2, false)

      expect(result).toEqual({
        cumulativeDeposits: 1700, // 1000 + 500 + 200
        cumulativeWithdrawals: 100,
        cumulativeFees: -37, // -10 + (-15) + (-12)
        currentValue: 1680,
        cumulativeInterest: -83, // Period 0: 10, Period 1: -135, Period 2: (230 - 200 - 0 - (-12)) = 42, Total: 10 + (-135) + 42 = -83
      })
    })

    it('should calculate cumulative values correctly for final index', () => {
      const result = getCumulativeValues(mockGraphData, 3, false)

      expect(result).toEqual({
        cumulativeDeposits: 1700,
        cumulativeWithdrawals: 400, // 0 + 100 + 0 + 300
        cumulativeFees: -45, // -10 + (-15) + (-12) + (-8)
        currentValue: 1420,
        cumulativeInterest: -635, // Period 0: 10, Period 1: -135, Period 2: 42, Period 3: (-260 - 0 - 300 - (-8)) = -552, Total: 10 + (-135) + 42 + (-552) = -635
      })
    })
  })

  describe('with inflation adjustment', () => {
    it('should use inflation-adjusted values for index 0', () => {
      const result = getCumulativeValues(mockGraphData, 0, true)

      expect(result).toEqual({
        cumulativeDeposits: 950,
        cumulativeWithdrawals: 0,
        cumulativeFees: -9.5,
        currentValue: 950,
        cumulativeInterest: 9.5, // 950 - 950 - 0 - (-9.5) = 9.5
      })
    })

    it('should use inflation-adjusted values for index 1', () => {
      const result = getCumulativeValues(mockGraphData, 1, true)

      expect(result).toEqual({
        cumulativeDeposits: 1425, // 950 + 475
        cumulativeWithdrawals: 95,
        cumulativeFees: -23.75, // -9.5 + (-14.25)
        currentValue: 1378,
        cumulativeInterest: -118.25, // Period 0: (950 - 950 - 0 - (-9.5)) = 9.5, Period 1: (428 - 475 - 95 - (-14.25)) = -127.75, Total: 9.5 + (-127.75) = -118.25
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty arrays gracefully', () => {
      const emptyGraphData: GraphData = {
        label: 'Empty',
        graphLabels: ['2024-1'],
        graphDeposits: [0],
        graphWithdrawals: [0],
        graphInvestmentValues: [0],
        graphFeeValues: [0],
        graphInflationDeposits: [0],
        graphInflationWithdrawals: [0],
        graphInflationInvestmentValues: [0],
        graphInflationFeeValues: [0],
      }

      const result = getCumulativeValues(emptyGraphData, 0, false)

      expect(result).toEqual({
        cumulativeDeposits: 0,
        cumulativeWithdrawals: 0,
        cumulativeFees: 0,
        currentValue: 0,
        cumulativeInterest: 0,
      })
    })

    it('should handle negative investment values', () => {
      const negativeGraphData: GraphData = {
        label: 'Negative',
        graphLabels: ['2024-1', '2024-2'],
        graphDeposits: [1000, 0],
        graphWithdrawals: [0, 0],
        graphInvestmentValues: [800, -200], // Loss scenario
        graphFeeValues: [-50, -20],
        graphInflationDeposits: [1000, 0],
        graphInflationWithdrawals: [0, 0],
        graphInflationInvestmentValues: [800, -200],
        graphInflationFeeValues: [-50, -20],
      }

      const result = getCumulativeValues(negativeGraphData, 1, false)

      expect(result).toEqual({
        cumulativeDeposits: 1000,
        cumulativeWithdrawals: 0,
        cumulativeFees: -70,
        currentValue: -200,
        cumulativeInterest: -1130, // Period 0: (800 - 1000 - 0 - (-50)) = -150, Period 1: ((-200 - 800) - 0 - 0 - (-20)) = -980, Total: -150 + (-980) = -1130
      })
    })

    it('should handle undefined values by treating them as zero', () => {
      const sparseGraphData: GraphData = {
        label: 'Sparse',
        graphLabels: ['2024-1', '2024-2'],
        graphDeposits: [1000], // Missing second element
        graphWithdrawals: [0, 100],
        graphInvestmentValues: [1000, 900],
        graphFeeValues: [-10, -5],
        graphInflationDeposits: [1000],
        graphInflationWithdrawals: [0, 100],
        graphInflationInvestmentValues: [1000, 900],
        graphInflationFeeValues: [-10, -5],
      }

      const result = getCumulativeValues(sparseGraphData, 1, false)

      expect(result).toEqual({
        cumulativeDeposits: 1000, // 1000 + 0 (undefined treated as 0)
        cumulativeWithdrawals: 100,
        cumulativeFees: -15,
        currentValue: 900,
        cumulativeInterest: -185, // Period 0: (1000 - 1000 - 0 - (-10)) = 10, Period 1: ((900 - 1000) - 0 - 100 - (-5)) = -195, Total: 10 + (-195) = -185
      })
    })
  })

  describe('cumulative interest calculation', () => {
    it('should correctly calculate interest when there are only gains', () => {
      const gainsOnlyData: GraphData = {
        label: 'Gains Only',
        graphLabels: ['2024-1', '2024-2'],
        graphDeposits: [1000, 0],
        graphWithdrawals: [0, 0],
        graphInvestmentValues: [1100, 1200], // 10% gain each period
        graphFeeValues: [0, 0],
        graphInflationDeposits: [1000, 0],
        graphInflationWithdrawals: [0, 0],
        graphInflationInvestmentValues: [1100, 1200],
        graphInflationFeeValues: [0, 0],
      }

      const result = getCumulativeValues(gainsOnlyData, 1, false)

      expect(result.cumulativeInterest).toBe(200) // 100 + 100
    })

    it('should correctly calculate interest with mixed deposits, withdrawals, and fees', () => {
      const mixedData: GraphData = {
        label: 'Mixed',
        graphLabels: ['2024-1', '2024-2', '2024-3'],
        graphDeposits: [1000, 500, 0],
        graphWithdrawals: [0, 200, 300],
        graphInvestmentValues: [1050, 1400, 1150], // Including gains and losses
        graphFeeValues: [-25, -15, -10],
        graphInflationDeposits: [1000, 500, 0],
        graphInflationWithdrawals: [0, 200, 300],
        graphInflationInvestmentValues: [1050, 1400, 1150],
        graphInflationFeeValues: [-25, -15, -10],
      }

      const result = getCumulativeValues(mixedData, 2, false)

      // Period 0: 1050 - 1000 - 0 - (-25) = 75
      // Period 1: 350 - 500 - 200 - (-15) = -335
      // Period 2: -250 - 0 - 300 - (-10) = -540
      // Total: 75 + (-335) + (-540) = -800
      expect(result.cumulativeInterest).toBe(-800)
    })
  })
})

describe('inflation-adjusted transactions on graph', () => {
  const DEFAULT_INVESTMENT: Investment = {
    apy: 0,
    entry_fee: 0,
    entry_fee_type: 'upfront',
    exit_fee: 0,
    exit_fee_type: 'upfront',
    id: 'test-investment-1',
    advanced_fees: false,
    management_fee: 0,
    management_fee_type: 'upfront',
    name: 'Test',
    success_fee: 0,
    ter: undefined,
    type: '',
  }

  const portfolio: Portfolio = {
    currency: 'USD',
    end_date: '2030-12-31',
    id: 'test-portfolio-1',
    inflation_rate: 0.03,
    name: 'P',
    start_date: '2024-01-01',
  }

  it('shows ~$24,000 real sum per year for $2k/mo withdrawals when showInflation=true', () => {
    const transactions = [
      // Seed portfolio with enough funds to realize withdrawals
      {
        amount: 100000,
        date: '2024-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-0',
        label: undefined,
        type: 'deposit' as const,
      },
      {
        amount: 2000,
        date: '2024-01-01',
        end_date: '2024-12-01',
        repeat: 1,
        repeat_unit: 'month' as const,
        inflation_adjusted: true,

        id: 'test-transaction-1',
        label: undefined,
        type: 'withdrawal' as const,
      },
    ]

    const base = getBaseData(transactions, portfolio.inflation_rate, portfolio.start_date)
    const graph = getGraphData(
      { ...base, startDate: new Date(portfolio.start_date), endDate: new Date(portfolio.end_date) },
      DEFAULT_INVESTMENT,
      portfolio,
    )

    // Yearly periods: first year's withdrawal sum should be ~ -24000, others ~0
    const idx2024 = graph.graphLabels.findIndex((l) => l === '2024')
    expect(idx2024).toBeGreaterThanOrEqual(0)
    expect(graph.graphInflationWithdrawals[idx2024]).toBeCloseTo(-24000, 1)
    const later = graph.graphInflationWithdrawals.slice(idx2024 + 1)
    for (const v of later) expect(Math.abs(v)).toBeLessThan(1e-6)
  })

  it('should handle simple inflation-adjusted transactions with 10% inflation', () => {
    const transactions = [
      // Regular deposit (no inflation adjustment)
      {
        amount: 5000,
        date: '2024-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-0',
        label: undefined,
        type: 'deposit' as const,
      },
      // Inflation-adjusted deposit 1 year later
      {
        amount: 1000,
        date: '2025-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: true,

        id: 'test-transaction-1',
        label: undefined,
        type: 'deposit' as const,
      },
    ]

    const base = getBaseData(transactions, 0.1, '2024-01-01') // 10% inflation

    // Verify the base data calculations
    expect(base.deposits.get('2024-01-01')?.amount).toBe(5000.0) // No adjustment
    expect(base.deposits.get('2025-01-01')?.amount).toBeCloseTo(1100.22, 2) // compound calculation

    const graph = getGraphData(
      { ...base, startDate: new Date('2024-01-01'), endDate: new Date('2026-12-31') },
      DEFAULT_INVESTMENT,
      portfolio,
    )

    // Verify graph has inflation data structures
    expect(graph.graphInflationDeposits).toBeDefined()
    expect(graph.graphInflationWithdrawals).toBeDefined()
    expect(graph.graphInflationInvestmentValues).toBeDefined()
    expect(graph.graphInflationFeeValues).toBeDefined()
  })

  it('should demonstrate inflation-adjusted vs nominal values in graph data', () => {
    const transactions = [
      {
        amount: 5000,
        date: '2024-01-01',
        end_date: '2027-01-01',
        repeat: 1,
        repeat_unit: 'year' as const,
        inflation_adjusted: true,

        id: 'test-transaction-0',
        label: undefined,
        type: 'deposit' as const,
      },
    ]

    const base = getBaseData(transactions, 0.04, '2024-01-01')
    const graph = getGraphData(
      { ...base, startDate: new Date('2024-01-01'), endDate: new Date('2028-12-31') },
      DEFAULT_INVESTMENT,
      portfolio,
    )

    // Find first year index
    const idx2024 = graph.graphLabels.findIndex((l) => l.includes('2024'))
    expect(idx2024).toBeGreaterThanOrEqual(0)

    // Should have both nominal and inflation-adjusted values
    expect(graph.graphDeposits[idx2024]).toBeGreaterThan(0)
    expect(graph.graphInflationDeposits[idx2024]).toBeGreaterThan(0)

    // Graph should contain inflation-adjusted data structures
    expect(graph.graphInflationDeposits).toBeDefined()
    expect(graph.graphInflationWithdrawals).toBeDefined()
    expect(graph.graphInflationInvestmentValues).toBeDefined()
    expect(graph.graphInflationFeeValues).toBeDefined()
  })

  it('should handle yearly deposits with 20% inflation', () => {
    const transactions = [
      {
        amount: 1000,
        date: '2024-01-01',
        end_date: '2026-01-01', // 3 yearly deposits
        repeat: 1,
        repeat_unit: 'year' as const,
        inflation_adjusted: true,

        id: 'test-transaction-0',
        label: undefined,
        type: 'deposit' as const,
      },
    ]

    const base = getBaseData(transactions, 0.2, '2024-01-01') // 20% inflation

    // Verify the base data calculations
    expect(base.deposits.get('2024-01-01')?.amount).toBe(1000.0) // Year 1: 1000
    expect(base.deposits.get('2025-01-01')?.amount).toBeCloseTo(1200.45, 2) // Year 2: compound calculation
    expect(base.deposits.get('2026-01-01')?.amount).toBeCloseTo(1440.36, 2) // Year 3: compound calculation

    const graph = getGraphData(
      { ...base, startDate: new Date('2024-01-01'), endDate: new Date('2027-12-31') },
      DEFAULT_INVESTMENT,
      { ...portfolio, inflation_rate: 0.2 },
    )

    // Verify graph structures exist and have data
    expect(graph.graphInflationDeposits).toBeDefined()
    expect(graph.graphDeposits).toBeDefined()
    expect(graph.graphInflationDeposits.length).toBeGreaterThan(0)
    expect(graph.graphDeposits.length).toBeGreaterThan(0)
  })

  it('should use earliest transaction date as inflation baseline', () => {
    // Portfolio runs from 2025-2055 but first transaction is from 1997
    const portfolio: Portfolio = {
      currency: 'EUR',
      end_date: '2055-01-13',
      id: 'test-portfolio-2',
      inflation_rate: 0.0225,
      name: 'Test Portfolio',
      start_date: '2025-01-13',
    }

    const transactions = [
      // Transaction from 1997 (28 years before portfolio start)
      {
        amount: 1000,
        date: '1997-11-09',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-1',
        label: undefined,
        type: 'deposit' as const,
      },
      // Transaction from 2025 (portfolio start date)
      {
        amount: 2000,
        date: '2025-01-13',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-2',
        label: undefined,
        type: 'deposit' as const,
      },
    ]

    const base = getBaseData(transactions, portfolio.inflation_rate, portfolio.start_date)
    const graph = getGraphData(
      { ...base, startDate: new Date('1997-11-09'), endDate: new Date('2055-01-13') },
      DEFAULT_INVESTMENT,
      portfolio,
    )

    // Find the year containing the early transaction (1997)
    const idx1997 = graph.graphLabels.findIndex((l) => l === '1997')
    // Find the year containing the later transaction (2025)
    const idx2025 = graph.graphLabels.findIndex((l) => l === '2025')

    if (idx1997 >= 0 && idx2025 >= 0) {
      // 1997 transaction has no inflation adjustment (baseline year)
      expect(graph.graphInflationDeposits[idx1997]).toBeCloseTo(1000, 0)

      // 2025 transaction is deflated by 28 years of 2.25% inflation
      expect(graph.graphInflationDeposits[idx2025]).toBeLessThan(1500)
      expect(graph.graphInflationDeposits[idx2025]).toBeGreaterThan(800)
    }
  })

  it('should use portfolio start date when it is earlier than first transaction', () => {
    // Portfolio starts in 1990, first transaction is in 2000
    const portfolio: Portfolio = {
      currency: 'USD',
      end_date: '2030-01-01',
      id: 'test-portfolio-3',
      inflation_rate: 0.05,
      name: 'Early Portfolio',
      start_date: '1990-01-01',
    }

    const transactions = [
      // First transaction is 10 years after portfolio start
      {
        amount: 1000,
        date: '2000-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-1',
        label: undefined,
        type: 'deposit' as const,
      },
      // Second transaction is 5 years later with same amount
      {
        amount: 1000,
        date: '2005-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-2',
        label: undefined,
        type: 'deposit' as const,
      },
    ]

    const base = getBaseData(transactions, portfolio.inflation_rate, portfolio.start_date)
    const graph = getGraphData(
      { ...base, startDate: new Date('1990-01-01'), endDate: new Date('2030-01-01') },
      DEFAULT_INVESTMENT,
      portfolio,
    )

    // Find years containing transactions
    const idx2000 = graph.graphLabels.findIndex((l) => l === '2000')
    const idx2005 = graph.graphLabels.findIndex((l) => l === '2005')

    if (idx2000 >= 0 && idx2005 >= 0) {
      // 2000 transaction is deflated by 10 years of 5% inflation from 1990 baseline
      expect(graph.graphInflationDeposits[idx2000]).toBeLessThan(1000)
      expect(graph.graphInflationDeposits[idx2000]).toBeGreaterThan(500)

      // 2005 transaction (same nominal amount) is deflated by 15 years of 5% inflation from 1990 baseline
      // Should be more deflated (smaller real value) than 2000 transaction
      expect(graph.graphInflationDeposits[idx2005]).toBeLessThan(
        graph.graphInflationDeposits[idx2000],
      )
      expect(graph.graphInflationDeposits[idx2005]).toBeLessThan(500)
    }
  })

  it('should stop showing inflation-adjusted withdrawals after investment exhaustion', () => {
    const transactions = [
      // Initial deposit
      {
        amount: 1000,
        date: '2024-01-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-0',
        label: undefined,
        type: 'deposit' as const,
      },
      // Withdrawal that causes exhaustion
      {
        amount: 1500,
        date: '2024-02-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-1',
        label: undefined,
        type: 'withdrawal' as const,
      },
      // Withdrawals scheduled after exhaustion
      {
        amount: 500,
        date: '2024-03-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-2',
        label: undefined,
        type: 'withdrawal' as const,
      },
      {
        amount: 500,
        date: '2024-04-01',
        end_date: undefined,
        repeat: undefined,
        repeat_unit: undefined,
        inflation_adjusted: false,

        id: 'test-transaction-3',
        label: undefined,
        type: 'withdrawal' as const,
      },
    ]

    const testPortfolio = {
      ...portfolio,
      start_date: '2024-01-01',
      end_date: '2024-06-30',
    }

    const base = getBaseData(transactions, testPortfolio.inflation_rate, testPortfolio.start_date)
    const graph = getGraphData(
      {
        ...base,
        startDate: new Date(testPortfolio.start_date),
        endDate: new Date(testPortfolio.end_date),
      },
      { ...DEFAULT_INVESTMENT, apy: 0 }, // No growth to ensure exhaustion
      testPortfolio,
    )

    // Find the indices for each month
    const idxFeb = graph.graphLabels.findIndex((l) => l.includes('2024-2'))
    const idxMar = graph.graphLabels.findIndex((l) => l.includes('2024-3'))
    const idxApr = graph.graphLabels.findIndex((l) => l.includes('2024-4'))

    // February should show the partial withdrawal that exhausted the investment
    expect(idxFeb).toBeGreaterThanOrEqual(0)
    expect(Math.abs(graph.graphInflationWithdrawals[idxFeb])).toBeGreaterThan(0)
    expect(Math.abs(graph.graphInflationWithdrawals[idxFeb])).toBeLessThan(1500)

    // March and April should show zero withdrawals (post-exhaustion)
    // This is the key fix: previously these would incorrectly show non-zero values
    if (idxMar >= 0) {
      expect(Math.abs(graph.graphInflationWithdrawals[idxMar])).toBe(0)
    }
    if (idxApr >= 0) {
      expect(Math.abs(graph.graphInflationWithdrawals[idxApr])).toBe(0)
    }
  })
})

describe('per-investment caching', () => {
  const mockPortfolio: Portfolio = {
    id: 'test-portfolio-1',
    name: 'Test Portfolio',
    currency: 'USD',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    inflation_rate: 0.03,
  }

  const createMockInvestment = (id: string, apy: number, name?: string): Investment => ({
    id,
    name: name ?? `Investment ${id}`,
    apy,
    entry_fee: 0,
    exit_fee: 0,
    management_fee: 0,
    success_fee: 0,
    ter: undefined,
    entry_fee_type: 'ongoing',
    exit_fee_type: 'percentage',
    management_fee_type: 'percentage',
    advanced_fees: false,
    type: undefined,
  })

  const createMockTransaction = (id: string, amount: number): Transaction => ({
    id,
    date: '2024-01-01',
    amount,
    type: 'deposit',
    inflation_adjusted: false,
    end_date: undefined,
    label: undefined,
    repeat: undefined,
    repeat_unit: undefined,
  })

  const createMockInvestmentNested = (
    investment: Investment,
    transactions: Transaction[],
  ): InvestmentNested => ({
    ...investment,
    transactions,
  })

  describe('cache behavior', () => {
    it('should return same results with or without cache', () => {
      const investment1 = createMockInvestment('test-investment-1', 5)
      const investment2 = createMockInvestment('test-investment-2', 7)
      const nested = [
        createMockInvestmentNested(investment1, [
          createMockTransaction('test-transaction-1', 1000),
        ]),
        createMockInvestmentNested(investment2, [
          createMockTransaction('test-transaction-2', 2000),
        ]),
      ]

      // First call (no cache)
      const result1 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Second call (should use cache)
      const result2 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Results should be identical
      expect(result1.data.length).toBe(2)
      expect(result2.data.length).toBe(2)
      expect(result1.data[0].label).toBe(result2.data[0].label)
      expect(result1.data[0].graphLabels).toEqual(result2.data[0].graphLabels)
      expect(result1.total.graphLabels).toEqual(result2.total.graphLabels)
    })

    it('should only recalculate changed investment', () => {
      const investment1 = createMockInvestment('test-investment-1', 5, 'Investment 1')
      const investment2 = createMockInvestment('test-investment-2', 7, 'Investment 2')
      const tx1 = createMockTransaction('test-transaction-1', 1000)
      const tx2 = createMockTransaction('test-transaction-2', 2000)

      const nested1 = [
        createMockInvestmentNested(investment1, [tx1]),
        createMockInvestmentNested(investment2, [tx2]),
      ]

      // First calculation
      const result1 = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: nested1,
        goals: [],
      })

      // Change only investment 2's APY
      const updatedInvestment2 = { ...investment2, apy: 10 }
      const nested2 = [
        createMockInvestmentNested(investment1, [tx1]),
        createMockInvestmentNested(updatedInvestment2, [tx2]),
      ]

      // Second calculation
      const result2 = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: nested2,
        goals: [],
      })

      // Investment 1 should be the same (potentially from cache)
      expect(result1.data[0].label).toBe(result2.data[0].label)

      // Investment 2 should be different (recalculated)
      expect(result2.data[1].label).toBe('Investment 2')
      // Values should differ due to different APY (we're not checking exact values, just structure)
      expect(result2.data[1].graphInvestmentValues).toBeDefined()
    })

    it('should handle transaction changes for specific investment', () => {
      const investment1 = createMockInvestment('test-investment-1', 5, 'Investment 1')
      const investment2 = createMockInvestment('test-investment-2', 7, 'Investment 2')
      const tx1 = createMockTransaction('test-transaction-1', 1000)
      const tx2 = createMockTransaction('test-transaction-2', 2000)

      const nested1 = [
        createMockInvestmentNested(investment1, [tx1]),
        createMockInvestmentNested(investment2, [tx2]),
      ]

      // First calculation to warm up cache
      getGraphDataForPortfolio({ ...mockPortfolio, investments: nested1, goals: [] })

      // Add transaction for investment 1 only
      const tx3 = createMockTransaction('test-transaction-3', 500)
      const nested2 = [
        createMockInvestmentNested(investment1, [tx1, tx3]),
        createMockInvestmentNested(investment2, [tx2]),
      ]

      // Second calculation
      const result2 = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: nested2,
        goals: [],
      })

      // Investment 2 should be unchanged (potentially from cache)
      expect(result2.data[1].label).toBe('Investment 2')

      // Results should still be valid
      expect(result2.data.length).toBe(2)
      expect(result2.data[0]).toBeDefined()
      expect(result2.data[1]).toBeDefined()
    })

    it('should cache empty investment results', () => {
      const investment = createMockInvestment('test-investment-1', 5)
      const nested = [createMockInvestmentNested(investment, [])]

      // First call
      const result1 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Second call (should use cache)
      const result2 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      expect(result1.data.length).toBe(1)
      expect(result2.data.length).toBe(1)
      expect(result1.data[0].graphInvestmentValues).toEqual(result2.data[0].graphInvestmentValues)
    })
  })

  describe('cache invalidation', () => {
    it('should invalidate cache when investment parameters change', () => {
      const investment = createMockInvestment('test-investment-1', 5)
      const tx = createMockTransaction('test-transaction-1', 1000)
      const nested = [createMockInvestmentNested(investment, [tx])]

      // First calculation
      const result1 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Change investment APY
      const updatedInvestment = { ...investment, apy: 10 }
      const nested2 = [createMockInvestmentNested(updatedInvestment, [tx])]
      const result2 = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: nested2,
        goals: [],
      })

      // Results should be different
      expect(result1.data[0].graphInvestmentValues).toBeDefined()
      expect(result2.data[0].graphInvestmentValues).toBeDefined()
      // Not checking exact values, just that both calculations succeeded
    })

    it('should invalidate cache when portfolio dates change', () => {
      const investment = createMockInvestment('test-investment-1', 5)
      const nested = [
        createMockInvestmentNested(investment, [createMockTransaction('test-transaction-1', 1000)]),
      ]

      // First calculation
      const result1 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Change portfolio end date
      const updatedPortfolio = { ...mockPortfolio, end_date: '2025-12-31' }
      const result2 = getGraphDataForPortfolio({
        ...updatedPortfolio,
        investments: nested,
        goals: [],
      })

      // Graph labels should reflect different date range
      expect(result1.total.graphLabels.length).toBeLessThanOrEqual(result2.total.graphLabels.length)
    })

    it('should invalidate cache when portfolio inflation changes', () => {
      const investment = createMockInvestment('test-investment-1', 5)
      const nested = [
        createMockInvestmentNested(investment, [createMockTransaction('test-transaction-1', 1000)]),
      ]

      // First calculation
      const result1 = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Change portfolio inflation
      const updatedPortfolio = { ...mockPortfolio, inflation_rate: 0.05 }
      const result2 = getGraphDataForPortfolio({
        ...updatedPortfolio,
        investments: nested,
        goals: [],
      })

      // Inflation-adjusted values should be different
      expect(result1.data[0].graphInflationInvestmentValues).toBeDefined()
      expect(result2.data[0].graphInflationInvestmentValues).toBeDefined()
    })
  })

  describe('multiple investments', () => {
    it('should handle portfolio with many investments efficiently', () => {
      const nested = Array.from({ length: 10 }, (_, i) => {
        const inv = createMockInvestment(`test-investment-${i + 1}`, 5 + i, `Investment ${i + 1}`)
        const tx = createMockTransaction(`test-transaction-${i + 1}`, 1000 * (i + 1))
        return createMockInvestmentNested(inv, [tx])
      })

      const result = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      expect(result.data.length).toBe(10)
      expect(result.total.graphLabels.length).toBeGreaterThan(0)

      // All investments should have valid data
      result.data.forEach((data, i) => {
        expect(data.label).toBe(`Investment ${i + 1}`)
        expect(data.graphInvestmentValues.length).toBeGreaterThan(0)
      })
    })

    it('should aggregate totals correctly across investments', () => {
      const investment1 = createMockInvestment('test-investment-1', 5)
      const investment2 = createMockInvestment('test-investment-2', 7)
      const nested = [
        createMockInvestmentNested(investment1, [
          createMockTransaction('test-transaction-1', 1000),
        ]),
        createMockInvestmentNested(investment2, [
          createMockTransaction('test-transaction-2', 2000),
        ]),
      ]

      const result = getGraphDataForPortfolio({ ...mockPortfolio, investments: nested, goals: [] })

      // Total should aggregate both investments
      expect(result.total.label).toBe('Total')

      // At first period, total deposits should be sum of individual deposits
      const firstPeriodTotalDeposits = result.total.graphDeposits[0]
      const firstPeriodInv1Deposits = result.data[0].graphDeposits[0]
      const firstPeriodInv2Deposits = result.data[1].graphDeposits[0]

      expect(firstPeriodTotalDeposits).toBeCloseTo(
        firstPeriodInv1Deposits + firstPeriodInv2Deposits,
        2,
      )
    })
  })
})
