import { describe, expect, it } from 'vitest'

import type { Investment } from '$lib/types'

import { DAYS_PER_YEAR } from './constants'
import {
  calculateDailyFees,
  calculateDailyManagementFees,
  calculateEntryFee,
  calculateExitFee,
} from './fee-calculations'

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

describe('#calculateEntryFee', () => {
  it('should calculate ongoing fee as amount * fee', () => {
    expect(calculateEntryFee(1000, 'ongoing', 0.05, 0, 0)).toBe(50)
    expect(calculateEntryFee(1000, 'ongoing', 0.05, 10000, 100)).toBe(50)
    expect(calculateEntryFee(200, 'ongoing', 0.1, 0, 0)).toBe(20)
  })

  it('should calculate forty-sixty fee when still to be paid >= current fee', () => {
    expect(calculateEntryFee(1000, 'forty-sixty', 0.01, 100000, 0)).toBe(600)
  })
  it('should have 0 fees when all fees are already paid', () => {
    expect(calculateEntryFee(1000, 'forty-sixty', 0.01, 100000, 10000)).toBe(0)
  })

  it('should cap forty-sixty fee when still to be paid < current fee', () => {
    expect(calculateEntryFee(1000, 'forty-sixty', 0.01, 100000, 950)).toBe(50)
  })

  it('should pay full amount as fee with upfront', () => {
    expect(calculateEntryFee(1000, 'upfront', 0.1, 100000, 0)).toBe(1000)
  })

  it('should have 0 fees when all fees are already paid', () => {
    expect(calculateEntryFee(1000, 'upfront', 0.01, 100000, 1000)).toBe(0)
  })

  it('should cap upfront fee when only part of the total fees is remaining', () => {
    expect(calculateEntryFee(1000, 'upfront', 0.01, 10000, 90)).toBe(10)
  })
})

describe('#calculateExitFee', () => {
  it('should calculate percentage', () => {
    expect(calculateExitFee(1000, 'percentage', 0.05)).toBe(50)
  })

  it('should calculate fixed', () => {
    expect(calculateExitFee(1000, 'fixed', 50)).toBe(50)
  })
})

describe('#calculateDailyManagementFees', () => {
  it('should calculate fixed daily fee', () => {
    const managementFee = 0.1
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      management_fee_type: 'fixed',
      management_fee: managementFee,
    }

    const { dailyFee: dailyManagementFee, dailyFeeMultiplier } = calculateDailyManagementFees(
      investment,
      DAYS_PER_YEAR,
    )

    expect(dailyFeeMultiplier.toNumber()).toEqual(1)
    expect(dailyManagementFee.mul(DAYS_PER_YEAR).toNumber()).toEqual(managementFee)
  })

  it('should calculate percentage daily fee', () => {
    const managementFee = 10
    const investment: Investment = {
      ...DEFAULT_INVESTMENT,
      management_fee_type: 'percentage',
      management_fee: managementFee,
    }

    const { dailyFee: dailyManagementFee, dailyFeeMultiplier } = calculateDailyManagementFees(
      investment,
      DAYS_PER_YEAR,
    )

    expect(dailyManagementFee.toNumber()).toEqual(0)
    expect(dailyFeeMultiplier.toNumber()).toEqual(0.9997115802302546)
  })
})

describe('#calculateDailyFees', () => {
  it('should calculate percentage daily fee', () => {
    const terFee = 10
    const { dailyFee: dailyManagementFee, dailyFeeMultiplier } = calculateDailyFees(
      terFee,
      'percentage',
      DAYS_PER_YEAR,
    )

    expect(dailyManagementFee.toNumber()).toEqual(0)
    expect(dailyFeeMultiplier.toNumber()).toEqual(0.9997115802302546)
  })
})
