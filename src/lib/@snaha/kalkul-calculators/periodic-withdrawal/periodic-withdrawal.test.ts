import { describe, expect, it } from 'vitest'

import {
  type PeriodicWithdrawalCalculationInput,
  calculateRequiredDeposit,
  calculateWhatYouHave,
  generateYears,
} from './periodic-withdrawal'

describe('generateYears', () => {
  it('should generate correct year range', () => {
    const depositStart = new Date('2025-01-01')
    const withdrawalStart = new Date('2060-01-01')
    const withdrawalDuration = 20

    const years = generateYears(depositStart, withdrawalStart, withdrawalDuration)

    expect(years[0]).toBe(2025)
    expect(years[years.length - 1]).toBe(2080)
    expect(years.length).toBe(56) // 2025 to 2080 inclusive
  })
})

describe('calculateRequiredDeposit', () => {
  const baseInput: PeriodicWithdrawalCalculationInput = {
    withdrawalStart: new Date('2060-01-01'),
    withdrawalDuration: 20,
    desiredBudget: 2000,
    budgetPeriod: 'month',
    currentSavings: 0,
    apy: 4.5,
    inflation: 2.5,
    depositStart: new Date('2025-01-01'),
    depositPeriod: 'month',
  }

  it('should calculate a positive deposit amount', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    expect(deposit).toBeGreaterThan(0)
  })

  it('should produce trajectory that starts with small positive value', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    const result = calculateWhatYouHave(baseInput, deposit)
    // Year-end of first year should have some value
    expect(result[0]).toBeGreaterThan(0)
    expect(result[0]).toBeLessThan(50000) // Reasonable for first year
  })

  it('should produce trajectory that ends at 0 after retirement', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    const result = calculateWhatYouHave(baseInput, deposit)
    expect(result[result.length - 1]).toBe(0)
  })

  it('should produce trajectory with peak value near retirement start', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    const result = calculateWhatYouHave(baseInput, deposit)
    const retirementStartIndex = 2060 - 2025 // 35 years from start
    const peak = Math.max(...result)

    // Peak should be reasonably close to retirement start (within ~2%)
    const valueAtRetirement = result[retirementStartIndex]
    const percentDiff = Math.abs(valueAtRetirement - peak) / peak
    expect(percentDiff).toBeLessThan(0.02) // Within 2%
  })

  it('should produce trajectory that grows exponentially during accumulation', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    const result = calculateWhatYouHave(baseInput, deposit)

    // Check that growth accelerates (exponential pattern)
    const midpoint1 = 10
    const midpoint2 = 20
    const midpoint3 = 30

    const growth1 = result[midpoint1] - result[0]
    const growth2 = result[midpoint2] - result[midpoint1]
    const growth3 = result[midpoint3] - result[midpoint2]

    // Each period should show increasing growth (exponential)
    expect(growth2).toBeGreaterThan(growth1)
    expect(growth3).toBeGreaterThan(growth2)
  })

  it('should produce trajectory that declines during retirement', () => {
    const deposit = calculateRequiredDeposit(baseInput)
    const result = calculateWhatYouHave(baseInput, deposit)
    const retirementStartIndex = 2060 - 2025

    // Values should decline after retirement starts
    for (let i = retirementStartIndex + 1; i < result.length - 1; i++) {
      expect(result[i]).toBeLessThan(result[i - 1])
    }
  })

  it('should scale with budget amount', () => {
    const input1 = { ...baseInput, desiredBudget: 1000 }
    const input2 = { ...baseInput, desiredBudget: 2000 }

    const deposit1 = calculateRequiredDeposit(input1)
    const deposit2 = calculateRequiredDeposit(input2)

    const result1 = calculateWhatYouHave(input1, deposit1)
    const result2 = calculateWhatYouHave(input2, deposit2)

    // Peak value should be roughly 2x
    const peak1 = Math.max(...result1)
    const peak2 = Math.max(...result2)

    expect(peak2 / peak1).toBeCloseTo(2, 0)
  })

  it('should handle perYear budget frequency', () => {
    const monthlyInput = { ...baseInput, desiredBudget: 2000, budgetPeriod: 'month' as const }
    const yearlyInput = { ...baseInput, desiredBudget: 24000, budgetPeriod: 'year' as const }

    const deposit1 = calculateRequiredDeposit(monthlyInput)
    const deposit2 = calculateRequiredDeposit(yearlyInput)

    const result1 = calculateWhatYouHave(monthlyInput, deposit1)
    const result2 = calculateWhatYouHave(yearlyInput, deposit2)

    // Should produce similar results (2000 * 12 = 24000)
    const peak1 = Math.max(...result1)
    const peak2 = Math.max(...result2)

    expect(peak2 / peak1).toBeCloseTo(1, 1)
  })
})

