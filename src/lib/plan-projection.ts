import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths'
import type {
  CashFlowEnd,
  CashFlowStart,
  ChangeOverTime,
  Expense,
  Frequency,
  Income,
  PortfolioNested,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
  Transfer,
} from '$lib/schemas'

// Common temporal shape shared by Income, Expense, and recurring Transfer.
interface CashFlowTemporal {
  start: CashFlowStart
  start_year?: number
  start_month?: number
  start_age?: number
  end: CashFlowEnd
  end_year?: number
  end_month?: number
  end_age?: number
  change_over_time: ChangeOverTime
  change_percentage?: number
}

export interface YearlyProjectionItem {
  id: string
  name: string
  value: number
}

export interface YearlyProjection {
  year: number
  cash: number
  investments: number
  tangibleAssets: number
  liabilities: number
  netWorth: number
  investmentsByItem: YearlyProjectionItem[]
  tangibleAssetsByItem: YearlyProjectionItem[]
  liabilitiesByItem: YearlyProjectionItem[]
  totalIncome: number
  totalExpenses: number
}

// Annualized cash flows: a year is 365.25/7 ≈ 52.1775 weeks.
const FLOW_PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 365.25 / 7,
  monthly: 12,
  yearly: 1,
}

// Liability amortization needs an integer count of installments per year.
const INSTALLMENT_PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1,
}

