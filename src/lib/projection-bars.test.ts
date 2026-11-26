import { describe, expect, it } from 'vitest'

import type { YearlyProjection } from './plan-projection'
import { projectionBars } from './projection-bars'

function year(y: number, cash: number): YearlyProjection {
  return {
    year: y,
    cash,
    investments: 2,
    tangibleAssets: 3,
    liabilities: 4,
    netWorth: cash + 1,
    investmentsByItem: [],
    tangibleAssetsByItem: [],
    liabilitiesByItem: [],
    totalIncome: 0,
    totalExpenses: 0,
    incomesByItem: [],
    expensesByItem: [],
    propertyTaxByItem: [],
    installmentsByItem: [],
    totalInstallments: 0,
    investmentFeesByItem: [],
    transferTaxByItem: [],
    cashFlow: 0,
    transfersByItem: [],
    portfolioValue: 0,
    insufficientFundTransferIds: [],
    insufficientFundAssetIds: [],
    insufficientFundExpenseIds: [],
    insufficientFundLiabilityIds: [],
  }
}

describe('projectionBars', () => {
  it('maps each projected year to a bar', () => {
    expect(projectionBars([year(2025, 10), year(2026, 20)])).toEqual([
      { year: 2025, cash: 10, investments: 2, tangibleAssets: 3, liabilities: 4 },
      { year: 2026, cash: 20, investments: 2, tangibleAssets: 3, liabilities: 4 },
    ])
  })

  it('pads a projection that stopped early with empty bars up to the end year', () => {
    expect(projectionBars([year(2025, 10)], 2027)).toEqual([
      { year: 2025, cash: 10, investments: 2, tangibleAssets: 3, liabilities: 4 },
      { year: 2026, cash: 0, investments: 0, tangibleAssets: 0, liabilities: 0 },
      { year: 2027, cash: 0, investments: 0, tangibleAssets: 0, liabilities: 0 },
    ])
  })

  it('adds nothing to a projection that reached the end year, or to an empty one', () => {
    expect(projectionBars([year(2025, 10)], 2025)).toHaveLength(1)
    expect(projectionBars([], 2030)).toEqual([])
  })
})
