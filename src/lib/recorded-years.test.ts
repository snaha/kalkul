import { describe, expect, test } from 'vitest'

import {
  differenceFromPlan,
  differencesFromPlan,
  getRecordedPlanSamples,
  getRecordedSamples,
  latestOfEachYear,
  yearPosition,
} from './recorded-years'
import type { Profile, Snapshot } from './schemas'

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

describe('yearPosition', () => {
  test('puts 1 January on the year itself', () => {
    expect(yearPosition('2025-01-01')).toEqual(2025)
  })

  test('puts a date as far into its year as it falls', () => {
    expect(yearPosition('2025-07-02')).toEqual(2025.4986301369863)
    // 2024 is a leap year: 2 July is its 184th day.
    expect(yearPosition('2024-07-02')).toEqual(2024.5)
  })
})

describe('getRecordedPlanSamples', () => {
  // A plan running from March 2024 to 2030, with no inflation unless a test sets one.
  const SAVED_PLAN = { start_date: '2024-03-01', end_date: '2030-01-01', inflation_rate: 0 }
  const samplesOf = (profile: Profile, plan = SAVED_PLAN) =>
    getRecordedPlanSamples(profile, plan).map((s) => [s.recordedOn, s.year, s.position])

  test('is empty without snapshots', () => {
    expect(getRecordedPlanSamples(PROFILE, SAVED_PLAN)).toEqual([])
  })

  test('keeps every snapshot since the plan started, where it falls in time', () => {
    const profile = withSnapshots(
      snapshot('2024-07-02'),
      snapshot('2024-11-01'),
      snapshot('2026-01-01'),
    )
    expect(samplesOf(profile)).toEqual([
      ['2024-07-02', 2024, 2024.5],
      ['2024-11-01', 2024, 2024.8333333333333],
      // 1 January closes the year before, at the end of that year's bar.
      ['2026-01-01', 2025, 2026],
    ])
  })

  test('leaves out snapshots from before the plan started, even in its first year', () => {
    const profile = withSnapshots(
      snapshot('2023-12-01'),
      snapshot('2024-02-01'),
      snapshot('2024-03-01'),
    )
    expect(samplesOf(profile)).toEqual([])
  })

  test('leaves out snapshots from after the plan ends', () => {
    const profile = withSnapshots(snapshot('2030-06-01'), snapshot('2031-02-01'))
    expect(samplesOf(profile).map(([date]) => date)).toEqual(['2030-06-01'])
  })

  test('splits the recorded figures into the categories the projection uses', () => {
    const [sample] = getRecordedPlanSamples(withSnapshots(snapshot('2024-10-01')), SAVED_PLAN)
    expect(sample).toMatchObject({
      year: 2024,
      recordedOn: '2024-10-01',
      cash: 50_000,
      investments: 1_060_000,
      tangibleAssets: 15_500_000,
      liabilities: 8_400_000,
      netWorth: 8_210_000,
    })
  })

  test("states each snapshot in the plan's starting money as of its date", () => {
    const profile = withSnapshots(
      { ...snapshot('2026-01-01'), cash_amount: 51_000 },
      snapshot('2027-01-01'),
      snapshot('2025-07-02'),
    )
    const samples = getRecordedPlanSamples(profile, { ...SAVED_PLAN, inflation_rate: 0.02 })
    // The projection deflates the end of a year n years after the plan's
    // first by 1.02^n; a snapshot in between by the fraction of the way it is.
    expect(samples.map((s) => [s.recordedOn, s.cash, s.netWorth])).toEqual([
      ['2025-07-02', 49_508.72014806039, 8_129_331.8483115155],
      ['2026-01-01', 50_000, 8_050_000],
      ['2027-01-01', 48_058.43906189927, 7_891_195.69396386],
    ])
    expect(samples[1].investmentsByItem[0].value).toEqual(980_392.1568627451)
  })
})

describe('getRecordedSamples', () => {
  test('keeps every snapshot, those before the plan in its starting money too', () => {
    const profile = withSnapshots(
      { ...snapshot('2025-01-01'), cash_amount: 50_000 },
      snapshot('2026-08-01'),
      snapshot('2026-11-01'),
    )
    const samples = getRecordedSamples(profile, {
      start_date: '2026-10-01',
      inflation_rate: 0.02,
    })
    // 1 January 2025 is two years before the end of the plan's first year.
    expect(samples.map((s) => [s.recordedOn, s.year, s.position])).toEqual([
      ['2025-01-01', 2024, 2025],
      ['2026-08-01', 2026, 2026.5808219178082],
      ['2026-11-01', 2026, 2026.8328767123287],
    ])
    expect(samples[0].cash).toEqual(52_020)
  })
})

describe('latestOfEachYear', () => {
  test('takes the latest sample of each year and skips years without one', () => {
    const profile = withSnapshots(
      snapshot('2024-06-30'),
      snapshot('2024-11-01'),
      snapshot('2026-02-01'),
    )
    const samples = getRecordedPlanSamples(profile, {
      start_date: '2024-03-01',
      end_date: '2030-01-01',
      inflation_rate: 0,
    })
    expect(latestOfEachYear(samples).map((y) => [y.year, y.recordedOn])).toEqual([
      [2024, '2024-11-01'],
      [2026, '2026-02-01'],
    ])
  })
})

describe('differenceFromPlan', () => {
  test('is what was recorded less what the plan projected', () => {
    expect(differenceFromPlan(1_400_000, 1_550_000)).toEqual({
      amount: -150_000,
      percent: -9.67741935483871,
    })
    expect(differenceFromPlan(1_600_000, 1_550_000).amount).toEqual(50_000)
  })

  test('measures the percentage against the size of a negative plan', () => {
    expect(differenceFromPlan(-50_000, -100_000)).toEqual({ amount: 50_000, percent: 50 })
  })

  test('has no percentage when the plan projected nothing', () => {
    expect(differenceFromPlan(20_000, 0)).toEqual({ amount: 20_000, percent: undefined })
  })
})

describe('differencesFromPlan', () => {
  test('holds each recorded category against the plan', () => {
    const planned = {
      cash: 50_000,
      investments: 200_000,
      tangibleAssets: 600_000,
      liabilities: 100_000,
    }
    const recorded = {
      cash: 40_000,
      investments: 250_000,
      tangibleAssets: 600_000,
      liabilities: 120_000,
    }
    expect(differencesFromPlan(recorded, planned)).toEqual({
      cash: { amount: -10_000, percent: -20 },
      investments: { amount: 50_000, percent: 25 },
      tangibleAssets: { amount: 0, percent: 0 },
      // More debt than planned is behind the plan, like less of an asset.
      liabilities: { amount: -20_000, percent: -20 },
    })
  })
})
