import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1, calculateBothTerms } from '$lib/@snaha/kalkul-maths'
import type {
  Expense,
  Frequency,
  Income,
  PortfolioNested,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
} from '$lib/schemas'

export interface YearlyProjection {
  year: number
  cash: number
  investments: number
  tangibleAssets: number
  liabilities: number
  netWorth: number
}

const PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1,
}

function resolveStartYear(
  cashFlow: Income | Expense,
  planStartYear: number,
  birthYear: number | undefined,
): number {
  if (cashFlow.start === 'immediately') return planStartYear
  if (cashFlow.start === 'at_specific_date') return cashFlow.start_year ?? planStartYear
  if (
    cashFlow.start === 'when_age_is' &&
    birthYear !== undefined &&
    cashFlow.start_age !== undefined
  )
    return birthYear + cashFlow.start_age
  return planStartYear
}

function resolveEndYear(cashFlow: Income | Expense, birthYear: number | undefined): number {
  if (cashFlow.end === 'never') return Number.POSITIVE_INFINITY
  if (cashFlow.end === 'at_specific_date') return cashFlow.end_year ?? Number.POSITIVE_INFINITY
  if (cashFlow.end === 'when_age_is' && birthYear !== undefined && cashFlow.end_age !== undefined)
    return birthYear + cashFlow.end_age
  return Number.POSITIVE_INFINITY
}

function annualizedAmount(amount: Decimal, frequency: Frequency): Decimal {
  return amount.mul(PERIODS_PER_YEAR[frequency])
}

function activeMonthFraction(
  cashFlow: Income | Expense,
  year: number,
  startYear: number,
  endYear: number,
): Decimal {
  let startMonth = 1
  let endMonth = 12
  if (
    year === startYear &&
    cashFlow.start === 'at_specific_date' &&
    cashFlow.start_month !== undefined
  ) {
    startMonth = cashFlow.start_month
  }
  if (year === endYear && cashFlow.end === 'at_specific_date' && cashFlow.end_month !== undefined) {
    endMonth = cashFlow.end_month
  }
  const months = Math.max(0, endMonth - startMonth + 1)
  return new Decimal(months).div(12)
}

function growthFactor(
  cashFlow: Income | Expense,
  yearsSinceStart: number,
  inflationRate: Decimal,
): Decimal {
  if (yearsSinceStart <= 0) return DECIMAL_1
  switch (cashFlow.change_over_time) {
    case 'match_inflation':
      return DECIMAL_1.plus(inflationRate).pow(yearsSinceStart)
    case 'increase_yearly':
      return DECIMAL_1.plus(new Decimal(cashFlow.change_percentage ?? 0).div(100)).pow(
        yearsSinceStart,
      )
    case 'decrease_yearly':
      return DECIMAL_1.minus(new Decimal(cashFlow.change_percentage ?? 0).div(100)).pow(
        yearsSinceStart,
      )
    case 'none':
    default:
      return DECIMAL_1
  }
}

function netIncome(income: Income): Decimal {
  const amount = new Decimal(income.amount)
  if (!income.withhold_taxes) return amount
  const taxFraction = new Decimal(income.tax_percentage ?? 0).div(100)
  return amount.mul(DECIMAL_1.minus(taxFraction))
}

interface LiabilitySchedule {
  outstandingByYear: Map<number, Decimal>
  paidByYear: Map<number, Decimal>
}

function simulateLiability(
  liability: ProfileLiability,
  startYear: number,
  endYear: number,
): LiabilitySchedule {
  const periodsPerYear = PERIODS_PER_YEAR[liability.installment_frequency]
  const periodRate = new Decimal(liability.annual_rate).div(100).div(periodsPerYear)
  const installmentAmount = new Decimal(liability.installment_amount)

  let balance = new Decimal(liability.outstanding_balance)
  let periodsRemaining = liability.remaining_term * periodsPerYear

  const outstandingByYear = new Map<number, Decimal>()
  const paidByYear = new Map<number, Decimal>()

  for (let year = startYear; year <= endYear; year++) {
    let paidThisYear = DECIMAL_0
    for (let i = 0; i < periodsPerYear; i++) {
      if (periodsRemaining <= 0 || balance.lessThanOrEqualTo(0)) break
      const interest = balance.mul(periodRate)
      const grossDue = balance.plus(interest)
      const payment = Decimal.min(installmentAmount, grossDue)
      balance = grossDue.minus(payment)
      if (balance.lessThan(0)) balance = DECIMAL_0
      paidThisYear = paidThisYear.plus(payment)
      periodsRemaining -= 1
    }
    outstandingByYear.set(year, balance)
    paidByYear.set(year, paidThisYear)
  }

  return { outstandingByYear, paidByYear }
}

function financingToLiability(asset: ProfileTangibleAsset): ProfileLiability | undefined {
  if (
    asset.status !== 'financed' ||
    asset.outstanding_balance === undefined ||
    asset.installment_frequency === undefined ||
    asset.annual_rate === undefined ||
    asset.installment_amount === undefined ||
    asset.remaining_term === undefined
  )
    return undefined
  return {
    id: `tangible-asset-financing-${asset.id}`,
    name: asset.name,
    outstanding_balance: asset.outstanding_balance,
    installment_frequency: asset.installment_frequency,
    annual_rate: asset.annual_rate,
    installment_amount: asset.installment_amount,
    remaining_term: asset.remaining_term,
  }
}

function filterById<T extends { id: string }>(
  items: T[] | undefined,
  includedIds: string[] | undefined,
): T[] {
  if (!items) return []
  if (!includedIds) return items
  const set = new Set(includedIds)
  return items.filter((item) => set.has(item.id))
}

