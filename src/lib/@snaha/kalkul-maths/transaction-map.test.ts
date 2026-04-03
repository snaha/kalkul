import { describe, expect, it } from 'vitest'

import { addSingleEvent, addTransaction, createTransactionMap } from './transaction-map'
import type { Transaction } from './types'

describe('#createTransactionMap', () => {
  it('returns an empty map when given no transactions', () => {
    const result = createTransactionMap([], '2024-01-01', 0)
    expect(result.size).toBe(0)
  })

  it('correctly stores a single transaction', () => {
    const transactions: Omit<Transaction, 'type'>[] = [
      {
        date: '2025-03-17',
        amount: 100,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]
    const result = createTransactionMap(transactions, '2024-01-01', 0)
    expect(result.get('2025-03-17')?.amount).toBe(100)
  })
})

describe('#addTransaction', () => {
  it('adds a single transaction to the map', () => {
    const map = new Map()
    const transaction: Omit<Transaction, 'type'> = {
      date: '2025-03-17',
      amount: 50,
      repeat: undefined,
      repeat_unit: undefined,
      end_date: undefined,
    }
    addTransaction(map, transaction, '2024-01-01', 0)
    expect(map.get('2025-03-17')?.amount).toBe(50)
  })
})

describe('#addSingleEvent', () => {
  it('correctly adds an event to an empty map', () => {
    const map = new Map()
    addSingleEvent(map, '2025-03-17', 25, '2024-01-01', 0)
    expect(map.get('2025-03-17')?.amount).toBe(25)
  })

  it('correctly sums amounts for the same date', () => {
    const map = new Map()
    addSingleEvent(map, '2025-03-17', 25, '2024-01-01', 0)
    addSingleEvent(map, '2025-03-17', 75, '2024-01-01', 0)
    expect(map.get('2025-03-17')?.amount).toBe(100)
  })

  it('applies inflation adjustment when inflation_adjusted is true', () => {
    const map = new Map()
    addSingleEvent(map, '2025-01-01', 1000, '2024-01-01', 0.03, true)
    expect(map.get('2025-01-01')?.amount).toBeCloseTo(1030, 0)
  })

  it('does not apply inflation adjustment when inflation_adjusted is false', () => {
    const map = new Map()
    addSingleEvent(map, '2025-01-01', 1000, '2024-01-01', 0.03, false)
    expect(map.get('2025-01-01')?.amount).toBe(1000)
  })
})

describe('#inflation adjustment integration', () => {
  it('creates transaction map with inflation-adjusted transactions', () => {
    const transactions: Omit<Transaction, 'type'>[] = [
      {
        date: '2024-01-01',
        amount: 1000,
        inflation_adjusted: false,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
      {
        date: '2025-01-01',
        amount: 1000,
        inflation_adjusted: true,
        repeat: undefined,
        repeat_unit: undefined,
        end_date: undefined,
      },
    ]
    const result = createTransactionMap(transactions, '2024-01-01', 0.03)

    expect(result.get('2024-01-01')?.amount).toBe(1000)
    expect(result.get('2025-01-01')?.amount).toBeCloseTo(1030, 0)
  })

  it('handles recurring inflation-adjusted transactions', () => {
    const transaction: Omit<Transaction, 'type'> = {
      date: '2024-01-01',
      amount: 100,
      inflation_adjusted: true,
      repeat: 1,
      repeat_unit: 'year',
      end_date: '2026-01-01',
    }
    const result = createTransactionMap([transaction], '2024-01-01', 0.03)

    expect(result.get('2024-01-01')?.amount).toBe(100)
    expect(result.get('2025-01-01')?.amount).toBeCloseTo(103, 0)
    expect(result.get('2026-01-01')?.amount).toBeCloseTo(106, 0)
  })
})