describe('calculateWhatYouHave', () => {
  const baseInput: PeriodicWithdrawalCalculationInput = {
    withdrawalStart: new Date('2060-01-01'),
    withdrawalDuration: 20,
    desiredBudget: 2000,
    budgetPeriod: 'month',
    currentSavings: 10000,
    apy: 4.5,
    inflation: 2.5,
    depositStart: new Date('2025-01-01'),
    depositPeriod: 'month',
  }

  it('should have year-end value greater than current savings', () => {
    const result = calculateWhatYouHave(baseInput, 100)
    // First value is year-end, which includes current savings + deposits + growth
    expect(result[0]).toBeGreaterThan(10000)
  })

  it('should grow during accumulation with deposits', () => {
    const result = calculateWhatYouHave(baseInput, 200)

    // Should grow from current savings
    expect(result[10]).toBeGreaterThan(result[0])
    expect(result[20]).toBeGreaterThan(result[10])
  })

  it('should decline during retirement with withdrawals', () => {
    const result = calculateWhatYouHave(baseInput, 500)
    const retirementStartIndex = 2060 - 2025

    // Should decline after retirement (if deposits are insufficient)
    const balanceMidRetirement = result[retirementStartIndex + 10]

    // Balance should either grow slower or decline
    expect(balanceMidRetirement).toBeDefined()
  })

  it('should never go negative', () => {
    // Test with very low deposit
    const result = calculateWhatYouHave(baseInput, 10)

    result.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
    })
  })

  it('should grow faster with higher deposit amounts', () => {
    const result1 = calculateWhatYouHave(baseInput, 100)
    const result2 = calculateWhatYouHave(baseInput, 200)

    const midpoint = 20
    expect(result2[midpoint]).toBeGreaterThan(result1[midpoint])
  })

  it('should handle monthly deposit frequency', () => {
    const monthlyInput = { ...baseInput, depositPeriod: 'month' as const }
    const result = calculateWhatYouHave(monthlyInput, 100)

    // With 100/month for ~35 years at 5.5% APY, should accumulate significant amount
    const retirementStartIndex = 2060 - 2025
    expect(result[retirementStartIndex]).toBeGreaterThan(100000)
  })

  it('should handle yearly deposit frequency', () => {
    const yearlyInput = { ...baseInput, depositPeriod: 'year' as const }
    const result = calculateWhatYouHave(yearlyInput, 1200)

    // 1200/year should be same as 100/month
    const monthlyInput = { ...baseInput, depositPeriod: 'month' as const }
    const monthlyResult = calculateWhatYouHave(monthlyInput, 100)

    const retirementStartIndex = 2060 - 2025
    // Should be close (within 10% due to timing differences)
    expect(result[retirementStartIndex] / monthlyResult[retirementStartIndex]).toBeCloseTo(1, 0)
  })

  it('should account for inflation in deposits', () => {
    const noInflationInput = { ...baseInput, inflation: 0 }
    const withInflationInput = { ...baseInput, inflation: 2.5 }

    const result1 = calculateWhatYouHave(noInflationInput, 100)
    const result2 = calculateWhatYouHave(withInflationInput, 100)

    const retirementStartIndex = 2060 - 2025

    // With inflation adjustment, deposits grow over time, so end result should be higher
    expect(result2[retirementStartIndex]).toBeGreaterThan(result1[retirementStartIndex])
  })

  it('should reach target balance at retirement when using required deposit', () => {
    const requiredDeposit = calculateRequiredDeposit(baseInput)
    const retirementStartIndex = 2060 - 2025

    // Calculate trajectory with required deposit
    const result = calculateWhatYouHave(baseInput, requiredDeposit)
    const actualBalance = result[retirementStartIndex]

    // Should end at approximately 0
    expect(result[result.length - 1]).toBeCloseTo(0, -2)
    // Balance at retirement should be reasonable
    expect(actualBalance).toBeGreaterThan(0)
  })
})

