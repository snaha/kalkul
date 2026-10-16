import { describe, expect, test } from 'vitest'

import { getRecordedYears } from './recorded-years'
import type { Profile, Snapshot } from './schemas'

// A plan starting in October 2026, with no inflation unless a test sets one.
const PLAN = { start_date: '2026-10-01', inflation_rate: 0 }

const PROFILE: Profile = {
  name: 'Test',
  email: '',
  cash_amount: 50_000,
  investments: [
    { id: 'fund', name: 'Fund', balance: 1_200_000, apy: 5 },
    { id: 'pension', name: 'Pension', balance: 80_000, apy: 4 },
  ],
  tangible_assets: [
    { id: 'flat', name: 'Flat', value: 6_000_000, status: 'fully_owned' },
    {
      id: 'house',
      name: 'House',
      value: 10_000_000,
      status: 'financed',
      outstanding_balance: 8_000_000,
      installment_frequency: 'monthly',
      annual_rate: 4.5,
      installment_amount: 50_000,
      remaining_term: 300,
      remaining_term_unit: 'months',
    },
  ],
  liabilities: [
    {
      id: 'car-loan',
      name: 'Car loan',
      outstanding_balance: 200_000,
      installment_frequency: 'monthly',
      annual_rate: 6,
      installment_amount: 10_000,
      remaining_term: 24,
      remaining_term_unit: 'months',
    },
  ],
  incomes: [
    {
      id: 'salary',
      name: 'Salary',
      amount: 100_000,
      schedule: 'recurring',
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
  expenses: [
    {
      id: 'living',
      name: 'Living',
      amount: 40_000,
      schedule: 'recurring',
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
    },
  ],
}

/** Every balance and flow of the profile, at the given figures. */
function snapshot(date: string, scale = 1): Snapshot {
  return {
    date,
    cash_amount: 50_000 * scale,
    investments: [
      { id: 'fund', balance: 1_000_000 * scale },
      { id: 'pension', balance: 60_000 * scale },
    ],
    tangible_assets: [
      { id: 'flat', value: 5_500_000 * scale },
      {
        id: 'house',
        value: 10_000_000 * scale,
        outstanding_balance: 8_100_000 * scale,
        remaining_term: 310,
        remaining_term_unit: 'months',
      },
    ],
    liabilities: [{ id: 'car-loan', outstanding_balance: 300_000 * scale, remaining_term: 30 }],
    incomes: [{ id: 'salary', amount: 90_000, frequency: 'monthly' }],
    expenses: [{ id: 'living', amount: 35_000, frequency: 'monthly' }],
  }
}

const withSnapshots = (...snapshots: Snapshot[]): Profile => ({ ...PROFILE, snapshots })
const yearsOf = (profile: Profile, plan = PLAN) =>
  getRecordedYears(profile, plan).map((y) => [y.year, y.recordedOn])

describe('getRecordedYears', () => {
  test('is empty without snapshots', () => {
    expect(getRecordedYears(PROFILE, PLAN)).toEqual([])
  })

  test('a snapshot dated 1 January records the year before', () => {
    expect(yearsOf(withSnapshots(snapshot('2026-01-01')))).toEqual([[2025, '2026-01-01']])
  })

  test('takes the latest snapshot of each year', () => {
    const profile = withSnapshots(
      snapshot('2024-06-30'),
      snapshot('2025-04-01'),
      snapshot('2025-10-01'),
    )
    expect(yearsOf(profile)).toEqual([
      [2024, '2024-06-30'],
      [2025, '2025-10-01'],
    ])
  })

  test("leaves the plan's own years to the projection", () => {
    const profile = withSnapshots(snapshot('2025-07-01'), snapshot('2026-04-01'))
    expect(yearsOf(profile)).toEqual([[2025, '2025-07-01']])
  })

  test('stops at the first year without a snapshot', () => {
    const profile = withSnapshots(snapshot('2022-12-01'), snapshot('2025-07-01'))
    expect(yearsOf(profile)).toEqual([[2025, '2025-07-01']])
  })

  test('is empty when the year before the plan has no snapshot', () => {
    expect(getRecordedYears(withSnapshots(snapshot('2024-07-01')), PLAN)).toEqual([])
  })

  test('splits the recorded figures into the categories the projection uses', () => {
    const [year] = getRecordedYears(withSnapshots(snapshot('2025-10-01')), PLAN)
    expect(year).toEqual({
      year: 2025,
      recordedOn: '2025-10-01',
      cash: 50_000,
      investments: 1_060_000,
      tangibleAssets: 15_500_000,
      // The house's mortgage and the standalone loan.
      liabilities: 8_400_000,
      netWorth: 8_210_000,
      investmentsByItem: [
        { id: 'fund', name: 'Fund', value: 1_000_000 },
        { id: 'pension', name: 'Pension', value: 60_000 },
      ],
      tangibleAssetsByItem: [
        { id: 'flat', name: 'Flat', value: 5_500_000 },
        { id: 'house', name: 'House', value: 10_000_000 },
      ],
      // Like the projection, only standalone liabilities are listed; a
      // financed asset's debt is part of the asset.
      liabilitiesByItem: [{ id: 'car-loan', name: 'Car loan', value: 300_000 }],
      // The flows running on the date, annualized.
      totalIncome: 1_080_000,
      totalExpenses: 420_000,
      // (50,000 + 1,060,000 − 300,000) / ((420,000 + 600,000 + 120,000) × 25)
      fiPercent: 2.8421052631578947,
      runwayYears: 0.7105263157894737,
      insufficientFundTransferIds: [],
      insufficientFundAssetIds: [],
      insufficientFundExpenseIds: [],
    })
  })

  test("states each year in the plan's starting money", () => {
    const profile = withSnapshots(snapshot('2024-12-01'), snapshot('2025-12-01'))
    const years = getRecordedYears(profile, { ...PLAN, inflation_rate: 0.02 })
    // One year back is worth 2 % more in 2026 money, two years back 4.04 %.
    expect(years.map((y) => [y.year, y.cash, y.netWorth, y.totalIncome])).toEqual([
      [2024, 52_020, 8_541_684, 1_123_632],
      [2025, 51_000, 8_374_200, 1_101_600],
    ])
    expect(years[0].investmentsByItem[0].value).toEqual(1_040_400)
  })

  test('keeps an item the profile has since dropped, without a name', () => {
    const profile = withSnapshots({
      ...snapshot('2025-10-01'),
      investments: [{ id: 'sold-fund', balance: 70_000 }],
    })
    const [year] = getRecordedYears(profile, PLAN)
    expect(year.investments).toEqual(70_000)
    expect(year.investmentsByItem).toEqual([{ id: 'sold-fund', name: '', value: 70_000 }])
  })
})
