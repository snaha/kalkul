import { describe, expect, test } from 'vitest'

import { CATEGORY_COLORS } from './chart-colors'
import {
  getCashTotal,
  getInvestmentsTotal,
  getLiabilitiesTotal,
  getNetWorth,
  getOverviewSegments,
  getTangibleAssetsTotal,
  getTotalAssets,
  hasAnyFinancialData,
} from './financial-totals'
import type { Profile } from './schemas'

const EMPTY_PROFILE: Profile = {
  name: '',
  email: '',
}

const POPULATED_PROFILE: Profile = {
  name: 'Alice',
  email: 'a@example.com',
  cash_amount: 4_700,
  investments: [
    { id: 'inv1', name: 'ETF', balance: 10_000, apy: 5 },
    { id: 'inv2', name: 'Crypto', balance: 2_500, apy: 10 },
  ],
  tangible_assets: [
    { id: 't1', name: 'House', value: 200_000, status: 'fully_owned' },
    { id: 't2', name: 'Car', value: 8_000, status: 'fully_owned' },
  ],
  liabilities: [
    {
      id: 'l1',
      name: 'Mortgage',
      outstanding_balance: 120_000,
      installment_frequency: 'monthly',
      annual_rate: 3,
      installment_amount: 800,
      remaining_term: 240,
    },
  ],
}

describe('getCashTotal', () => {
  test('returns 0 when cash_amount is undefined', () => {
    expect(getCashTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when cash_amount is 0', () => {
    expect(getCashTotal({ ...EMPTY_PROFILE, cash_amount: 0 })).toBe(0)
  })

  test('returns the value when cash_amount is set', () => {
    expect(getCashTotal({ ...EMPTY_PROFILE, cash_amount: 4_700 })).toBe(4_700)
  })
})

describe('getInvestmentsTotal', () => {
  test('returns 0 when investments is undefined', () => {
    expect(getInvestmentsTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when investments is empty', () => {
    expect(getInvestmentsTotal({ ...EMPTY_PROFILE, investments: [] })).toBe(0)
  })

  test('sums investment balances', () => {
    expect(getInvestmentsTotal(POPULATED_PROFILE)).toBe(12_500)
  })
})

describe('getTangibleAssetsTotal', () => {
  test('returns 0 when tangible_assets is undefined', () => {
    expect(getTangibleAssetsTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when tangible_assets is empty', () => {
    expect(getTangibleAssetsTotal({ ...EMPTY_PROFILE, tangible_assets: [] })).toBe(0)
  })

  test('sums tangible asset values', () => {
    expect(getTangibleAssetsTotal(POPULATED_PROFILE)).toBe(208_000)
  })
})

describe('getLiabilitiesTotal', () => {
  test('returns 0 when liabilities is undefined', () => {
    expect(getLiabilitiesTotal(EMPTY_PROFILE)).toBe(0)
  })

  test('returns 0 when liabilities is empty', () => {
    expect(getLiabilitiesTotal({ ...EMPTY_PROFILE, liabilities: [] })).toBe(0)
  })

  test('sums liability outstanding balances', () => {
    expect(getLiabilitiesTotal(POPULATED_PROFILE)).toBe(120_000)
  })
})

describe('getTotalAssets', () => {
  test('returns 0 when nothing is set', () => {
    expect(getTotalAssets(EMPTY_PROFILE)).toBe(0)
  })

  test('sums cash + investments + tangible assets', () => {
    expect(getTotalAssets(POPULATED_PROFILE)).toBe(4_700 + 12_500 + 208_000)
  })

  test('does not include liabilities', () => {
    const totalAssets = getTotalAssets(POPULATED_PROFILE)
    expect(totalAssets).toBe(225_200)
    expect(totalAssets).not.toBe(225_200 - 120_000)
  })
})

describe('getNetWorth', () => {
  test('returns 0 when nothing is set', () => {
    expect(getNetWorth(EMPTY_PROFILE)).toBe(0)
  })

  test('returns assets minus liabilities', () => {
    expect(getNetWorth(POPULATED_PROFILE)).toBe(225_200 - 120_000)
  })

  test('can be negative when liabilities exceed assets', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 1_000,
      liabilities: [
        {
          id: 'l1',
          name: 'Loan',
          outstanding_balance: 5_000,
          installment_frequency: 'monthly',
          annual_rate: 5,
          installment_amount: 100,
          remaining_term: 60,
        },
      ],
    }
    expect(getNetWorth(profile)).toBe(-4_000)
  })
})

describe('getOverviewSegments', () => {
  test('returns empty array for an empty profile', () => {
    expect(getOverviewSegments(EMPTY_PROFILE)).toEqual([])
  })

  test('omits zero-value segments', () => {
    const profile: Profile = { ...EMPTY_PROFILE, cash_amount: 0, investments: [] }
    expect(getOverviewSegments(profile)).toEqual([])
  })

  test('includes only non-zero categories', () => {
    const profile: Profile = { ...EMPTY_PROFILE, cash_amount: 100 }
    const segments = getOverviewSegments(profile)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({ label: 'cash', value: 100, color: CATEGORY_COLORS.cash })
  })

  test('returns all four category segments when all are populated', () => {
    const segments = getOverviewSegments(POPULATED_PROFILE)
    expect(segments.map((s) => s.label)).toEqual([
      'cash',
      'investments',
      'tangible-assets',
      'liabilities',
    ])
    expect(segments.map((s) => s.value)).toEqual([4_700, 12_500, 208_000, 120_000])
  })
})

describe('hasAnyFinancialData', () => {
  test('returns false for an empty profile', () => {
    expect(hasAnyFinancialData(EMPTY_PROFILE)).toBe(false)
  })

  test('returns false when all values are zero', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      cash_amount: 0,
      investments: [{ id: 'i', name: 'x', balance: 0, apy: 0 }],
      tangible_assets: [{ id: 't', name: 'x', value: 0, status: 'fully_owned' }],
      liabilities: [
        {
          id: 'l',
          name: 'x',
          outstanding_balance: 0,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 0,
          remaining_term: 0,
        },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(false)
  })

  test('returns true when cash is positive', () => {
    expect(hasAnyFinancialData({ ...EMPTY_PROFILE, cash_amount: 1 })).toBe(true)
  })

  test('returns true when at least one investment has a positive balance', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      investments: [
        { id: 'i1', name: 'x', balance: 0, apy: 0 },
        { id: 'i2', name: 'y', balance: 1, apy: 0 },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })

  test('returns true when at least one tangible asset has a positive value', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      tangible_assets: [{ id: 't', name: 'x', value: 1, status: 'fully_owned' }],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })

  test('returns true when at least one liability has a positive outstanding balance', () => {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      liabilities: [
        {
          id: 'l',
          name: 'x',
          outstanding_balance: 1,
          installment_frequency: 'monthly',
          annual_rate: 0,
          installment_amount: 0,
          remaining_term: 0,
        },
      ],
    }
    expect(hasAnyFinancialData(profile)).toBe(true)
  })
})
