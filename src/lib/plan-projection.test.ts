import { describe, expect, it, vi } from 'vitest'

import { getYearlyPlanProjection } from './plan-projection'
import type {
  Expense,
  Income,
  Portfolio,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
  Transfer,
} from './schemas'

function makePlan(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'plan-1',
    name: 'Test plan',
    start_date: '2025-01-01',
    end_date: '2030-01-01',
    inflation_rate: 0,
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

  it('keeps cash at 0 over time when include_cash = false even with cash flows and liabilities', () => {
    // Regression for the leak: previously, income/expense/liability payments
    // accumulated into a zeroed cash balance, producing negative bars.
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
      makePlan({ include_cash: false }),
      makeProfile({ cash_amount: 1000, incomes, liabilities }),
    )
    for (const entry of result) {
      expect(entry.cash).toBe(0)
    }
  })

  it('keeps cash at 0 with a financed tangible asset when include_cash = false', () => {
    // Same root cause: mortgage payment was draining a zeroed cash balance.
    // Equity must still be correct (asset gross − mortgage outstanding).
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
      makePlan({ include_cash: false }),
      makeProfile({ tangible_assets }),
    )
    for (const entry of result) {
      expect(entry.cash).toBe(0)
    }
    // Mortgage still amortizes; tangible asset gross unchanged.
    expect(result[0].tangibleAssets).toBe(5_000_000)
    expect(result[0].liabilities).toBeCloseTo(2_700_000, 6)
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
      // Integer-year deflation makes this exact (no leap-year drift).
      expect(entry.investments).toBeCloseTo(1000, 6)
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

  it('clears an under-amortizing liability via a balloon on the final installment', () => {
    // Installment of 200 leaves 200 unpaid after 4 yearly installments at 0%
    // (1000 - 4*200 = 200). The final installment must balloon up to clear it.
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 1000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 200,
        remaining_term: 4,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ start_date: '2025-01-01', end_date: '2032-01-01' }),
      makeProfile({ liabilities, cash_amount: 2000 }),
    )
    expect(result[0].liabilities).toBeCloseTo(800, 6)
    expect(result[1].liabilities).toBeCloseTo(600, 6)
    expect(result[2].liabilities).toBeCloseTo(400, 6)
    // Year 3 is the final scheduled installment: balloon of 400 clears it.
    expect(result[3].liabilities).toBeCloseTo(0, 6)
    expect(result[4].liabilities).toBeCloseTo(0, 6)
    expect(result[7].liabilities).toBeCloseTo(0, 6)
    // Cash drained by 4*200 + balloon (no extra over the contractual schedule:
    // year 3 pays 400 instead of 200), so total paid = 200+200+200+400 = 1000.
    expect(result[3].cash).toBeCloseTo(2000 - 1000, 6)
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

  it("anchors start='now' to the real-world current month at projection time", () => {
    // Freeze current time so the test is deterministic. Project a yearly
    // income starting "now" → activeMonthFraction uses the current month.
    vi.setSystemTime(new Date('2027-04-15'))
    try {
      const incomes: Income[] = [
        {
          id: 'inc1',
          name: 'Salary',
          amount: 1200,
          frequency: 'yearly',
          withhold_taxes: false,
          start: 'now',
          end: 'never',
          change_over_time: 'none',
        },
      ]
      const result = getYearlyPlanProjection(
        makePlan({ start_date: '2025-01-01', end_date: '2030-01-01' }),
        makeProfile({ incomes }),
      )
      // Pre-"now" years are inactive; cash stays 0.
      expect(result[0].cash).toBeCloseTo(0, 6) // 2025
      expect(result[1].cash).toBeCloseTo(0, 6) // 2026
      // 2027: 9 months active (Apr..Dec) → 9/12 * 1200 = 900.
      expect(result[2].cash).toBeCloseTo(900, 6)
      // 2028: full year, accumulates.
      expect(result[3].cash).toBeCloseTo(900 + 1200, 6)
    } finally {
      vi.useRealTimers()
    }
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

  it('annualizes a weekly income at 365.25/7 weeks per year (not 52)', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Stipend',
        amount: 100,
        frequency: 'weekly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ incomes }))
    const expectedYearly = 100 * (365.25 / 7) // ≈ 5217.857…
    expect(result[0].cash).toBeCloseTo(expectedYearly, 6)
    expect(result[1].cash).toBeCloseTo(2 * expectedYearly, 6)
  })

  it('clamps decrease_yearly change_percentage at 100 % (no negative growth factor)', () => {
    // change_percentage > 100 with decrease_yearly used to make `1 - pct/100`
    // negative, which oscillates sign across integer year exponents.
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Subscription',
        amount: 1200,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'decrease_yearly',
        change_percentage: 150,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 10000, expenses }),
    )
    // Year 0: full annual (yearsSinceStart=0 → growthFactor=1) → 10000 - 1200 = 8800.
    expect(result[0].cash).toBeCloseTo(8800, 6)
    // From year 1 onward growthFactor is clamped at (1 - 1)^t = 0, so no further drain.
    for (let i = 1; i < result.length; i++) {
      expect(result[i].cash).toBeCloseTo(8800, 6)
    }
  })

  it('exposes per-item investment values that compound at apy and deflate by inflation', () => {
    const investments: ProfileInvestment[] = [
      { id: 'a', name: 'Stocks', balance: 1000, apy: 10 },
      { id: 'b', name: 'Bonds', balance: 500, apy: 0 },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ investments }))
    expect(result[0].investmentsByItem).toHaveLength(2)
    expect(result[0].investmentsByItem[0]).toMatchObject({ id: 'a', name: 'Stocks' })
    expect(result[0].investmentsByItem[0].value).toBeCloseTo(1000, 6)
    expect(result[2].investmentsByItem[0].value).toBeCloseTo(1210, 6)
    expect(result[2].investmentsByItem[1].value).toBeCloseTo(500, 6)
    // Aggregate matches the sum of per-item values.
    expect(result[2].investments).toBeCloseTo(
      result[2].investmentsByItem.reduce((s, i) => s + i.value, 0),
      6,
    )
  })

  it('exposes per-item tangible assets at their entered value', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 't1', name: 'House', value: 5_000_000, status: 'fully_owned' },
      { id: 't2', name: 'Car', value: 500_000, status: 'fully_owned' },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ tangible_assets }))
    expect(result[0].tangibleAssetsByItem).toEqual([
      { id: 't1', name: 'House', value: 5_000_000 },
      { id: 't2', name: 'Car', value: 500_000 },
    ])
  })

  it('exposes per-item liability outstanding balances that amortize year over year', () => {
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
    expect(result[0].liabilitiesByItem).toEqual([{ id: 'l1', name: 'Loan', value: 750 }])
    expect(result[1].liabilitiesByItem[0].value).toBeCloseTo(500, 6)
    expect(result[3].liabilitiesByItem[0].value).toBeCloseTo(0, 6)
  })

  it('excludes tangible-asset financings from liabilitiesByItem', () => {
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
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ tangible_assets }))
    // No standalone liabilities entered → none listed, even though the asset
    // contributes to the aggregate liabilities figure.
    expect(result[0].liabilitiesByItem).toEqual([])
    expect(result[0].liabilities).toBeGreaterThan(0)
  })

  it('exposes totalIncome and totalExpenses per year in real terms', () => {
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
    expect(result[0].totalIncome).toBeCloseTo(12000, 6)
    expect(result[0].totalExpenses).toBeCloseTo(6000, 6)
  })

  it('prorates totalIncome by start_month when the flow begins mid-year', () => {
    // Salary starts June 2025: 7 months active → 7/12 of annual.
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
    expect(result[0].totalIncome).toBeCloseTo(1200 * (7 / 12), 6)
    expect(result[1].totalIncome).toBeCloseTo(1200, 6)
  })

  it('reflects the actual final-period draw (not full installment) in payoff-year cash', () => {
    // Loan: 1000 outstanding, monthly installment 100, 0 % interest.
    // Pays off in 10 months → final period draws exactly 100, but the year
    // total is 10 * 100 = 1000 (not 12 * 100 = 1200).
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 1000,
        installment_frequency: 'monthly',
        annual_rate: 0,
        installment_amount: 100,
        remaining_term: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 1500, liabilities }),
    )
    expect(result[0].liabilities).toBeCloseTo(0, 6)
    // Cash drained by exactly 1000 (not 1200).
    expect(result[0].cash).toBeCloseTo(500, 6)
    // No further drain in subsequent years.
    expect(result[1].cash).toBeCloseTo(500, 6)
  })

  it('never lets cash go below zero when expenses exceed income + starting balance', () => {
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Big spend',
        amount: 1000,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ cash_amount: 2500, expenses }))
    // 2500 - 1000 = 1500
    expect(result[0].cash).toBeCloseTo(1500, 6)
    // 1500 - 1000 = 500
    expect(result[1].cash).toBeCloseTo(500, 6)
    // would be -500; clamped to 0
    expect(result[2].cash).toBeCloseTo(0, 6)
    expect(result[3].cash).toBeCloseTo(0, 6)
    expect(result[4].cash).toBeCloseTo(0, 6)
  })

  // --- Transfers ---

  it('applies a one-time transfer cash -> investment in the chosen year', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Buy stocks',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 1000,
        schedule: 'one_time',
        transaction_year: 2027,
        transaction_month: 6,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 5000, investments }),
    )
    // 2025, 2026 — no change
    expect(result[0].cash).toBeCloseTo(5000, 6)
    expect(result[0].investments).toBeCloseTo(0, 6)
    expect(result[1].cash).toBeCloseTo(5000, 6)
    expect(result[1].investments).toBeCloseTo(0, 6)
    // 2027 — transfer happens
    expect(result[2].cash).toBeCloseTo(4000, 6)
    expect(result[2].investments).toBeCloseTo(1000, 6)
    // 2028+ — balances persist
    expect(result[3].cash).toBeCloseTo(4000, 6)
    expect(result[3].investments).toBeCloseTo(1000, 6)
  })

  it('lets future compounding work off the post-transfer investment balance', () => {
    const investments: ProfileInvestment[] = [
      { id: 'inv1', name: 'Stocks', balance: 1000, apy: 10 },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sell half',
        from_asset_id: 'inv1',
        to_asset_id: 'cash',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025, // year 0
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    // Year 0: starts at 1000, transfer at end of year leaves 500.
    expect(result[0].investments).toBeCloseTo(500, 6)
    expect(result[0].cash).toBeCloseTo(500, 6)
    // Year 1: 500 * 1.1 = 550
    expect(result[1].investments).toBeCloseTo(550, 6)
    // Year 2: 605
    expect(result[2].investments).toBeCloseTo(605, 6)
  })

  it('honors a recurring monthly transfer cash -> investment', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'DCA',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 100,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 100_000, investments }),
    )
    // 100/mo * 12 = 1200/year
    expect(result[0].investments).toBeCloseTo(1200, 6)
    expect(result[0].cash).toBeCloseTo(100_000 - 1200, 6)
    expect(result[1].investments).toBeCloseTo(2400, 6)
    expect(result[5].investments).toBeCloseTo(7200, 6) // 6 years inclusive
  })

  it('delays a recurring transfer until its at_specific_date start year', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Future DCA',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 100,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'at_specific_date',
        start_year: 2028,
        start_month: 1,
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 100_000, investments }),
    )
    // Plan runs 2025-2030; transfer starts 2028, so nothing before then.
    expect(result[0].investments).toBeCloseTo(0, 6) // 2025
    expect(result[1].investments).toBeCloseTo(0, 6) // 2026
    expect(result[2].investments).toBeCloseTo(0, 6) // 2027
    expect(result[3].investments).toBeCloseTo(1200, 6) // 2028
    expect(result[4].investments).toBeCloseTo(2400, 6) // 2029
  })

  it('delays a recurring transfer until the when_age_is start year (birth date set)', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Age DCA',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 100,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'when_age_is',
        start_age: 48, // born 1980 → starts 2028
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 100_000, investments, birth_date: '1980-01-01' }),
    )
    expect(result[0].investments).toBeCloseTo(0, 6) // 2025
    expect(result[2].investments).toBeCloseTo(0, 6) // 2027
    expect(result[3].investments).toBeCloseTo(1200, 6) // 2028
  })

  it('falls back to plan start for when_age_is when no birth date is set', () => {
    // Documents the silent fallback that the dialogs now prevent by disabling
    // the "when age is" option when the profile has no birth date.
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Age DCA',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 100,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'when_age_is',
        start_age: 48,
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 100_000, investments }), // no birth_date
    )
    expect(result[0].investments).toBeCloseTo(1200, 6) // fires from year 1
  })

  it('compounds recurring contributions at apy from the year they arrive', () => {
    // 1000 / year into an account at 10% APY, starting at plan-start.
    // Year 0: deposit 1000 -> balance 1000
    // Year 1: compound -> 1100, then deposit 1000 -> 2100
    // Year 2: compound -> 2310, then deposit 1000 -> 3310
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 10 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Yearly contribution',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 1000,
        schedule: 'recurring',
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 100_000, investments }),
    )
    expect(result[0].investments).toBeCloseTo(1000, 6)
    expect(result[1].investments).toBeCloseTo(2100, 6)
    expect(result[2].investments).toBeCloseTo(3310, 6)
  })

  it('reduces a tangible-asset value when transferred out', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      { id: 'house', name: 'House', value: 5_000_000, status: 'fully_owned' },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Partial sale',
        from_asset_id: 'house',
        to_asset_id: 'cash',
        amount: 1_000_000,
        schedule: 'one_time',
        transaction_year: 2026,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, tangible_assets }),
    )
    // Year 0: untouched
    expect(result[0].tangibleAssets).toBeCloseTo(5_000_000, 6)
    expect(result[0].cash).toBeCloseTo(0, 6)
    // Year 1 (2026): tangible drops, cash rises
    expect(result[1].tangibleAssets).toBeCloseTo(4_000_000, 6)
    expect(result[1].cash).toBeCloseTo(1_000_000, 6)
  })

  it('skips a transfer entirely when the source has insufficient funds', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 100, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sell more than I have',
        from_asset_id: 'inv1',
        to_asset_id: 'cash',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    // Source untouched, destination not credited.
    expect(result[0].investments).toBeCloseTo(100, 6)
    expect(result[0].cash).toBeCloseTo(0, 6)
    // Sidebar warning surfaced for the failed transfer.
    expect(result[0].insufficientFundTransferIds).toEqual(['t1'])
  })

  it('drains the source on a one-time transfer_all (ignores amount)', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sweep to investment',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 0,
        transfer_all: true,
        schedule: 'one_time',
        transaction_year: 2026,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 7500, investments }),
    )
    // 2025 (year 0): untouched
    expect(result[0].cash).toBeCloseTo(7500, 6)
    expect(result[0].investments).toBeCloseTo(0, 6)
    // 2026: sweep entire cash balance
    expect(result[1].cash).toBeCloseTo(0, 6)
    expect(result[1].investments).toBeCloseTo(7500, 6)
  })

  it('skips a transfer_all when the source is empty', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Try to sweep nothing',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 0,
        transfer_all: true,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    expect(result[0].cash).toBeCloseTo(0, 6)
    expect(result[0].investments).toBeCloseTo(0, 6)
    // An empty-source sweep is still a failed transfer for sidebar purposes.
    expect(result[0].insufficientFundTransferIds).toEqual(['t1'])
  })

  it('sweeps each year for recurring transfer_all', () => {
    // Income deposits 1000/yr into cash; the sweep moves it to investments.
    const incomes: Income[] = [
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
    ]
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sweep monthly',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 0,
        transfer_all: true,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, incomes, investments }),
    )
    // Each year: 1000 lands in cash, sweep drains it. Investments accumulate.
    expect(result[0].cash).toBeCloseTo(0, 6)
    expect(result[0].investments).toBeCloseTo(1000, 6)
    expect(result[2].cash).toBeCloseTo(0, 6)
    expect(result[2].investments).toBeCloseTo(3000, 6)
  })

  it('processes transfers in order; later ones fail when an earlier one drained the source', () => {
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'First',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 600,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
      {
        id: 't2',
        name: 'Second (insufficient)',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 600,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 1000, investments }),
    )
    // Only the first transfer applies: cash 1000 -> 400, inv 0 -> 600.
    expect(result[0].cash).toBeCloseTo(400, 6)
    expect(result[0].investments).toBeCloseTo(600, 6)
  })

  it('ignores transfers excluded via included_transfer_ids', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Included',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 100,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
      {
        id: 't2',
        name: 'Excluded',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 200,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers, included_transfer_ids: ['t1'] }),
      makeProfile({ cash_amount: 1000, investments }),
    )
    // Only t1 applies: 100 from cash to inv1; t2 is excluded.
    expect(result[0].cash).toBeCloseTo(900, 6)
    expect(result[0].investments).toBeCloseTo(100, 6)
  })

  it('ignores transfers whose endpoints are excluded from the plan', () => {
    const investments: ProfileInvestment[] = [
      { id: 'inv1', name: 'Included', balance: 1000, apy: 0 },
      { id: 'inv2', name: 'Excluded', balance: 1000, apy: 0 },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Move',
        from_asset_id: 'inv2', // excluded below
        to_asset_id: 'inv1',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ included_investment_ids: ['inv1'], transfers }),
      makeProfile({ investments }),
    )
    // inv1 unchanged (transfer ignored)
    expect(result[0].investments).toBeCloseTo(1000, 6)
  })

  // --- Inflation-adjusted toggle ---

  it('grows an inflation-adjusted income at the plan inflation rate (toggle)', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1000,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
        inflation_adjusted: true,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ incomes }),
    )
    // Real income per year stays flat at 1000 (toggle cancels inflation in
    // real terms). Cumulative cash compounds and the deflation lags, so we
    // assert the cleaner totalIncome invariant rather than cash sums.
    for (const entry of result) {
      expect(entry.totalIncome).toBeCloseTo(1000, 4)
    }
  })

  it('treats legacy change_over_time=match_inflation as inflation_adjusted (no double counting)', () => {
    // Old data shape stays correct: same behaviour as setting the toggle.
    const legacy: Income[] = [
      {
        id: 'a',
        name: 'A',
        amount: 1000,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'match_inflation',
      },
    ]
    const toggled: Income[] = [
      {
        id: 'b',
        name: 'B',
        amount: 1000,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
        inflation_adjusted: true,
      },
    ]
    const a = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ incomes: legacy }),
    )
    const b = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ incomes: toggled }),
    )
    for (let i = 0; i < a.length; i++) {
      expect(a[i].cash).toBeCloseTo(b[i].cash, 6)
    }
  })

  it('compounds inflation toggle with change_over_time=increase_yearly', () => {
    // Salary that grows 2% real on top of inflation.
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Salary',
        amount: 1000,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'never',
        inflation_adjusted: true,
        change_over_time: 'increase_yearly',
        change_percentage: 2,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05 }),
      makeProfile({ incomes }),
    )
    // Real income each year = base * (1+real_raise)^years (inflation cancels).
    // Year 0: 1000, Year 1: 1020, Year 2: 1040.4, ...
    expect(result[0].totalIncome).toBeCloseTo(1000, 4)
    expect(result[1].totalIncome).toBeCloseTo(1020, 4)
    expect(result[2].totalIncome).toBeCloseTo(1020 * 1.02, 4)
  })

  it('scales a one-time transfer forward to the transaction year when inflation_adjusted=true', () => {
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Future purchase',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 1000,
        inflation_adjusted: true,
        schedule: 'one_time',
        transaction_year: 2028, // plan starts 2025 → 3 years forward
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05, transfers }),
      makeProfile({ cash_amount: 10_000, investments }),
    )
    // Nominal transfer in 2028 = 1000 * 1.05^3 ≈ 1157.625, then deflated by
    // 1.05^3 back to the plan-start (real) units used by the projection.
    expect(result[3].investments).toBeCloseTo(1000, 4)
  })

  it('leaves a one-time transfer unscaled when inflation_adjusted is omitted', () => {
    // Confirms default behaviour is unchanged for existing data.
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Future purchase',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 1000,
        schedule: 'one_time',
        transaction_year: 2028,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ inflation_rate: 0.05, transfers }),
      makeProfile({ cash_amount: 10_000, investments }),
    )
    // Without the toggle the nominal 1000 stays at 1000; in real terms after
    // 3 years of 5% inflation that's 1000 / 1.05^3 ≈ 863.84.
    expect(result[3].investments).toBeCloseTo(1000 / Math.pow(1.05, 3), 4)
  })

  // --- Liability interest options ---

  it('preserves legacy behaviour when interest_type and compounding_frequency are omitted', () => {
    // Identical inputs to "treats annual_rate as a percentage" further up,
    // re-asserting that fully-amortizing loan still hits zero with the new
    // code path enabled (defaults fall back to compounding at the installment
    // frequency, which is what the old engine did unconditionally).
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

  it('charges more interest with daily compounding than yearly compounding', () => {
    // Same loan, same payment, only the compounding frequency differs.
    // Daily compounding lifts the effective annual rate above the nominal
    // rate, so a fixed installment amount leaves a larger residual balance
    // after one year.
    const liability: Omit<ProfileLiability, 'compounding_frequency'> = {
      id: 'l1',
      name: 'Loan',
      outstanding_balance: 10_000,
      installment_frequency: 'monthly',
      annual_rate: 12,
      installment_amount: 200,
      remaining_term: 10,
    }
    const yearly = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ liabilities: [{ ...liability, compounding_frequency: 'yearly' }] }),
    )
    const daily = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ liabilities: [{ ...liability, compounding_frequency: 'daily' }] }),
    )
    expect(daily[0].liabilities).toBeGreaterThan(yearly[0].liabilities)
  })

  it('uses straight nominal rate per installment for simple interest', () => {
    // 'simple' bypasses the EAR conversion: per-installment rate is just
    // annualRate / installmentsPerYear regardless of compounding_frequency.
    const simple = getYearlyPlanProjection(
      makePlan(),
      makeProfile({
        liabilities: [
          {
            id: 'l1',
            name: 'Loan',
            outstanding_balance: 10_000,
            installment_frequency: 'monthly',
            annual_rate: 12,
            installment_amount: 200,
            remaining_term: 10,
            interest_type: 'simple',
            compounding_frequency: 'daily',
          },
        ],
      }),
    )
    const compoundMonthly = getYearlyPlanProjection(
      makePlan(),
      makeProfile({
        liabilities: [
          {
            id: 'l1',
            name: 'Loan',
            outstanding_balance: 10_000,
            installment_frequency: 'monthly',
            annual_rate: 12,
            installment_amount: 200,
            remaining_term: 10,
            interest_type: 'compound',
            compounding_frequency: 'monthly',
          },
        ],
      }),
    )
    // Simple at 12 % nominal monthly == compound with monthly compounding
    // (both produce 1 %/month). The daily compounding_frequency on the
    // simple loan must be ignored.
    expect(simple[0].liabilities).toBeCloseTo(compoundMonthly[0].liabilities, 6)
  })

  // --- Investment fees (TER, entry, exit) ---

  it('subtracts TER from APY when compounding investments', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 1000, apy: 7, ter: 1 },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ investments }))
    // Effective APY = 7 − 1 = 6 %. Year 1 balance = 1000 * 1.06 = 1060.
    expect(result[0].investments).toBeCloseTo(1000, 6)
    expect(result[1].investments).toBeCloseTo(1060, 6)
    expect(result[2].investments).toBeCloseTo(1060 * 1.06, 6)
  })

  it('treats an ongoing entry fee as additional APY drag', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 1000, apy: 7, entry_fee: 1, entry_fee_type: 'ongoing' },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ investments }))
    // Effective APY = 7 − 1 = 6 % (whole entry_fee as drag, no upfront cut).
    expect(result[1].investments).toBeCloseTo(1060, 6)
  })

  it('splits a forty-sixty entry fee 40% upfront + 60% ongoing drag', () => {
    const investments: ProfileInvestment[] = [
      {
        id: 'i1',
        name: 'Fund',
        balance: 0,
        apy: 0,
        entry_fee: 5,
        entry_fee_type: 'forty-sixty',
      },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Deposit',
        from_asset_id: 'cash',
        to_asset_id: 'i1',
        amount: 1000,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 1000, investments }),
    )
    // 40 % of 5 % = 2 % upfront cut → 1000 → 980 lands in the investment.
    // Source loses the full 1000; the broker pockets the missing 20.
    expect(result[0].investments).toBeCloseTo(980, 6)
    expect(result[0].cash).toBeCloseTo(0, 6)
  })

  it('takes the full entry fee upfront when payment type is upfront', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 0, apy: 0, entry_fee: 2, entry_fee_type: 'upfront' },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Deposit',
        from_asset_id: 'cash',
        to_asset_id: 'i1',
        amount: 1000,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 1000, investments }),
    )
    // 2 % of 1000 = 20 deducted → 980 invested.
    expect(result[0].investments).toBeCloseTo(980, 6)
    expect(result[0].cash).toBeCloseTo(0, 6)
  })

  it('takes a percentage exit fee from withdrawal proceeds', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 1000, apy: 0, exit_fee: 1, exit_fee_type: 'percentage' },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sell',
        from_asset_id: 'i1',
        to_asset_id: 'cash',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    // Source loses 500. 1 % of 500 = 5 fee → 495 lands in cash.
    expect(result[0].investments).toBeCloseTo(500, 6)
    expect(result[0].cash).toBeCloseTo(495, 6)
  })

  it('takes a fixed exit fee from withdrawal proceeds', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 1000, apy: 0, exit_fee: 10, exit_fee_type: 'fixed' },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sell',
        from_asset_id: 'i1',
        to_asset_id: 'cash',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    expect(result[0].investments).toBeCloseTo(500, 6)
    expect(result[0].cash).toBeCloseTo(490, 6)
  })

  it('clamps a fixed exit fee at the transfer amount (no negative inflow)', () => {
    const investments: ProfileInvestment[] = [
      { id: 'i1', name: 'Fund', balance: 1000, apy: 0, exit_fee: 1000, exit_fee_type: 'fixed' },
    ]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'Sell',
        from_asset_id: 'i1',
        to_asset_id: 'cash',
        amount: 500,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    expect(result[0].cash).toBeCloseTo(0, 6)
  })

  // --- Insufficient-funds warnings ---

  it('reports no insufficient-funds warnings for a healthy plan', () => {
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
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 10_000, incomes, expenses }),
    )
    for (const entry of result) {
      expect(entry.insufficientFundTransferIds).toEqual([])
      expect(entry.insufficientFundExpenseIds).toEqual([])
    }
  })

  it('flags a recurring transfer that becomes insufficient mid-plan', () => {
    // Income covers the transfer for the first two years, then stops; the
    // transfer can no longer be funded and should be flagged from year 2.
    const incomes: Income[] = [
      {
        id: 'inc1',
        name: 'Short-term gig',
        amount: 1200,
        frequency: 'yearly',
        withhold_taxes: false,
        start: 'immediately',
        end: 'at_specific_date',
        end_year: 2026,
        end_month: 12,
        change_over_time: 'none',
      },
    ]
    const investments: ProfileInvestment[] = [{ id: 'inv1', name: 'Stocks', balance: 0, apy: 0 }]
    const transfers: Transfer[] = [
      {
        id: 't1',
        name: 'DCA',
        from_asset_id: 'cash',
        to_asset_id: 'inv1',
        amount: 1200,
        schedule: 'recurring',
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, incomes, investments }),
    )
    // 2025, 2026: income covers transfer → no warning.
    expect(result[0].insufficientFundTransferIds).toEqual([])
    expect(result[1].insufficientFundTransferIds).toEqual([])
    // 2027+: income gone, cash empty, recurring transfer cannot fund.
    expect(result[2].insufficientFundTransferIds).toEqual(['t1'])
    expect(result[3].insufficientFundTransferIds).toEqual(['t1'])
  })

  it('flags a transfer whose non-cash source has been drained by an earlier transfer', () => {
    // Drain inv1 in year 0, then try to take more from it in year 1.
    const investments: ProfileInvestment[] = [
      { id: 'inv1', name: 'Source', balance: 1000, apy: 0 },
      { id: 'inv2', name: 'Dest', balance: 0, apy: 0 },
    ]
    const transfers: Transfer[] = [
      {
        id: 'drain',
        name: 'Drain source',
        from_asset_id: 'inv1',
        to_asset_id: 'inv2',
        amount: 1000,
        schedule: 'one_time',
        transaction_year: 2025,
        transaction_month: 1,
      },
      {
        id: 'second',
        name: 'Second try',
        from_asset_id: 'inv1',
        to_asset_id: 'inv2',
        amount: 100,
        schedule: 'one_time',
        transaction_year: 2026,
        transaction_month: 1,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, investments }),
    )
    // Year 0: drain succeeds, second hasn't fired yet.
    expect(result[0].insufficientFundTransferIds).toEqual([])
    // Year 1: second can't fund from drained inv1.
    expect(result[1].insufficientFundTransferIds).toEqual(['second'])
  })

  it('keeps inflation-adjusted amounts in today’s money regardless of cash-flow start year', () => {
    // Regression: previously the inflation factor was anchored to each cash
    // flow's OWN start year. A transfer starting 10 years from now would
    // grow from year 10 onward (so year-10 nominal = base), while an expense
    // starting at plan start had already been compounding for 10 years
    // (year-10 nominal = base * 1.05^10). The transfer never caught up and
    // expenses got flagged a few years in.
    //
    // The fix anchors the inflation factor to PLAN start: both amounts grow
    // by the same (1+inflation)^yearsSincePlanStart, so the today's-money
    // ratio is preserved and a 3000/m transfer covers a 2700/m expense in
    // every year of the plan — even when the transfer starts 10 years late.
    const investments: ProfileInvestment[] = [
      { id: 'inv1', name: 'Brokerage', balance: 10_000_000, apy: 0 },
    ]
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Living costs',
        amount: 2700,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
        inflation_adjusted: true,
      },
    ]
    const transfers: Transfer[] = [
      {
        id: 'tr1',
        name: 'Drawdown',
        from_asset_id: 'inv1',
        to_asset_id: 'cash',
        amount: 3000,
        schedule: 'recurring',
        frequency: 'monthly',
        // Transfer starts mid-plan.
        start: 'at_specific_date',
        start_year: 2035,
        start_month: 1,
        end: 'never',
        change_over_time: 'none',
        inflation_adjusted: true,
      },
    ]
    // Plan spans 20 years so we cover both pre- and post-transfer-start years.
    // Cash starts large enough to fund expenses during the pre-transfer phase.
    const result = getYearlyPlanProjection(
      makePlan({
        start_date: '2026-01-01',
        end_date: '2046-01-01',
        inflation_rate: 0.05,
        transfers,
      }),
      makeProfile({ cash_amount: 1_000_000, expenses, investments }),
    )
    // From 2035 (year 9) onward the transfer covers the expense in real
    // terms — no expense should ever be flagged.
    for (const entry of result) {
      expect(entry.insufficientFundExpenseIds).toEqual([])
    }
  })

  it('does not flag an expense covered by a transfer-into-cash from another asset', () => {
    // Regression: previously the expense overflow check ran before transfers
    // were applied, so a 3000/m transfer that funded a 2700/m expense never
    // got the chance to cover it and the expense was wrongly flagged in
    // year 0 (where starting cash is too small to cover the expense alone).
    const investments: ProfileInvestment[] = [
      { id: 'inv1', name: 'Brokerage', balance: 1_000_000, apy: 0 },
    ]
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Living costs',
        amount: 2700,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const transfers: Transfer[] = [
      {
        id: 'tr1',
        name: 'Drawdown',
        from_asset_id: 'inv1',
        to_asset_id: 'cash',
        amount: 3000,
        schedule: 'recurring',
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ transfers }),
      makeProfile({ cash_amount: 0, expenses, investments }),
    )
    for (const entry of result) {
      expect(entry.insufficientFundExpenseIds).toEqual([])
      expect(entry.insufficientFundTransferIds).toEqual([])
    }
    // Net cash gain each year = (3000 - 2700) * 12 = 3600.
    expect(result[0].cash).toBeCloseTo(3600, 6)
    expect(result[1].cash).toBeCloseTo(7200, 6)
  })

  it('flags expenses in any year where cash + income cannot cover them', () => {
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Big spend',
        amount: 5000,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ cash_amount: 7000, expenses }))
    // 2025: 7000 - 5000 = 2000 → ok
    expect(result[0].insufficientFundExpenseIds).toEqual([])
    // 2026: 2000 - 5000 = -3000 → flagged
    expect(result[1].insufficientFundExpenseIds).toEqual(['exp1'])
    expect(result[2].insufficientFundExpenseIds).toEqual(['exp1'])
  })

  it('flags every active expense in a year of cash shortfall', () => {
    // Two co-active expenses jointly exceed cash; both get flagged because
    // there is no honest way to attribute the shortfall to one over the other.
    const expenses: Expense[] = [
      {
        id: 'rent',
        name: 'Rent',
        amount: 800,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
      {
        id: 'food',
        name: 'Food',
        amount: 400,
        frequency: 'monthly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ cash_amount: 5000, expenses }))
    // (800+400)*12 = 14400/year vs 5000 cash → shortfall in year 0 already.
    expect(result[0].insufficientFundExpenseIds.sort()).toEqual(['food', 'rent'])
  })

  it('flags active expenses when liability payments push cash below zero too', () => {
    // Cash + income covers the expense alone, but a liability payment in the
    // same year takes cash negative overall. We flag the expense because the
    // user-visible signal is "cash ran out while this expense was active";
    // we don't try to apportion blame between expenses and liabilities.
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Small spend',
        amount: 100,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Big loan',
        outstanding_balance: 10_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 5_000,
        remaining_term: 2,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 200, expenses, liabilities }),
    )
    expect(result[0].insufficientFundExpenseIds).toEqual(['exp1'])
  })
  it('computes per-year FI percent and runway from investable wealth and outflows', () => {
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Living',
        amount: 10_000,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const investments: ProfileInvestment[] = [{ id: 'i1', name: 'Fund', balance: 100_000, apy: 0 }]
    const result = getYearlyPlanProjection(
      makePlan({ include_cash: false }),
      makeProfile({ investments, expenses }),
    )
    // Year 0: investable 100,000; outflows 10,000.
    // FI % = 100,000 / (10,000 * 25) * 100 = 40; runway = 10 years.
    expect(result[0].fiPercent).toBeCloseTo(40, 6)
    expect(result[0].runwayYears).toBeCloseTo(10, 6)
  })

  it('subtracts standalone liabilities from investable wealth and counts their installments as outflows', () => {
    const liabilities: ProfileLiability[] = [
      {
        id: 'l1',
        name: 'Loan',
        outstanding_balance: 20_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 10_000,
        remaining_term: 2,
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan(),
      makeProfile({ cash_amount: 100_000, liabilities }),
    )
    // Year 0: cash 100,000 - installment 10,000 = 90,000; outstanding 10,000.
    // investable = 90,000 - 10,000 = 80,000; outflows = 10,000 (installment).
    expect(result[0].fiPercent).toBeCloseTo((80_000 / 250_000) * 100, 6)
    expect(result[0].runwayYears).toBeCloseTo(8, 6)
    // Year 2: loan paid off, no expenses left -> no outflows -> undefined.
    expect(result[2].fiPercent).toBeUndefined()
    expect(result[2].runwayYears).toBeUndefined()
  })

  it('leaves FI percent and runway undefined in years with zero outflows', () => {
    const result = getYearlyPlanProjection(makePlan(), makeProfile({ cash_amount: 50_000 }))
    for (const entry of result) {
      expect(entry.fiPercent).toBeUndefined()
      expect(entry.runwayYears).toBeUndefined()
    }
  })

  it('excludes tangibles and financed-asset debt from investable wealth', () => {
    const tangible_assets: ProfileTangibleAsset[] = [
      {
        id: 't1',
        name: 'House',
        value: 1_000_000,
        status: 'financed',
        outstanding_balance: 200_000,
        installment_frequency: 'yearly',
        annual_rate: 0,
        installment_amount: 20_000,
        remaining_term: 10,
      },
    ]
    const expenses: Expense[] = [
      {
        id: 'exp1',
        name: 'Living',
        amount: 10_000,
        frequency: 'yearly',
        start: 'immediately',
        end: 'never',
        change_over_time: 'none',
      },
    ]
    const result = getYearlyPlanProjection(
      makePlan({ include_cash: false }),
      makeProfile({
        investments: [{ id: 'i1', name: 'Fund', balance: 150_000, apy: 0 }],
        tangible_assets,
        expenses,
      }),
    )
    // investable = investments only (house + mortgage excluded); outflows =
    // expenses 10,000 + mortgage installment 20,000 = 30,000.
    expect(result[0].runwayYears).toBeCloseTo(150_000 / 30_000, 6)
    expect(result[0].fiPercent).toBeCloseTo((150_000 / (30_000 * 25)) * 100, 6)
  })
})
