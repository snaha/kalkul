import { describe, expect, it } from 'vitest'

import {
  calculateNumOccurrences,
  calculateTotalAmount,
  calculateTotalDisplayAmount,
} from './transaction'
import type { Transaction, TransactionType } from './types'

const baseTransaction: Omit<Transaction, 'end_date' | 'repeat' | 'repeat_unit'> = {
  amount: 100,
  type: 'deposit',
  date: '2024-01-01',
} as const

describe('#calculateNumOccurrences', () => {
  it('should return 1 if end_date is not provided', () => {
    const result = calculateNumOccurrences(baseTransaction)
    expect(result).toBe(1)
  })

  it('should calculate correct number of daily repetitions', () => {
    const result = calculateNumOccurrences({
      ...baseTransaction,
      end_date: '2024-01-10',
      repeat_unit: 'day',
      repeat: 1,
    })
    expect(result).toBe(10)
  })

  it('should calculate weekly repetitions correctly', () => {
    const result = calculateNumOccurrences({
      ...baseTransaction,
      end_date: '2024-02-01',
      repeat_unit: 'week',
      repeat: 1,
    })
    expect(result).toBe(5)
  })

  it('should calculate monthly repetitions correctly', () => {
    const result = calculateNumOccurrences({
      ...baseTransaction,
      end_date: '2024-04-01',
      repeat_unit: 'month',
      repeat: 1,
    })
    expect(result).toBe(4)
  })

  it('should calculate yearly repetitions correctly', () => {
    const result = calculateNumOccurrences({
      ...baseTransaction,
      end_date: '2026-01-01',
      repeat_unit: 'year',
      repeat: 1,
    })
    expect(result).toBe(3)
  })

  it('should throw on missing repeat or repeat_unit', () => {
    expect(() =>
      calculateNumOccurrences({
        ...baseTransaction,
        end_date: '2024-02-01',
      }),
    ).toThrow('invalidTransactionInput')
  })

  it('should throw on invalid repeat unit', () => {
    expect(() =>
      calculateNumOccurrences({
        ...baseTransaction,
        end_date: '2024-02-01',
        repeat_unit: 'invalid_unit',
        repeat: 1,
      } as unknown as Transaction),
    ).toThrow('invalidTransactionRepeatUnit')
  })
})

