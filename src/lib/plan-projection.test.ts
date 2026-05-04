import { describe, expect, it } from 'vitest'

import { getYearlyPlanProjection } from './plan-projection'
import type {
  Expense,
  Income,
  PortfolioNested,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
} from './schemas'

function makePlan(overrides: Partial<PortfolioNested> = {}): PortfolioNested {
  return {
    id: 'plan-1',
    name: 'Test plan',
    currency: 'CZK',
    start_date: '2025-01-01',
    end_date: '2030-01-01',
    inflation_rate: 0,
    investments: [],
    goals: [],
    ...overrides,
  }
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: 'Test',
    email: 'test@example.com',
    ...overrides,
  }
}

describe('getYearlyPlanProjection', () => {
  it('returns one entry per year from start_date.year through end_date.year inclusive', () => {
    const result = getYearlyPlanProjection(makePlan(), makeProfile())
    expect(result.map((r) => r.year)).toEqual([2025, 2026, 2027, 2028, 2029, 2030])
  })

  it('returns all zeros for an empty profile', () => {
    const result = getYearlyPlanProjection(makePlan(), makeProfile())
    for (const entry of result) {
      expect(entry.cash).toBe(0)
      expect(entry.investments).toBe(0)
      expect(entry.tangibleAssets).toBe(0)
      expect(entry.liabilities).toBe(0)
      expect(entry.netWorth).toBe(0)
    }
  })

  it('puts profile.cash_amount into year-0 cash when no flows are present', () => {
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ cash_amount: 1000 }))
    expect(result[0].cash).toBeCloseTo(1000, 6)
    expect(result[result.length - 1].cash).toBeCloseTo(1000, 6)
  })

  it('respects include_cash = false', () => {
    const result = getYearlyPlanProjection(
      makePlan({ include_cash: false }),
      makeProfile({ cash_amount: 1000 }),
    )
    expect(result[0].cash).toBe(0)
  })

  it('compounds investments at apy (stored as percent) each year', () => {
    const investments: ProfileInvestment[] = [{ id: 'i1', name: 'Stocks', balance: 1000, apy: 10 }]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ investments }))
    expect(result[0].investments).toBeCloseTo(1000, 6)
    expect(result[1].investments).toBeCloseTo(1100, 6)
    expect(result[2].investments).toBeCloseTo(1210, 6)
    expect(result[5].investments).toBeCloseTo(1000 * Math.pow(1.1, 5), 4)
  })

  it('keeps real investment value flat when apy == inflation', () => {
    const investments: ProfileInvestment[] = [{ id: 'i1', name: 'Stocks', balance: 1000, apy: 5 }]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ investments }),
    )
    for (const entry of result) {
      expect(entry.investments).toBeCloseTo(1000, 0)
    }
  })

  it('treats remaining_term as years (multiplies by periods-per-year)', () => {
    // 1-year monthly loan: 12 periods of 100 each, no interest = pays off 1200.
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 1200,
        installment_frequency: 'monthly',
        annual_rate: 0,
        installment_amount: 100,
        remaining_term: 1,
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ liabilities }))
    expect(result[0].liabilities).toBeCloseTo(0, 6)
  })

  it('treats annual_rate as a percentage (e.g. 6 → 6 %)', () => {
    // Fixed-rate loan: 12 monthly installments at 6 % annual, balance ~ amortized exactly.
    // With principal P, monthly rate r=0.005, n=12, payment = P*r/(1-(1+r)^-n).
    const principal = 12000
    const monthlyRate = 0.005
    const n = 12
    const payment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n))
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: principal,
        installment_frequency: 'monthly',
        annual_rate: 6,
        installment_amount: payment,
        remaining_term: 1,
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ liabilities }))
    expect(result[0].liabilities).toBeCloseTo(0, 4)
  })

  it('amortizes a yearly-installment liability down to zero', () => {
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 1000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 250,
        remaining_term: 4,
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ liabilities }))
    expect(result[0].liabilities).toBeCloseTo(750, 6)
    expect(result[1].liabilities).toBeCloseTo(500, 6)
    expect(result[2].liabilities).toBeCloseTo(250, 6)
    expect(result[3].liabilities).toBeCloseTo(0, 6)
    expect(result[4].liabilities).toBeCloseTo(0, 6)
  })

  it('subtracts liability payments from cash each year', () => {
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 1000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 250,
        remaining_term: 4,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 1000, liabilities }),
    )
    expect(result[0].cash).toBeCloseTo(750, 6)
    expect(result[1].cash).toBeCloseTo(500, 6)
    expect(result[2].cash).toBeCloseTo(250, 6)
    expect(result[3].cash).toBeCloseTo(0, 6)
    expect(result[4].cash).toBeCloseTo(0, 6)
  })

  it('accumulates yearly net cash flow from incomes and expenses', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1000,
        frequency: 'monthly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Rent',
        amount: 500,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ incomes, expenses }))
    // Net annual = (1000 - 500) * 12 = 6000
    expect(result[0].cash).toBeCloseTo(6000, 6)
    expect(result[1].cash).toBeCloseTo(12000, 6)
    expect(result[5].cash).toBeCloseTo(36000, 6)
  })

  it('applies tax withholding on incomes', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1000,
        frequency: 'yearly',
        withhold_taxes: true,
        tax_percentage: 20,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ incomes }))
    expect(result[0].cash).toBeCloseTo(800, 6)
    expect(result[1].cash).toBeCloseTo(1600, 6)
  })

  it('grows real income with inflation when change_over_time = match_inflation', () => {
    const baseline = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0 }),
      makeProfile({
        incomes: [
          {
            id: 'inc1',
            name: 'Salary',
            amount: 1000,
            frequency: 'yearly',
            withhold_taxes: false,
            start: 'immediately',
            end: 'never',
            change_over_time: 'none',
          },
        ],
      }),
    )
    const matched = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({
        incomes: [
          {
            id: 'inc1',
            name: 'Salary',
            amount: 1000,
            frequency: 'yearly',
            withhold_taxes: false,
            start: 'immediately',
            end: 'never',
            change_over_time: 'match_inflation',
          },
        ],
      }),
    )
    // First year: same real income.
    expect(matched[0].cash).toBeCloseTo(baseline[0].cash, 0)
    // Later years: accumulated cash erodes vs the inflation-free baseline,
    // so matched < baseline in real terms, but still grows.
    expect(matched[5].cash).toBeLessThan(baseline[5].cash)
    expect(matched[5].cash).toBeGreaterThan(matched[0].cash)
  })

  it('honors when_age_is start with birth_date', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Pension',
        amount: 1200,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'when_age_is',
        start_age: 65,
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const profile = makeProfile({ birth_date: '1965-06-01', incomes })
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2035-01-01' }),
      profile,
    )
    // birthYear=1965, start_age=65 → starts at 2030
    const before = result.find((r) => r.year === 2029)
    const at = result.find((r) => r.year === 2030)
    const after = result.find((r) => r.year === 2031)
    expect(before?.cash).toBeCloseTo(0, 6)
    expect(at?.cash).toBeCloseTo(1200, 6)
    expect(after?.cash).toBeCloseTo(2400, 6)
  })

  it('honors at_specific_date end on expenses', () => {
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Daycare',
        amount: 1000,
        frequency: 'yearly',
        start: 'immediately',
        end: 'at_specific_date',
        end_year: 2027,
        end_month: 12,
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2030-01-01' }),
      makeProfile({ cash_amount: 10000, expenses }),
    )
    // 2025, 2026, 2027 → -3 * 1000 = -3000; 2028+ stays flat
    const at2027 = result.find((r) => r.year === 2027)
    const at2028 = result.find((r) => r.year === 2028)
    const at2029 = result.find((r) => r.year === 2029)
    expect(at2027?.cash).toBeCloseTo(7000, 6)
    expect(at2028?.cash).toBeCloseTo(7000, 6)
    expect(at2029?.cash).toBeCloseTo(7000, 6)
  })

  it('prorates the start year by start_month for at_specific_date', () => {
    // Salary starts in June 2025: 7 months active (Jun..Dec) → 7/12 of annual.
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1200,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'at_specific_date',
        start_year: 2025,
        start_month: 6,
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2027-01-01' }),
      makeProfile({ incomes }),
    )
    expect(result[0].cash).toBeCloseTo(1200 * (7 / 12), 6)
    expect(result[1].cash).toBeCloseTo(1200 * (7 / 12) + 1200, 6)
    expect(result[2].cash).toBeCloseTo(1200 * (7 / 12) + 2 * 1200, 6)
  })

  it('prorates the end year by end_month for at_specific_date', () => {
    // Expense ends March 2027: 3 months active (Jan..Mar) in 2027.
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Daycare',
        amount: 1200,
        frequency: 'yearly',
        start: 'immediately',
        end: 'at_specific_date',
        end_year: 2027,
        end_month: 3,
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2029-01-01' }),
      makeProfile({ cash_amount: 10000, expenses }),
    )
    // 2025: -1200, 2026: -1200, 2027: -1200*3/12 = -300, 2028+: flat.
    expect(result[0].cash).toBeCloseTo(10000 - 1200, 6)
    expect(result[1].cash).toBeCloseTo(10000 - 2400, 6)
    expect(result[2].cash).toBeCloseTo(10000 - 2400 - 300, 6)
    expect(result[3].cash).toBeCloseTo(10000 - 2400 - 300, 6)
    expect(result[4].cash).toBeCloseTo(10000 - 2400 - 300, 6)
  })

  it('prorates a flow that starts and ends within the same year', () => {
    // Expense from April through September 2026: 6 months → 6/12 of annual.
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Course',
        amount: 1200,
        frequency: 'yearly',
        start: 'at_specific_date',
        start_year: 2026,
        start_month: 4,
        end: 'at_specific_date',
        end_year: 2026,
        end_month: 9,
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2028-01-01' }),
      makeProfile({ cash_amount: 10000, expenses }),
    )
    // Only 2026 has any expense activity; 6/12 * 1200 = 600.
    expect(result[0].cash).toBeCloseTo(10000, 6) // 2025
    expect(result[1].cash).toBeCloseTo(10000 - 600, 6) // 2026
    expect(result[2].cash).toBeCloseTo(10000 - 600, 6) // 2027
    expect(result[3].cash).toBeCloseTo(10000 - 600, 6) // 2028
  })

  it('treats start_month=1 / end_month=12 as full-year activity (no proration)', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1200,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'at_specific_date',
        start_year: 2025,
        start_month: 1,
        end: 'at_specific_date',
        end_year: 2026,
        end_month: 12,
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2027-01-01' }),
      makeProfile({ incomes }),
    )
    expect(result[0].cash).toBeCloseTo(1200, 6) // 2025: full year
    expect(result[1].cash).toBeCloseTo(2400, 6) // 2026: full year
    expect(result[2].cash).toBeCloseTo(2400, 6) // 2027: ended
  })

  it('filters by included_*_ids when set on the plan', () => {
    const investments: ProfileInvestment[] = [
      { id: 'a', name: 'A', balance: 100, apy: 0 },
      { id: 'b', name: 'B', balance: 200, apy: 0 },
    ]
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'L1',
        outstanding_balance: 500,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 100,
        remaining_term: 5,
      },
      {
        id: 'l2',
        name: 'L2',
        outstanding_balance: 999,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 100,
        remaining_term: 5,
      },
    ]
    const plan = makePlan({
      included_investment_ids: ['a'],
      included_liability_ids: ['l1'],
    })
    const result = getYearlyPlanProjection(plan, makeProfile({ investments, liabilities }))
    expect(result[0].investments).toBeCloseTo(100, 6)
    expect(result[0].liabilities).toBeCloseTo(400, 6)
  })

  it('keeps tangible assets constant at the sum of included values', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 't1', name: 'House', value: 5_000_000, status: 'fully_owned' },
      { id: 't2', name: 'Car', value: 500_000, status: 'fully_owned' },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ tangible_assets }))
    for (const entry of result) {
      expect(entry.tangibleAssets).toBe(5_500_000)
    }
  })

  it('keeps tangible-asset real value constant under nonzero inflation', () => {
    // Locks in interpretation A: tangibles passively track inflation, so the
    // chart's real-terms value equals the user-entered amount in every year.
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 't1', name: 'House', value: 5_000_000, status: 'fully_owned' },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ tangible_assets }),
    )
    for (const entry of result) {
      expect(entry.tangibleAssets).toBe(5_000_000)
    }
  })

  it('treats a financed tangible asset as a liability for net-worth purposes', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      {
        id: 't1',
        name: 'House',
        value: 5_000_000,
        status: 'financed',
        outstanding_balance: 3_000_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 300_000,
        remaining_term: 10,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 300_000, tangible_assets }),
    )
    // Year 0: gross 5M asset, 300k installment paid → outstanding 2.7M, cash 0.
    expect(result[0].tangibleAssets).toBe(5_000_000)
    expect(result[0].liabilities).toBeCloseTo(2_700_000, 6)
    expect(result[0].cash).toBeCloseTo(0, 6)
    expect(result[0].netWorth).toBeCloseTo(5_000_000 - 2_700_000, 6)
  })

  it('amortizes a financed tangible asset year-by-year and draws payments from cash', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      {
        id: 't1',
        name: 'House',
        value: 5_000_000,
        status: 'financed',
        outstanding_balance: 1_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 250,
        remaining_term: 4,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 1000, tangible_assets }),
    )
    expect(result[0].liabilities).toBeCloseTo(750, 6)
    expect(result[1].liabilities).toBeCloseTo(500, 6)
    expect(result[2].liabilities).toBeCloseTo(250, 6)
    expect(result[3].liabilities).toBeCloseTo(0, 6)
    expect(result[0].cash).toBeCloseTo(750, 6)
    expect(result[3].cash).toBeCloseTo(0, 6)
  })

  it('drops a financed tangible asset (and its mortgage) when excluded via included_tangible_asset_ids', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      {
        id: 't1',
        name: 'House',
        value: 5_000_000,
        status: 'financed',
        outstanding_balance: 3_000_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 300_000,
        remaining_term: 10,
      },
    ]
    const plan = makePlan({ included_tangible_asset_ids: [] })
    const result = getYearlyPlanProjection(plan, makeProfile({ tangible_assets }))
    expect(result[0].tangibleAssets).toBe(0)
    expect(result[0].liabilities).toBe(0)
  })

  it('does not synthesize a liability for a fully-owned tangible asset', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 't1', name: 'House', value: 5_000_000, status: 'fully_owned' },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ tangible_assets }))
    for (const entry of result) {
      expect(entry.liabilities).toBe(0)
      expect(entry.tangibleAssets).toBe(5_000_000)
    }
  })

  it('computes netWorth = cash + investments + tangibleAssets - liabilities', () => {
    const investments: ProfileInvestment[] = [{ id: 'i1', name: 'I', balance: 1000, apy: 0 }]
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'L',
        outstanding_balance: 200,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 50,
        remaining_term: 4,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 100, investments, liabilities }),
    )
    for (const entry of result) {
      expect(entry.netWorth).toBeCloseTo(
        entry.cash + entry.investments + entry.tangibleAssets - entry.liabilities,
        6,
      )
    }
  })

  it('preserves netWorth = cash + investments + tangibleAssets - liabilities under nonzero inflation', () => {
    // Unit-consistency invariant: even when cash/investments/liabilities go
    // through the deflation pipeline and tangibles stay at their entered value,
    // netWorth must equal the simple sum of the displayed components.
    const investments: ProfileInvestment[] = [{ id: 'i1', name: 'I', balance: 1000, apy: 5 }]
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'L',
        outstanding_balance: 200,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 50,
        remaining_term: 4,
      },
    ]
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 't1', name: 'House', value: 5_000_000, status: 'fully_owned' },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ cash_amount: 100, investments, liabilities, tangible_assets }),
    )
    for (const entry of result) {
      expect(entry.netWorth).toBeCloseTo(
        entry.cash + entry.investments + entry.tangibleAssets - entry.liabilities,
        6,
      )
    }
  })
})