function resolveStartYear(
  cashFlow: CashFlowTemporal,
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

function resolveEndYear(cashFlow: CashFlowTemporal, birthYear: number | undefined): number {
  if (cashFlow.end === 'never') return Number.POSITIVE_INFINITY
  if (cashFlow.end === 'at_specific_date') return cashFlow.end_year ?? Number.POSITIVE_INFINITY
  if (cashFlow.end === 'when_age_is' && birthYear !== undefined && cashFlow.end_age !== undefined)
    return birthYear + cashFlow.end_age
  return Number.POSITIVE_INFINITY
}

function annualizedAmount(amount: Decimal, frequency: Frequency): Decimal {
  return amount.mul(FLOW_PERIODS_PER_YEAR[frequency])
}

function activeMonthFraction(
  cashFlow: CashFlowTemporal,
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
  cashFlow: CashFlowTemporal,
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
    case 'decrease_yearly': {
      // Clamp to ≤100 % so a decrease can't take the factor negative
      // (which would oscillate sign across integer year exponents).
      const pct = Decimal.min(new Decimal(cashFlow.change_percentage ?? 0), 100)
      return DECIMAL_1.minus(pct.div(100)).pow(yearsSinceStart)
    }
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
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency]
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
      // Final scheduled installment: pay whatever is owed so the loan reaches
      // zero at the end of `remaining_term`. Without this balloon, slightly
      // under-amortizing inputs leave a residual balance that lingers forever.
      const isLastPeriod = periodsRemaining === 1
      const payment = isLastPeriod ? grossDue : Decimal.min(installmentAmount, grossDue)
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

function transferToTemporal(transfer: Transfer): CashFlowTemporal {
  // Recurring transfers reuse the same temporal shape as income/expense.
  // Defaults are defensive — schema validation should already guarantee these
  // are set when schedule === 'recurring'.
  return {
    start: transfer.start ?? 'immediately',
    start_year: transfer.start_year,
    start_month: transfer.start_month,
    start_age: transfer.start_age,
    end: transfer.end ?? 'never',
    end_year: transfer.end_year,
    end_month: transfer.end_month,
    end_age: transfer.end_age,
    change_over_time: transfer.change_over_time ?? 'none',
    change_percentage: transfer.change_percentage,
  }
}

// Nominal transfer amount that should be applied in the given year. Returns
// zero when the transfer doesn't fire in this year.
function transferAmountForYear(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birthYear: number | undefined,
  inflationRate: Decimal,
): Decimal {
  if (transfer.schedule === 'one_time') {
    return year === transfer.transaction_year ? new Decimal(transfer.amount) : DECIMAL_0
  }
  const temporal = transferToTemporal(transfer)
  const tStart = resolveStartYear(temporal, planStartYear, birthYear)
  const tEnd = resolveEndYear(temporal, birthYear)
  if (year < tStart || year > tEnd) return DECIMAL_0
  const fraction = activeMonthFraction(temporal, year, tStart, tEnd)
  if (fraction.isZero()) return DECIMAL_0
  const yearsSinceStart = year - tStart
  const annual = annualizedAmount(new Decimal(transfer.amount), transfer.frequency ?? 'monthly')
  return annual.mul(growthFactor(temporal, yearsSinceStart, inflationRate)).mul(fraction)
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
  // Direct string parse: ISO date-only strings parse as UTC, so
  // `new Date(...).getFullYear()` is timezone-dependent.
  const startYear = Number(plan.start_date.slice(0, 4))
  const endYear = Number(plan.end_date.slice(0, 4))

  if (endYear < startYear) return []

  const birthYear = profile.birth_date ? Number(profile.birth_date.slice(0, 4)) : undefined

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

  const tangibleAssetLiabilities = tangibleAssets
    .map(financingToLiability)
    .filter((l): l is ProfileLiability => l !== undefined)
  const allLiabilities = [...liabilities, ...tangibleAssetLiabilities]

  const liabilitySchedules = allLiabilities.map((l) => simulateLiability(l, startYear, endYear))

  const initialCashNominal = plan.include_cash === false ? 0 : (profile.cash_amount ?? 0)

  let cashNominal = new Decimal(initialCashNominal)
  const inflationRate = new Decimal(plan.inflation_rate)

  // State-based per-asset balance tracking. Each year we (a) compound
  // investments by APY, (b) apply cash flows to cash, (c) apply transfers
  // between balances. This carries the running balance forward so a transfer
  // in year N affects compounding from year N+1 onward.
  const invBalancesNominal = new Map<string, Decimal>(
    investments.map((i) => [i.id, new Decimal(i.balance)]),
  )
  const tangValuesNominal = new Map<string, Decimal>(
    tangibleAssets.map((a) => [a.id, new Decimal(a.value)]),
  )
  const investmentApy = new Map<string, Decimal>(investments.map((i) => [i.id, new Decimal(i.apy)]))

  // Only honor transfers whose endpoints are part of this plan; anything else
  // is ignored (e.g. a transfer referencing an investment that was excluded).
  const knownAssetIds = new Set<string>([
    'cash',
    ...investments.map((i) => i.id),
    ...tangibleAssets.map((a) => a.id),
  ])
  const planTransfers = (plan.transfers ?? []).filter(
    (t) => knownAssetIds.has(t.from_asset_id) && knownAssetIds.has(t.to_asset_id),
  )

  const projection: YearlyProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    const yearsSincePlanStart = year - startYear

    // 1. Compound investments for this year (skip the first year — initial
    //    balance is the year-0 nominal value).
    if (yearsSincePlanStart > 0) {
      for (const [id, balance] of invBalancesNominal) {
        const apy = investmentApy.get(id) ?? DECIMAL_0
        invBalancesNominal.set(id, balance.mul(DECIMAL_1.plus(apy.div(100))))
      }
    }

    // 2. Liability schedule lookup (no state change here; the schedule is
    //    pre-computed for the full range).
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

    // 3. Income / expense accumulation (unchanged).
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

    if (plan.include_cash !== false) {
      cashNominal = cashNominal
        .plus(incomesThisYearNominal)
        .minus(expensesThisYearNominal)
        .minus(liabilitiesPaidThisYearNominal)
    }

    // 4. Transfer flows for this year. Treat as end-of-year events so the
    //    "from" balance shown for year Y already reflects the withdrawal and
    //    future years compound from the post-transfer balance.
    const transfersOut = new Map<string, Decimal>()
    const transfersIn = new Map<string, Decimal>()
    for (const transfer of planTransfers) {
      const amount = transferAmountForYear(transfer, year, startYear, birthYear, inflationRate)
      if (amount.isZero()) continue
      transfersOut.set(
        transfer.from_asset_id,
        (transfersOut.get(transfer.from_asset_id) ?? DECIMAL_0).plus(amount),
      )
      transfersIn.set(
        transfer.to_asset_id,
        (transfersIn.get(transfer.to_asset_id) ?? DECIMAL_0).plus(amount),
      )
    }

    function withdraw(id: string, amount: Decimal): void {
      if (id === 'cash') {
        cashNominal = Decimal.max(cashNominal.minus(amount), DECIMAL_0)
      } else if (invBalancesNominal.has(id)) {
        invBalancesNominal.set(
          id,
          Decimal.max((invBalancesNominal.get(id) ?? DECIMAL_0).minus(amount), DECIMAL_0),
        )
      } else if (tangValuesNominal.has(id)) {
        tangValuesNominal.set(
          id,
          Decimal.max((tangValuesNominal.get(id) ?? DECIMAL_0).minus(amount), DECIMAL_0),
        )
      }
    }

    function deposit(id: string, amount: Decimal): void {
      if (id === 'cash') {
        cashNominal = cashNominal.plus(amount)
      } else if (invBalancesNominal.has(id)) {
        invBalancesNominal.set(id, (invBalancesNominal.get(id) ?? DECIMAL_0).plus(amount))
      } else if (tangValuesNominal.has(id)) {
        tangValuesNominal.set(id, (tangValuesNominal.get(id) ?? DECIMAL_0).plus(amount))
      }
    }

    for (const [id, amount] of transfersOut) withdraw(id, amount)
    for (const [id, amount] of transfersIn) deposit(id, amount)

    // 5. Aggregate + deflate.
    const investmentsNominal = Array.from(invBalancesNominal.values()).reduce<Decimal>(
      (sum, v) => sum.plus(v),
      DECIMAL_0,
    )
    const tangibleAssetsTotalNominal = Array.from(tangValuesNominal.values()).reduce<Decimal>(
      (sum, v) => sum.plus(v),
      DECIMAL_0,
    )

    // Integer-year deflation: the projection runs in annual buckets, so
    // deflate by (1 + inflation)^yearsSincePlanStart directly. This is the
    // exact inverse of integer-year compounding; using day-based deflation
    // would drift across leap years.
    const deflationFactor = DECIMAL_1.plus(inflationRate).pow(yearsSincePlanStart)
    const cashReal = cashNominal.div(deflationFactor)
    const investmentsReal = investmentsNominal.div(deflationFactor)
    const liabilitiesReal = liabilitiesOutstandingNominal.div(deflationFactor)
    const incomesThisYearReal = incomesThisYearNominal.div(deflationFactor)
    const expensesThisYearReal = expensesThisYearNominal.div(deflationFactor)

    // Tangibles passively track inflation, so their real value equals the
    // current nominal value (after any transfers).
    const tangibleAssetsReal = tangibleAssetsTotalNominal

    const netWorth = cashReal.plus(investmentsReal).plus(tangibleAssetsReal).minus(liabilitiesReal)

    const investmentsByItem: YearlyProjectionItem[] = investments.map((inv) => ({
      id: inv.id,
      name: inv.name,
      value: (invBalancesNominal.get(inv.id) ?? DECIMAL_0).div(deflationFactor).toNumber(),
    }))

    const tangibleAssetsByItem: YearlyProjectionItem[] = tangibleAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      value: (tangValuesNominal.get(asset.id) ?? DECIMAL_0).toNumber(),
    }))

    // Only user-defined liabilities (the first `liabilities.length` schedules);
    // tangible-asset financings are tracked as part of the asset, not as
    // standalone items in the sidebar list.
    const liabilitiesByItem: YearlyProjectionItem[] = liabilities.map((liability, i) => ({
      id: liability.id,
      name: liability.name,
      value: (liabilitySchedules[i].outstandingByYear.get(year) ?? DECIMAL_0)
        .div(deflationFactor)
        .toNumber(),
    }))

    projection.push({
      year,
      cash: cashReal.toNumber(),
      investments: investmentsReal.toNumber(),
      tangibleAssets: tangibleAssetsReal.toNumber(),
      liabilities: liabilitiesReal.toNumber(),
      netWorth: netWorth.toNumber(),
      investmentsByItem,
      tangibleAssetsByItem,
      liabilitiesByItem,
      totalIncome: incomesThisYearReal.toNumber(),
      totalExpenses: expensesThisYearReal.toNumber(),
    })
  }

  return projection
}