describe('#calculateTotalAmount', () => {
  it('should return 0 if there are no matching transactions', () => {
    const transactions: Transaction[] = [{ ...baseTransaction, type: 'withdrawal', amount: 50 }]
    expect(calculateTotalAmount(transactions, 'deposit')).toBe(0)
  })

  it('should sum single non-repeating transaction', () => {
    const transactions: Transaction[] = [{ ...baseTransaction, amount: 200 }]
    expect(calculateTotalAmount(transactions, 'deposit' as TransactionType)).toBe(200)
  })

  it('should sum repeating daily transaction', () => {
    const transactions: Transaction[] = [
      {
        ...baseTransaction,
        amount: 10,
        end_date: '2024-01-05',
        repeat_unit: 'day',
        repeat: 1,
        type: 'deposit',
      },
    ]
    // 5 days × 10 = 50
    expect(calculateTotalAmount(transactions, 'deposit')).toBe(50)
  })

  it('should sum mixed repeating and non-repeating', () => {
    const transactions: Transaction[] = [
      { ...baseTransaction, amount: 100 },
      {
        ...baseTransaction,
        amount: 10,
        end_date: '2024-01-03',
        repeat_unit: 'day',
        repeat: 1,
      },
    ]
    // 100 + (3 * 10)
    expect(calculateTotalAmount(transactions, 'deposit')).toBe(130)
  })

  it('applies inflation adjustment to single transaction', () => {
    const transactions: Transaction[] = [
      { ...baseTransaction, amount: 1000, inflation_adjusted: true, date: '2025-01-01' },
    ]
    const result = calculateTotalAmount(transactions, 'deposit', 0.03, '2024-01-01')
    expect(result).toBeCloseTo(1030.06, 2)
  })

  it('ignores inflation parameters when adjustment disabled', () => {
    const transactions: Transaction[] = [
      { ...baseTransaction, amount: 1000, inflation_adjusted: false, date: '2025-01-01' },
    ]
    const result = calculateTotalAmount(transactions, 'deposit', 0.03, '2024-01-01')
    expect(result).toBe(1000)
  })

  it('applies inflation adjustment to recurring transactions', () => {
    const transactions: Transaction[] = [
      {
        ...baseTransaction,
        amount: 100,
        inflation_adjusted: true,
        date: '2024-01-01',
        end_date: '2025-01-01',
        repeat_unit: 'year',
        repeat: 1,
      },
    ]
    const result = calculateTotalAmount(transactions, 'deposit', 0.03, '2024-01-01')
    expect(result).toBeCloseTo(203.01, 2)
  })

  it('ignores inflation adjustment without portfolio context', () => {
    const transactions: Transaction[] = [
      { ...baseTransaction, amount: 1000, inflation_adjusted: true },
    ]
    const result = calculateTotalAmount(transactions, 'deposit', 0.03)
    expect(result).toBe(1000)
  })

  it('processes mixed adjusted and non-adjusted transactions', () => {
    const transactions: Transaction[] = [
      { ...baseTransaction, amount: 1000, inflation_adjusted: false, date: '2025-01-01' },
      { ...baseTransaction, amount: 1000, inflation_adjusted: true, date: '2025-01-01' },
    ]
    const result = calculateTotalAmount(transactions, 'deposit', 0.03, '2024-01-01')
    expect(result).toBeCloseTo(2030.06, 2)
  })

  it('calculates correct inflation adjustment for yearly recurring withdrawals', () => {
    const transaction: Transaction = {
      amount: 2000,
      type: 'withdrawal',
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: true,
    }

    const result = calculateTotalAmount([transaction], 'withdrawal', 0.03, '2024-01-01')
    expect(result).toBeCloseTo(24328.1, 2)
  })

  it('compares inflation-adjusted vs non-adjusted for same recurring period', () => {
    const baseTransaction = {
      amount: 2000,
      type: 'withdrawal' as const,
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month' as const,
      repeat: 1,
    }

    // Non-inflation adjusted
    const nonAdjusted: Transaction = {
      ...baseTransaction,
      inflation_adjusted: false,
    }

    // Inflation adjusted
    const inflationAdjusted: Transaction = {
      ...baseTransaction,
      inflation_adjusted: true,
    }

    const resultNonAdjusted = calculateTotalAmount([nonAdjusted], 'withdrawal', 0.03, '2024-01-01')
    const resultInflationAdjusted = calculateTotalAmount(
      [inflationAdjusted],
      'withdrawal',
      0.03,
      '2024-01-01',
    )

    expect(resultNonAdjusted).toBe(24000)
    expect(resultInflationAdjusted).toBeCloseTo(24328.1, 2)
  })

  it('handles long-term future recurring transactions with inflation', () => {
    const transaction: Transaction = {
      amount: 2000,
      type: 'withdrawal',
      date: '2034-02-01',
      end_date: '2035-01-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: true,
    }

    const result = calculateTotalAmount([transaction], 'withdrawal', 0.03, '2024-01-01')
    expect(result).toBeCloseTo(32774.62, 2)
  })
})