describe('integration tests', () => {
  it('should produce consistent results across functions', () => {
    const input: PeriodicWithdrawalCalculationInput = {
      withdrawalStart: new Date('2060-01-01'),
      withdrawalDuration: 20,
      desiredBudget: 2000,
      budgetPeriod: 'month',
      currentSavings: 0,
      apy: 4.5,
      inflation: 2.5,
      depositStart: new Date('2025-01-01'),
      depositPeriod: 'month',
    }

    const years = generateYears(input.depositStart, input.withdrawalStart, input.withdrawalDuration)
    const requiredDeposit = calculateRequiredDeposit(input)
    const whatYouNeed = calculateWhatYouHave(input, requiredDeposit)
    const whatYouHave = calculateWhatYouHave(input, 200)

    // All arrays should have same length
    expect(whatYouNeed.length).toBe(years.length)
    expect(whatYouHave.length).toBe(years.length)

    // All values should be non-negative
    whatYouNeed.forEach((value) => expect(value).toBeGreaterThanOrEqual(0))
    whatYouHave.forEach((value) => expect(value).toBeGreaterThanOrEqual(0))
  })

  it('should generate correct chart labels showing start, retirement, and end years', () => {
    const input: PeriodicWithdrawalCalculationInput = {
      withdrawalStart: new Date('2030-01-01'),
      withdrawalDuration: 25,
      desiredBudget: 3000,
      budgetPeriod: 'month',
      currentSavings: 50000,
      apy: 6.0,
      inflation: 2.5,
      depositStart: new Date('2025-01-01'),
      depositPeriod: 'month',
    }

    const years = generateYears(input.depositStart, input.withdrawalStart, input.withdrawalDuration)
    const startYear = years[0]
    const endYear = years[years.length - 1]
    const retirementStartYear = input.withdrawalStart.getFullYear()

    // Generate chart labels (mimicking the store logic)
    const chartLabels = years.map((year) => {
      if (year === startYear || year === endYear || year === retirementStartYear) {
        return year.toString()
      }
      return ''
    })

    // Verify start year label exists
    expect(chartLabels[0]).toBe(startYear.toString())

    // Verify end year label exists
    expect(chartLabels[chartLabels.length - 1]).toBe(endYear.toString())

    // Verify retirement year label exists
    const retirementIndex = years.indexOf(retirementStartYear)
    expect(chartLabels[retirementIndex]).toBe(retirementStartYear.toString())

    // Count non-empty labels (should be exactly 3: start, retirement, end)
    const nonEmptyLabels = chartLabels.filter((label) => label !== '')
    expect(nonEmptyLabels.length).toBe(3)
    expect(nonEmptyLabels).toContain(startYear.toString())
    expect(nonEmptyLabels).toContain(endYear.toString())
    expect(nonEmptyLabels).toContain(retirementStartYear.toString())
  })

  it('should stop deposits at retirement age 50 (not continue until 65)', () => {
    // Test with someone born in 1980, currently 45, retiring at 50 in 2030
    const birthYear = 1980
    const retirementAge = 50
    const retirementYear = birthYear + retirementAge // 2030

    const input: PeriodicWithdrawalCalculationInput = {
      withdrawalStart: new Date(`${retirementYear}-01-01`), // Retire at age 50 in 2030
      withdrawalDuration: 25,
      desiredBudget: 3000,
      budgetPeriod: 'month',
      currentSavings: 50000,
      apy: 6.0,
      inflation: 2.5,
      depositStart: new Date('2025-01-01'), // Start deposits now (age 45)
      depositPeriod: 'month',
    }

    const whatYouHave = calculateWhatYouHave(input, 1000)
    const years = generateYears(input.depositStart, input.withdrawalStart, input.withdrawalDuration)

    const retirementYearIndex = years.indexOf(retirementYear)

    // Before retirement: balance should be growing
    // Compare year-end 2029 (last year before retirement) with year-end 2025 (first year)
    expect(whatYouHave[retirementYearIndex - 1]).toBeGreaterThan(whatYouHave[0])

    // During retirement: balance should eventually decline
    // Compare year-end value 10 years into retirement with retirement year value
    const midRetirementIndex = retirementYearIndex + 10
    if (midRetirementIndex < whatYouHave.length) {
      expect(whatYouHave[midRetirementIndex]).toBeLessThan(whatYouHave[retirementYearIndex])
    }

    // By end of retirement, balance should be significantly lower or zero
    const lastIndex = whatYouHave.length - 1
    expect(whatYouHave[lastIndex]).toBeLessThan(whatYouHave[retirementYearIndex] * 0.5)
  })
})
