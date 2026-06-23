import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGraphDataForPortfolio } from '$lib/@snaha/kalkul-maths'
import type { InvestmentNested, Portfolio, Transaction } from '$lib/types'

import { withPortfolioSimulationStore } from './portfolio-simulation.svelte'

describe('withPortfolioSimulationStore', () => {
  const mockPortfolio: Portfolio = {
    id: 'test-portfolio-1',
    name: 'Test Portfolio',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    inflation_rate: 0.03,
  }

  const mockTransaction1: Transaction = {
    id: 'test-transaction-1',
    date: '2024-01-01',
    amount: 1000,
    type: 'deposit',
    inflation_adjusted: false,
  }

  const mockTransaction2: Transaction = {
    id: 'test-transaction-2',
    date: '2024-01-01',
    amount: 2000,
    type: 'deposit',
    inflation_adjusted: false,
  }

  const mockInvestment1: InvestmentNested = {
    id: 'test-investment-1',
    name: 'Investment 1',
    apy: 5,
    entry_fee: 0,
    exit_fee: 0,
    management_fee: 0,
    success_fee: 0,
    ter: 0,
    entry_fee_type: 'ongoing',
    exit_fee_type: 'percentage',
    management_fee_type: 'percentage',
    advanced_fees: false,
    type: undefined,
    transactions: [mockTransaction1],
  }

  const mockInvestment2: InvestmentNested = {
    id: 'test-investment-2',
    name: 'Investment 2',
    apy: 7,
    entry_fee: 0,
    exit_fee: 0,
    management_fee: 0,
    success_fee: 0,
    ter: 0,
    entry_fee_type: 'ongoing',
    exit_fee_type: 'percentage',
    management_fee_type: 'percentage',
    advanced_fees: false,
    type: undefined,
    transactions: [mockTransaction2],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  describe('initialization', () => {
    it('should create store instance', () => {
      const store = withPortfolioSimulationStore()
      expect(store).toBeDefined()
      expect(store.calculateIteratively).toBeDefined()
      expect(store.simulationData).toBeDefined()
      expect(store.simulationData.data).toEqual([])
      expect(store.simulationData.isCalculating).toBe(true)
    })
  })

  describe('calculateIteratively', () => {
    it('should set isCalculating to true initially', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })

      const data = store.simulationData
      expect(data?.isCalculating).toBe(true)
      expect(data?.progress).toBe(0)
    })

    it('should create empty placeholder data immediately', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })

      const data = store.simulationData
      expect(data?.data).toHaveLength(1)
      expect(data?.data[0].label).toBe('Investment 1')
      expect(data?.data[0].graphInvestmentValues[0]).toBe(0)
    })

    it('should handle empty investments array', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({ ...mockPortfolio, investments: [], goals: [] })

      const data = store.simulationData
      expect(data?.isCalculating).toBe(false)
      expect(data?.progress).toBe(100)
      expect(data?.data).toHaveLength(0)
    })

    it('should show loading overlay when recalculating', () => {
      const store = withPortfolioSimulationStore()

      // First calculation
      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })

      // Wait for calculation to complete
      vi.runAllTimers()

      // Should be complete
      expect(store.simulationData?.isCalculating).toBe(false)

      // Trigger recalculation
      const updatedInvestment = { ...mockInvestment1, apy: 10 }
      store.calculateIteratively({ ...mockPortfolio, investments: [updatedInvestment], goals: [] })

      // Should immediately set isCalculating to true
      expect(store.simulationData?.isCalculating).toBe(true)
    })

    it('should use only nested transactions from each investment', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })

      // Wait for calculation
      vi.runAllTimers()

      // Should only process mockInvestment1's nested transactions
      const data = store.simulationData
      expect(data?.data).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('should handle investment with no transactions', () => {
      const store = withPortfolioSimulationStore()

      const emptyInvestment: InvestmentNested = { ...mockInvestment1, transactions: [] }
      store.calculateIteratively({ ...mockPortfolio, investments: [emptyInvestment], goals: [] })
      vi.runAllTimers()

      const data = store.simulationData
      expect(data?.data).toHaveLength(1)
      expect(data?.data[0].graphInvestmentValues.every((v) => v === 0)).toBe(true)
    })

    it('should handle very large transaction amounts', () => {
      const store = withPortfolioSimulationStore()

      const largeInvestment: InvestmentNested = {
        ...mockInvestment1,
        transactions: [{ ...mockTransaction1, amount: 1e12 }],
      }

      store.calculateIteratively({ ...mockPortfolio, investments: [largeInvestment], goals: [] })
      vi.runAllTimers()

      const data = store.simulationData
      expect(data?.data).toHaveLength(1)
      expect(data?.data[0].graphInvestmentValues[0]).toBeGreaterThan(0)
    })

    it('should handle multiple investments with different transaction sets', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({
        ...mockPortfolio,
        investments: [mockInvestment1, mockInvestment2],
        goals: [],
      })
      vi.runAllTimers()

      const data = store.simulationData
      expect(data?.data).toHaveLength(2)
      expect(data?.data[0].label).toBe('Investment 1')
      expect(data?.data[1].label).toBe('Investment 2')
      expect(data?.isCalculating).toBe(false)
      expect(data?.progress).toBe(100)
    })
  })

  describe('calculation consistency', () => {
    it('should produce identical results to getGraphDataForPortfolio for single investment', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })
      vi.runAllTimers()

      const storeResult = store.simulationData
      const directResult = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: [mockInvestment1],
        goals: [],
      })

      // Compare investment data
      expect(storeResult?.data).toHaveLength(1)
      expect(storeResult?.data[0]).toEqual(directResult.data[0])

      // Compare total
      expect(storeResult?.total).toEqual(directResult.total)
    })

    it('should produce identical results to getGraphDataForPortfolio for multiple investments', () => {
      const store = withPortfolioSimulationStore()

      store.calculateIteratively({
        ...mockPortfolio,
        investments: [mockInvestment1, mockInvestment2],
        goals: [],
      })
      vi.runAllTimers()

      const storeResult = store.simulationData
      const directResult = getGraphDataForPortfolio({
        ...mockPortfolio,
        investments: [mockInvestment1, mockInvestment2],
        goals: [],
      })

      // Compare all investment data
      expect(storeResult?.data).toHaveLength(2)
      expect(storeResult?.data[0]).toEqual(directResult.data[0])
      expect(storeResult?.data[1]).toEqual(directResult.data[1])

      // Compare total - this is the critical test
      expect(storeResult?.total.graphLabels).toEqual(directResult.total.graphLabels)
      expect(storeResult?.total.graphDeposits).toEqual(directResult.total.graphDeposits)
      expect(storeResult?.total.graphWithdrawals).toEqual(directResult.total.graphWithdrawals)
      expect(storeResult?.total.graphInvestmentValues).toEqual(
        directResult.total.graphInvestmentValues,
      )
      expect(storeResult?.total.graphFeeValues).toEqual(directResult.total.graphFeeValues)
      expect(storeResult?.total.graphInflationDeposits).toEqual(
        directResult.total.graphInflationDeposits,
      )
      expect(storeResult?.total.graphInflationWithdrawals).toEqual(
        directResult.total.graphInflationWithdrawals,
      )
      expect(storeResult?.total.graphInflationInvestmentValues).toEqual(
        directResult.total.graphInflationInvestmentValues,
      )
      expect(storeResult?.total.graphInflationFeeValues).toEqual(
        directResult.total.graphInflationFeeValues,
      )
      expect(storeResult?.total.exhaustionWarning?.date).toEqual(
        directResult.total.exhaustionWarning?.date,
      )
      expect(storeResult?.total.exhaustionWarning?.missingAmount).toEqual(
        directResult.total.exhaustionWarning?.missingAmount,
      )
    })

    it('should maintain consistency across recalculations', () => {
      const store = withPortfolioSimulationStore()

      // First calculation
      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })
      vi.runAllTimers()
      const firstResult = { ...store.simulationData }

      // Recalculation with same data
      store.calculateIteratively({ ...mockPortfolio, investments: [mockInvestment1], goals: [] })
      vi.runAllTimers()
      const secondResult = store.simulationData

      // Results should be identical
      expect(secondResult?.data).toEqual(firstResult.data)
      expect(secondResult?.total).toEqual(firstResult.total)
    })
  })
})