describe('#calculateTotalDisplayAmount', () => {
  it('handles non-inflation-adjusted recurring transactions with UI inflation display', () => {
    const transaction: Transaction = {
      amount: 2000,
      type: 'withdrawal',
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: false,
    }

    const result = calculateTotalDisplayAmount([transaction], 'withdrawal', 0.03, '2024-01-01')

    expect(result.nominal).toBe(-24000)
    expect(result.adjusted).toBeCloseTo(-23678.04, 2)
  })

  it('handles inflation-adjusted recurring transactions with UI inflation display', () => {
    const transaction: Transaction = {
      amount: 2000,
      type: 'withdrawal',
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: true, // IS inflation adjusted
    }

    const result = calculateTotalDisplayAmount([transaction], 'withdrawal', 0.03, '2024-01-01')

    expect(result.nominal).toBeCloseTo(-24328.1, 2)
    expect(result.adjusted).toBeCloseTo(-24000, 2)
  })

  it('demonstrates the core fix: $24,327 vs $24,000 discrepancy resolved', () => {
    const transaction: Transaction = {
      amount: 2000,
      type: 'withdrawal',
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: true,
    }

    const mathematicalResult = calculateTotalAmount([transaction], 'withdrawal', 0.03, '2024-01-01')
    const displayResult = calculateTotalDisplayAmount(
      [transaction],
      'withdrawal',
      0.03,
      '2024-01-01',
    )

    expect(mathematicalResult).toBeCloseTo(24328.1, 2)
    expect(displayResult.adjusted).toBeCloseTo(-24000, 2)
    expect(mathematicalResult + displayResult.adjusted).toBeCloseTo(328.1, 2)
  })

  it('handles the user example: $1000 now + $1000 in 1 year = $1970 with inflation', () => {
    const transactions: Transaction[] = [
      { amount: 1000, type: 'withdrawal', date: '2024-01-01', inflation_adjusted: false },
      { amount: 1000, type: 'withdrawal', date: '2025-01-01', inflation_adjusted: false },
    ]

    const result = calculateTotalDisplayAmount(transactions, 'withdrawal', 0.03, '2024-01-01')

    expect(result.nominal).toBe(-2000)
    expect(result.adjusted).toBeCloseTo(-1970.81, 2)
  })

  it('handles inflation-adjusted deposits showing real vs nominal values', () => {
    const transaction: Transaction = {
      amount: 100,
      type: 'deposit',
      date: '2024-01-01',
      end_date: '2024-12-01',
      repeat_unit: 'month',
      repeat: 1,
      inflation_adjusted: true,
    }

    const result = calculateTotalDisplayAmount([transaction], 'deposit', 0.03, '2024-01-01')

    expect(result.nominal).toBeCloseTo(1216.4, 2)
    expect(result.adjusted).toBeCloseTo(1200, 2)
  })

  it('handles 2% deflation correctly', () => {
    const transaction: Transaction = {
      amount: 1000,
      type: 'withdrawal',
      date: '2025-01-01', // 1 year after base date
      inflation_adjusted: false,
    }

    const result = calculateTotalDisplayAmount([transaction], 'withdrawal', -0.02, '2024-01-01')

    // With 2% deflation, real value should be higher than nominal
    // Real value: compound calculation
    expect(result.nominal).toBe(-1000.0)
    expect(result.adjusted).toBeCloseTo(-1020.45, 2)
  })

  it('handles zero inflation correctly', () => {
    const transaction: Transaction = {
      amount: 1000,
      type: 'deposit',
      date: '2025-01-01',
      inflation_adjusted: true,
    }

    const result = calculateTotalDisplayAmount([transaction], 'deposit', 0, '2024-01-01')

    // With zero inflation, both values should be the same
    expect(result.nominal).toBe(1000)
    expect(result.adjusted).toBe(1000)
  })

  it('handles mixed transaction types with 10% inflation', () => {
    const transactions: Transaction[] = [
      {
        amount: 1000,
        type: 'deposit',
        date: '2024-01-01', // Base date
        inflation_adjusted: false,
      },
      {
        amount: 1000,
        type: 'deposit',
        date: '2025-01-01', // 1 year later
        inflation_adjusted: true,
      },
      {
        amount: 500,
        type: 'withdrawal',
        date: '2025-01-01', // 1 year later
        inflation_adjusted: false,
      },
    ]

    const depositResult = calculateTotalDisplayAmount(transactions, 'deposit', 0.1, '2024-01-01')
    const withdrawalResult = calculateTotalDisplayAmount(
      transactions,
      'withdrawal',
      0.1,
      '2024-01-01',
    )

    // Deposits: 1000 (no adjustment) + compound calculation = ~2100.22 nominal
    // Real value: 1000 + 1000 = 2000
    expect(depositResult.nominal).toBeCloseTo(2100.22, 2)
    expect(depositResult.adjusted).toBe(2000.0)

    // Withdrawals: 500 (no adjustment)
    // Real value: compound calculation
    expect(withdrawalResult.nominal).toBe(-500.0)
    expect(withdrawalResult.adjusted).toBeCloseTo(-454.46, 2)
  })

  it('handles yearly recurring inflation-adjusted deposits with 10% inflation', () => {
    const transaction: Transaction = {
      amount: 1000,
      type: 'deposit',
      date: '2024-01-01',
      end_date: '2027-01-01', // 4 yearly deposits
      repeat: 1,
      repeat_unit: 'year',
      inflation_adjusted: true,
    }

    const result = calculateTotalDisplayAmount([transaction], 'deposit', 0.1, '2024-01-01')

    // Year 1: 1000, Year 2: compound, Year 3: compound, Year 4: compound
    // Total nominal: compound calculation ~4641.46
    // Total real: 4 * 1000 = 4000
    expect(result.nominal).toBeCloseTo(4641.46, 2)
    expect(result.adjusted).toBe(4000.0)
  })

  it('handles simple recurring withdrawals with 12% inflation', () => {
    const transaction: Transaction = {
      amount: 1000,
      type: 'withdrawal',
      date: '2024-01-01',
      end_date: '2025-01-01', // 2 yearly withdrawals
      repeat: 1,
      repeat_unit: 'year',
      inflation_adjusted: true,
    }

    const result = calculateTotalDisplayAmount([transaction], 'withdrawal', 0.12, '2024-01-01')

    // Year 1: 1000, Year 2: compound calculation
    // Total nominal: compound calculation ~2120.26
    // Total real: 2 * 1000 = 2000
    expect(result.nominal).toBeCloseTo(-2120.26, 2)
    expect(result.adjusted).toBe(-2000.0)
  })
})