export function getYearlyPlanProjection(
  plan: PortfolioNested,
  profile: Profile,
): YearlyProjection[] {
  const startDate = new Date(plan.start_date)
  const endDate = new Date(plan.end_date)
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  if (endYear < startYear) return []

  const birthYear = profile.birth_date ? new Date(profile.birth_date).getFullYear() : undefined

  const investments: ProfileInvestment[] = filterById(
    profile.investments,
    plan.included_investment_ids,
  )
  const liabilities: ProfileLiability[] = filterById(
    profile.liabilities,
    plan.included_liability_ids,
  )
  const tangibleAssets = filterById(profile.tangible_assets, plan.included_tangible_asset_ids)
  const incomes: Income[] = filterById(profile.incomes, plan.included_income_ids)
  const expenses: Expense[] = filterById(profile.expenses, plan.included_expense_ids)

  const tangibleAssetsTotalNominal = tangibleAssets.reduce<Decimal>(
    (sum, a) => sum.plus(a.value ?? 0),
    DECIMAL_0,
  )

  const tangibleAssetLiabilities = tangibleAssets
    .map(financingToLiability)
    .filter((l): l is ProfileLiability => l !== undefined)
  const allLiabilities = [...liabilities, ...tangibleAssetLiabilities]

  const liabilitySchedules = allLiabilities.map((l) => simulateLiability(l, startYear, endYear))

  const initialCashNominal = plan.include_cash === false ? 0 : (profile.cash_amount ?? 0)

  let cashNominal = new Decimal(initialCashNominal)
  const inflationRate = new Decimal(plan.inflation_rate)
  const inflationRateNumber = plan.inflation_rate
  const baseDate = `${startYear}-01-01`

  const projection: YearlyProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    const yearsSincePlanStart = year - startYear

    const investmentsNominal = investments.reduce<Decimal>(
      (sum, inv) =>
        sum.plus(
          new Decimal(inv.balance).mul(
            DECIMAL_1.plus(new Decimal(inv.apy).div(100)).pow(yearsSincePlanStart),
          ),
        ),
      DECIMAL_0,
    )

    let liabilitiesOutstandingNominal = DECIMAL_0
    let liabilitiesPaidThisYearNominal = DECIMAL_0
    for (const schedule of liabilitySchedules) {
      liabilitiesOutstandingNominal = liabilitiesOutstandingNominal.plus(
        schedule.outstandingByYear.get(year) ?? DECIMAL_0,
      )
      liabilitiesPaidThisYearNominal = liabilitiesPaidThisYearNominal.plus(
        schedule.paidByYear.get(year) ?? DECIMAL_0,
      )
    }

    let incomesThisYearNominal = DECIMAL_0
    for (const income of incomes) {
      const incomeStart = resolveStartYear(income, startYear, birthYear)
      const incomeEnd = resolveEndYear(income, birthYear)
      if (year < incomeStart || year > incomeEnd) continue
      const fraction = activeMonthFraction(income, year, incomeStart, incomeEnd)
      if (fraction.isZero()) continue
      const yearsSinceCashFlowStart = year - incomeStart
      const annual = annualizedAmount(netIncome(income), income.frequency)
      incomesThisYearNominal = incomesThisYearNominal.plus(
        annual.mul(growthFactor(income, yearsSinceCashFlowStart, inflationRate)).mul(fraction),
      )
    }

    let expensesThisYearNominal = DECIMAL_0
    for (const expense of expenses) {
      const expenseStart = resolveStartYear(expense, startYear, birthYear)
      const expenseEnd = resolveEndYear(expense, birthYear)
      if (year < expenseStart || year > expenseEnd) continue
      const fraction = activeMonthFraction(expense, year, expenseStart, expenseEnd)
      if (fraction.isZero()) continue
      const yearsSinceCashFlowStart = year - expenseStart
      const annual = annualizedAmount(new Decimal(expense.amount), expense.frequency)
      expensesThisYearNominal = expensesThisYearNominal.plus(
        annual.mul(growthFactor(expense, yearsSinceCashFlowStart, inflationRate)).mul(fraction),
      )
    }

    cashNominal = cashNominal
      .plus(incomesThisYearNominal)
      .minus(expensesThisYearNominal)
      .minus(liabilitiesPaidThisYearNominal)

    const targetDate = `${year}-01-01`
    const cashReal = new Decimal(
      calculateBothTerms(cashNominal.toNumber(), targetDate, baseDate, inflationRateNumber).real,
    )
    const investmentsReal = new Decimal(
      calculateBothTerms(investmentsNominal.toNumber(), targetDate, baseDate, inflationRateNumber)
        .real,
    )
    const liabilitiesReal = new Decimal(
      calculateBothTerms(
        liabilitiesOutstandingNominal.toNumber(),
        targetDate,
        baseDate,
        inflationRateNumber,
      ).real,
    )

    // Tangibles are assumed to passively track inflation (nominal value rises 1:1
    // with inflation), so their real value is constant at the user-entered amount.
    // Future per-asset appreciation_rate (default = inflation_rate) will refine this.
    const tangibleAssetsReal = tangibleAssetsTotalNominal

    const netWorth = cashReal.plus(investmentsReal).plus(tangibleAssetsReal).minus(liabilitiesReal)

    projection.push({
      year,
      cash: cashReal.toNumber(),
      investments: investmentsReal.toNumber(),
      tangibleAssets: tangibleAssetsReal.toNumber(),
      liabilities: liabilitiesReal.toNumber(),
      netWorth: netWorth.toNumber(),
    })
  }

  return projection
}
