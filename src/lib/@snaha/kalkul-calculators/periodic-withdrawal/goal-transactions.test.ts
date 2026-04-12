import { describe, expect, it } from 'vitest'

import type { RetirementGoalData } from '$lib/types'

import { goalToTransactions } from './goal-transactions'

describe('goalToTransactions', () => {
  const mockLabels = {
    initialSavings: 'Initial Savings',
    regularDeposit: 'Regular Deposit',
    withdrawal: 'Withdrawal',
  }

  it('should generate all three transaction types when currentSavings > 0', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'month',
      currentSavings: 10000,
      customDepositAmount: 500,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 2000,
      budgetPeriod: 'month',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    expect(transactions).toHaveLength(3)
    expect(transactions[0].type).toBe('deposit')
    expect(transactions[0].amount).toBe(10000)
    expect(transactions[0].label).toBe('Initial Savings')
    expect(transactions[0].inflation_adjusted).toBe(true)
    expect(transactions[0].repeat).toBeUndefined()

    expect(transactions[1].type).toBe('deposit')
    expect(transactions[1].amount).toBe(500)
    expect(transactions[1].label).toBe('Regular Deposit')
    expect(transactions[1].inflation_adjusted).toBe(true)
    expect(transactions[1].repeat).toBe(1)
    expect(transactions[1].repeat_unit).toBe('month')

    expect(transactions[2].type).toBe('withdrawal')
    expect(transactions[2].amount).toBe(2000)
    expect(transactions[2].label).toBe('Withdrawal')
    expect(transactions[2].inflation_adjusted).toBe(true)
    expect(transactions[2].repeat).toBe(1)
    expect(transactions[2].repeat_unit).toBe('month')
  })

  it('should skip initial deposit when currentSavings is 0', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'month',
      currentSavings: 0,
      customDepositAmount: 500,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 2000,
      budgetPeriod: 'month',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('deposit')
    expect(transactions[0].label).toBe('Regular Deposit')
    expect(transactions[1].type).toBe('withdrawal')
  })

  it('should use yearly frequency when specified', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'year',
      currentSavings: 0,
      customDepositAmount: 6000,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 24000,
      budgetPeriod: 'year',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    expect(transactions[0].repeat_unit).toBe('year')
    expect(transactions[1].repeat_unit).toBe('year')
  })

  it(
    'should calculate required deposit when customDepositAmount is not provided',
    { timeout: 10000 },
    () => {
      const goalData: RetirementGoalData = {
        type: 'retirement',
        depositStart: '2025-01-01T00:00:00.000Z',
        depositPeriod: 'month',
        currentSavings: 0,
        customDepositAmount: undefined,
        withdrawalStart: '2060-01-01T00:00:00.000Z',
        withdrawalDuration: 20,
        desiredBudget: 2000,
        budgetPeriod: 'month',
        apy: 5.5,
        inflation: 2.5,
      }

      const transactions = goalToTransactions(goalData, mockLabels)

      // The deposit amount should be calculated
      expect(transactions[0].amount).toBeGreaterThan(0)
      expect(transactions[0].type).toBe('deposit')
    },
  )

  it('should skip recurring deposit when amount is 0', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'month',
      currentSavings: 10000,
      customDepositAmount: 0,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 2000,
      budgetPeriod: 'month',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    // Should only have initial savings and withdrawal, no recurring deposit
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('deposit')
    expect(transactions[0].label).toBe('Initial Savings')
    expect(transactions[0].amount).toBe(10000)
    expect(transactions[1].type).toBe('withdrawal')
  })

  it('should skip withdrawal when desiredBudget is 0', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'month',
      currentSavings: 10000,
      customDepositAmount: 500,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 0,
      budgetPeriod: 'month',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    // Should only have initial savings and recurring deposit, no withdrawal
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('deposit')
    expect(transactions[0].label).toBe('Initial Savings')
    expect(transactions[1].type).toBe('deposit')
    expect(transactions[1].label).toBe('Regular Deposit')
  })

  it('should only create initial deposit when both recurring deposit and withdrawal are 0', () => {
    const goalData: RetirementGoalData = {
      type: 'retirement',
      depositStart: '2025-01-01T00:00:00.000Z',
      depositPeriod: 'month',
      currentSavings: 10000,
      customDepositAmount: 0,
      withdrawalStart: '2060-01-01T00:00:00.000Z',
      withdrawalDuration: 20,
      desiredBudget: 0,
      budgetPeriod: 'month',
      apy: 5.5,
      inflation: 2.5,
    }

    const transactions = goalToTransactions(goalData, mockLabels)

    // Should only have initial savings
    expect(transactions).toHaveLength(1)
    expect(transactions[0].type).toBe('deposit')
    expect(transactions[0].label).toBe('Initial Savings')
    expect(transactions[0].amount).toBe(10000)
  })
})
