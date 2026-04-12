import { describe, expect, it } from 'vitest'

import { calculateInflationAdjustedAmount, calculateTotalDepositAmount } from './calculation-utils'
import type { TransactionMap, TransactionMapEntry } from './types'

// Helper function to convert test data to new TransactionMap format
function createTransactionMap(entries: Array<[string, number]>): TransactionMap {
  const map = new Map<string, TransactionMapEntry>()
  for (const [date, amount] of entries) {
    map.set(date, { amount, transactionIds: [] })
  }
  return map
}

describe('#calculateTotalDepositAmount', () => {
  it('should return 0 for an empty deposit map', () => {
    const deposits = createTransactionMap([])
    expect(calculateTotalDepositAmount(deposits)).toBe(0)
  })

  it('should correctly sum a single deposit', () => {
    const deposits = createTransactionMap([['2024-01-01', 150]])
    expect(calculateTotalDepositAmount(deposits)).toBe(150)
  })

  it('should correctly sum multiple deposits', () => {
    const deposits = createTransactionMap([
      ['2024-01-01', 100],
      ['2024-01-15', 250],
      ['2024-02-01', 300],
    ])
    expect(calculateTotalDepositAmount(deposits)).toBe(650)
  })
})

describe('#calculateInflationAdjustedAmount', () => {
  it('returns original amount when transaction and base dates match', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2024-01-01', 0.03)
    expect(result).toBe(1000)
  })

  it('applies positive inflation over one year (non-leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2023-01-01', 0.03)
    expect(result).toBeCloseTo(1029.98, 2)
  })

  it('applies positive inflation over one year (leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2025-01-01', '2024-01-01', 0.03)
    expect(result).toBeCloseTo(1030.06, 2)
  })

  it('calculates inflation for single day period', () => {
    const result = calculateInflationAdjustedAmount(100, '2024-01-02', '2024-01-01', 0.0365)
    expect(result).toBeCloseTo(100.01, 2)
  })

  it('compounds inflation over multiple years (non-leap years)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2025-01-01', '2023-01-01', 0.03)
    expect(result).toBeCloseTo(1060.94, 2)
  })

  it('compounds inflation over multiple years (with leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2026-01-01', '2024-01-01', 0.03)
    expect(result).toBeCloseTo(1060.94, 2)
  })

  it('calculates inflation for fractional year periods', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-07-01', '2024-01-01', 0.04)
    expect(result).toBeCloseTo(1019.74, 2)
  })

  it('returns original amount with zero inflation rate', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2023-01-01', 0)
    expect(result).toBe(1000)
  })

  it('applies deflation with negative inflation rate (non-leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2023-01-01', -0.02)
    expect(result).toBeCloseTo(980.01, 2)
  })

  it('applies deflation with negative inflation rate (leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2025-01-01', '2024-01-01', -0.02)
    expect(result).toBeCloseTo(979.96, 2)
  })

  it('deflates amount when transaction date precedes base date (non-leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2023-01-01', '2024-01-01', 0.03)
    expect(result).toBeCloseTo(970.89, 2)
  })

  it('deflates amount when transaction date precedes base date (leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2025-01-01', 0.03)
    expect(result).toBeCloseTo(970.81, 2)
  })

  it('uses 365.25 days per year for inflation calculation (non-leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2024-01-01', '2023-01-01', 0.03)
    expect(result).toBeCloseTo(1029.98, 2)
  })

  it('uses 365.25 days per year for inflation calculation (leap year)', () => {
    const result = calculateInflationAdjustedAmount(1000, '2025-01-01', '2024-01-01', 0.03)
    expect(result).toBeCloseTo(1030.06, 2)
  })
})
