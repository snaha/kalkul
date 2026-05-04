import { calculateBothTerms } from '$lib/@snaha/kalkul-maths'
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

function annualizedAmount(amount: number, frequency: Frequency): number {
  return amount * PERIODS_PER_YEAR[frequency]
}

function growthFactor(
  cashFlow: Income | Expense,
  yearsSinceStart: number,
  inflationRate: number,
): number {
  if (yearsSinceStart <= 0) return 1
  switch (cashFlow.change_over_time) {
    case 'match_inflation':
      return Math.pow(1 + inflationRate, yearsSinceStart)
    case 'increase_yearly':
      return Math.pow(1 + (cashFlow.change_percentage ?? 0) / 100, yearsSinceStart)
    case 'decrease_yearly':
      return Math.pow(1 - (cashFlow.change_percentage ?? 0) / 100, yearsSinceStart)
    case 'none':
    default:
      return 1
  }
}

function netIncome(income: Income): number {
  if (!income.withhold_taxes) return income.amount
  const taxFraction = (income.tax_percentage ?? 0) / 100
  return income.amount * (1 - taxFraction)
}

interface LiabilitySchedule {
  outstandingByYear: Map<number, number>
  paidByYear: Map<number, number>
}

function simulateLiability(
  liability: ProfileLiability,
  startYear: number,
  endYear: number,
): LiabilitySchedule {
  const periodsPerYear = PERIODS_PER_YEAR[liability.installment_frequency]
  const periodRate = liability.annual_rate / 100 / periodsPerYear

  let balance = liability.outstanding_balance
  let periodsRemaining = liability.remaining_term * periodsPerYear

  const outstandingByYear = new Map<number, number>()
  const paidByYear = new Map<number, number>()

  for (let year = startYear; year <= endYear; year++) {
    let paidThisYear = 0
    for (let i = 0; i < periodsPerYear; i++) {
      if (periodsRemaining <= 0 || balance <= 0) break
      const interest = balance * periodRate
      const payment = Math.min(liability.installment_amount, balance + interest)
      balance = balance + interest - payment
      if (balance < 0) balance = 0
      paidThisYear += payment
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

  const tangibleAssetsTotalNominal = tangibleAssets.reduce((sum, a) => sum + (a.value ?? 0), 0)

  const tangibleAssetLiabilities = tangibleAssets
    .map(financingToLiability)
    .filter((l): l is ProfileLiability => l !== undefined)
  const allLiabilities = [...liabilities, ...tangibleAssetLiabilities]

  const liabilitySchedules = allLiabilities.map((l) => simulateLiability(l, startYear, endYear))

  const initialCashNominal = plan.include_cash === false ? 0 : (profile.cash_amount ?? 0)

  let cashNominal = initialCashNominal
  const inflationRate = plan.inflation_rate
  const baseDate = `${startYear}-01-01`

  const projection: YearlyProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    const yearsSincePlanStart = year - startYear

    const investmentsNominal = investments.reduce(
      (sum, inv) => sum + inv.balance * Math.pow(1 + inv.apy / 100, yearsSincePlanStart),
      0,
    )

    let liabilitiesOutstandingNominal = 0
    let liabilitiesPaidThisYearNominal = 0
    for (const schedule of liabilitySchedules) {
      liabilitiesOutstandingNominal += schedule.outstandingByYear.get(year) ?? 0
      liabilitiesPaidThisYearNominal += schedule.paidByYear.get(year) ?? 0
    }

    let incomesThisYearNominal = 0
    for (const income of incomes) {
      const incomeStart = resolveStartYear(income, startYear, birthYear)
      const incomeEnd = resolveEndYear(income, birthYear)
      if (year < incomeStart || year > incomeEnd) continue
      const yearsSinceCashFlowStart = year - incomeStart
      const annual = annualizedAmount(netIncome(income), income.frequency)
      incomesThisYearNominal +=
        annual * growthFactor(income, yearsSinceCashFlowStart, inflationRate)
    }

    let expensesThisYearNominal = 0
    for (const expense of expenses) {
      const expenseStart = resolveStartYear(expense, startYear, birthYear)
      const expenseEnd = resolveEndYear(expense, birthYear)
      if (year < expenseStart || year > expenseEnd) continue
      const yearsSinceCashFlowStart = year - expenseStart
      const annual = annualizedAmount(expense.amount, expense.frequency)
      expensesThisYearNominal +=
        annual * growthFactor(expense, yearsSinceCashFlowStart, inflationRate)
    }

    cashNominal += incomesThisYearNominal - expensesThisYearNominal - liabilitiesPaidThisYearNominal

    const targetDate = `${year}-01-01`
    const cashReal = calculateBothTerms(cashNominal, targetDate, baseDate, inflationRate).real
    const investmentsReal = calculateBothTerms(
      investmentsNominal,
      targetDate,
      baseDate,
      inflationRate,
    ).real
    const liabilitiesReal = calculateBothTerms(
      liabilitiesOutstandingNominal,
      targetDate,
      baseDate,
      inflationRate,
    ).real

    const tangibleAssetsReal = tangibleAssetsTotalNominal

    projection.push({
      year,
      cash: cashReal,
      investments: investmentsReal,
      tangibleAssets: tangibleAssetsReal,
      liabilities: liabilitiesReal,
      netWorth: cashReal + investmentsReal + tangibleAssetsReal - liabilitiesReal,
    })
  }

  return projection
}
