import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths'
import type {
  CashFlowEnd,
  CashFlowStart,
  ChangeOverTime,
  Expense,
  Frequency,
  Income,
  Portfolio,
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
  // Independent toggle that compounds with change_over_time. Legacy data may
  // instead use change_over_time === 'match_inflation' to mean the same thing.
  inflation_adjusted?: boolean
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
  // Progress toward financial independence in this year: investable wealth
  // (cash + investments − standalone liabilities outstanding) as a percent of
  // 25× this year's outflows (living expenses + loan installments).
  // Undefined in years with zero outflows, where the ratio is meaningless.
  fiPercent?: number
  // Years this year's investable wealth could cover this year's outflow
  // level. Undefined in years with zero outflows.
  runwayYears?: number
  // IDs of transfers that were skipped this year because the source did not
  // hold enough balance to cover the move. Used by the sidebar to surface
  // unmet cash flows. Empty in healthy years.
  insufficientFundTransferIds: string[]
  // IDs of investments or tangible assets whose planned purchase could not be
  // funded from cash this year. Kept apart from the transfer ids so the
  // sidebar can point at the asset row the user can actually act on.
  insufficientFundAssetIds: string[]
  // IDs of expenses that were active in a year where cash would have gone
  // negative (i.e. income did not cover expenses + liability payments). We
  // attribute the shortfall to all expenses active that year rather than
  // trying to pick one — order would be arbitrary.
  insufficientFundExpenseIds: string[]
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

// Floor for the effective investment APY: −100% is a total loss.
const DECIMAL_MINUS_100 = new Decimal(-100)

function resolveStartYear(
  cashFlow: CashFlowTemporal,
  planStartYear: number,
  birthYear: number | undefined,
): number {
  if (cashFlow.start === 'immediately') return planStartYear
  // 'now' anchors to the real-world current month at projection time.
  if (cashFlow.start === 'now') return new Date().getFullYear()
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
  // 'now' starts at the real-world current month within the start year.
  if (year === startYear && cashFlow.start === 'now') {
    startMonth = new Date().getMonth() + 1
  }
  if (year === endYear && cashFlow.end === 'at_specific_date' && cashFlow.end_month !== undefined) {
    endMonth = cashFlow.end_month
  }
  const months = endMonth - startMonth + 1
  // Schema validation rejects a same-year start month after the end month and
  // stored data is repaired at load, but not every write path validates (e.g.
  // portfolio transfer updates). Treat such a flow as inactive and warn
  // instead of throwing so the projection keeps rendering. ('now' starts are
  // excluded — a real-world current month past the end month just means the
  // flow already ended.)
  if (months <= 0 && cashFlow.start === 'at_specific_date' && cashFlow.end === 'at_specific_date') {
    console.warn(
      `Cash flow start month (${startMonth}) is after end month (${endMonth}) in ${year}; treating it as inactive`,
    )
  }
  return new Decimal(Math.max(0, months)).div(12)
}

function growthFactor(
  cashFlow: CashFlowTemporal,
  yearsSinceStart: number,
  yearsSincePlanStart: number,
  inflationRate: Decimal,
): Decimal {
  // Inflation factor: applied if the explicit toggle is on OR (legacy) the
  // dropdown still says 'match_inflation'. Anchored to PLAN start, not the
  // cash flow's own start, so the entered amount is interpreted as
  // today's-money and scales forward to the year of execution regardless of
  // when the cash flow itself begins.
  const inflationOn =
    cashFlow.inflation_adjusted === true || cashFlow.change_over_time === 'match_inflation'
  const inflationFactor =
    inflationOn && yearsSincePlanStart > 0
      ? DECIMAL_1.plus(inflationRate).pow(yearsSincePlanStart)
      : DECIMAL_1
  // Change-over-time factor: real-terms growth that starts from the cash
  // flow's own start year and compounds with inflation. A salary can both
  // track inflation AND get a 2% real raise each year.
  let changeFactor = DECIMAL_1
  if (yearsSinceStart > 0) {
    if (cashFlow.change_over_time === 'increase_yearly') {
      changeFactor = DECIMAL_1.plus(new Decimal(cashFlow.change_percentage ?? 0).div(100)).pow(
        yearsSinceStart,
      )
    } else if (cashFlow.change_over_time === 'decrease_yearly') {
      // Clamp to ≤100 % so a decrease can't take the factor negative
      // (which would oscillate sign across integer year exponents).
      const pct = Decimal.min(new Decimal(cashFlow.change_percentage ?? 0), 100)
      changeFactor = DECIMAL_1.minus(pct.div(100)).pow(yearsSinceStart)
    }
  }
  return inflationFactor.mul(changeFactor)
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

// Number of times per year interest is added to the balance when the user
// has opted into a specific compounding cadence. 365 chosen for daily so we
// match the convention most banks quote (actual/365).
const COMPOUNDING_PERIODS_PER_YEAR: Record<'daily' | 'monthly' | 'yearly', number> = {
  daily: 365,
  monthly: 12,
  yearly: 1,
}

/**
 * Total number of installments covered by a `remaining_term` expressed in the
 * given unit. `remaining_term` was historically always in years (multiplied by
 * installments-per-year); `months` divides accordingly so an 18-month, monthly
 * loan pays off 18 times rather than 216.
 *
 * The result may be fractional (e.g. 18 months of monthly = 1.5 years) — the
 * caller's per-period loop already handles a fractional period count by
 * stopping when `periodsRemaining <= 0` and issuing a final balloon.
 */
function remainingTermPeriods(
  remainingTerm: number,
  unit: string | undefined,
  periodsPerYear: number,
): number {
  if (unit === 'months') {
    const years = remainingTerm / 12
    return years * periodsPerYear
  }
  // Absent unit defaults to years (legacy behaviour).
  return remainingTerm * periodsPerYear
}

function simulateLiability(
  liability: ProfileLiability,
  startYear: number,
  endYear: number,
  /**
   * Optional life span, used by a tangible asset's financing: the loan does
   * not exist before the purchase year, and a sale in `lastYear` settles
   * whatever is still owed out of the proceeds.
   */
  window?: { firstYear: number; lastYear: number },
): LiabilitySchedule {
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency]
  // Per-installment rate. Two paths:
  //  - 'simple' (or missing interest_type but compounding_frequency unset →
  //    keep legacy behaviour): nominal rate divided across installments.
  //  - 'compound': convert the nominal annual rate to an effective annual
  //    rate using the chosen compounding frequency, then back out the
  //    equivalent per-installment rate. Defaults to compounding at the
  //    installment frequency so unconfigured liabilities behave identically
  //    to the pre-advanced-options engine.
  const annualRate = new Decimal(liability.annual_rate).div(100)
  let periodRate: Decimal
  if (liability.interest_type === 'simple') {
    periodRate = annualRate.div(periodsPerYear)
  } else {
    const compFreqKey = liability.compounding_frequency
    const compoundingPeriodsPerYear =
      compFreqKey !== undefined ? COMPOUNDING_PERIODS_PER_YEAR[compFreqKey] : periodsPerYear
    // EAR = (1 + r/n)^n − 1; installment rate = (1 + EAR)^(1/p) − 1
    const periodicCompoundRate = annualRate.div(compoundingPeriodsPerYear)
    const ear = DECIMAL_1.plus(periodicCompoundRate).pow(compoundingPeriodsPerYear).minus(DECIMAL_1)
    periodRate = DECIMAL_1.plus(ear).pow(new Decimal(1).div(periodsPerYear)).minus(DECIMAL_1)
  }
  const installmentAmount = new Decimal(liability.installment_amount)

  let balance = new Decimal(liability.outstanding_balance)
  let periodsRemaining = remainingTermPeriods(
    liability.remaining_term,
    liability.remaining_term_unit,
    periodsPerYear,
  )

  const outstandingByYear = new Map<number, Decimal>()
  const paidByYear = new Map<number, Decimal>()

  for (let year = startYear; year <= endYear; year++) {
    let paidThisYear = DECIMAL_0
    // Not taken out yet, or already settled: nothing owed, nothing paid.
    if (window !== undefined && (year < window.firstYear || year > window.lastYear)) {
      outstandingByYear.set(year, year < window.firstYear ? new Decimal(0) : DECIMAL_0)
      paidByYear.set(year, DECIMAL_0)
      if (year > window.lastYear) balance = DECIMAL_0
      continue
    }
    for (let i = 0; i < periodsPerYear; i++) {
      if (periodsRemaining <= 0 || balance.lessThanOrEqualTo(0)) break
      const interest = balance.mul(periodRate)
      const grossDue = balance.plus(interest)
      // Final scheduled installment: pay whatever is owed so the loan reaches
      // zero at the end of `remaining_term`. Without this balloon, slightly
      // under-amortizing inputs leave a residual balance that lingers forever.
      // `<= 1` rather than `=== 1` because the count can be fractional (a
      // months term with a yearly cadence: 18 months -> 1.5 periods), and a
      // fractional countdown never lands exactly on 1.
      const isLastPeriod = periodsRemaining <= 1
      const payment = isLastPeriod ? grossDue : Decimal.min(installmentAmount, grossDue)
      balance = grossDue.minus(payment)
      if (balance.lessThan(0)) balance = DECIMAL_0
      paidThisYear = paidThisYear.plus(payment)
      periodsRemaining -= 1
    }
    // Selling the asset settles the rest of the loan from the proceeds.
    if (window !== undefined && year === window.lastYear && balance.greaterThan(0)) {
      paidThisYear = paidThisYear.plus(balance)
      balance = DECIMAL_0
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
    remaining_term_unit: asset.remaining_term_unit,
    interest_type: asset.interest_type,
    compounding_frequency: asset.compounding_frequency,
  }
}

function investmentToTemporal(investment: ProfileInvestment): CashFlowTemporal {
  // An investment without timing behaves like one held from day one and never
  // sold, which is what the engine did before planned timing existed.
  return {
    start: investment.start ?? 'immediately',
    start_year: investment.start_year,
    start_month: investment.start_month,
    start_age: investment.start_age,
    end: investment.exit ?? 'never',
    end_year: investment.exit_year,
    end_month: investment.exit_month,
    end_age: investment.exit_age,
    change_over_time: 'none',
  }
}

function tangibleToTemporal(asset: ProfileTangibleAsset): CashFlowTemporal {
  // Mirrors investmentToTemporal: an asset without timing is owned from day
  // one and never sold, which is what the engine did before planned timing.
  return {
    start: asset.purchase ?? 'immediately',
    start_year: asset.purchase_year,
    start_month: asset.purchase_month,
    start_age: asset.purchase_age,
    end: asset.sale ?? 'never',
    end_year: asset.sale_year,
    end_month: asset.sale_month,
    end_age: asset.sale_age,
    change_over_time: 'none',
  }
}

interface PlannedWindow {
  /** First year the asset exists. Never before the plan's first year. */
  startYear: number
  /** Last year it exists; Infinity when there is no planned exit/sale. */
  exitYear: number
  /**
   * Whether the asset is bought out of cash when `startYear` arrives. False
   * for one the user already holds — its balance seeds the projection
   * instead, which is what the engine did before planned timing.
   */
  fundsFromCash: boolean
}

function plannedWindow(
  temporal: CashFlowTemporal,
  planStartYear: number,
  birthYear: number | undefined,
): PlannedWindow {
  const resolvedStart = resolveStartYear(temporal, planStartYear, birthYear)
  return {
    // A start before the plan window would never fire as a one-time transfer,
    // so clamp it: the position is simply already held.
    startYear: Math.max(resolvedStart, planStartYear),
    exitYear: resolveEndYear(temporal, birthYear),
    fundsFromCash: resolvedStart > planStartYear,
  }
}

// The synthetic transfers are recognised by id so the year loop can treat
// them differently from the user's own transfers without threading a parallel
// structure through it.
const PLANNED_START_PREFIX = 'planned-buy-'
const PLANNED_EXIT_PREFIX = 'planned-sell-'

function plannedBuyAssetId(transfer: Transfer): string | undefined {
  return transfer.id.startsWith(PLANNED_START_PREFIX)
    ? transfer.id.slice(PLANNED_START_PREFIX.length)
    : undefined
}

function isPlannedSell(transfer: Transfer): boolean {
  return transfer.id.startsWith(PLANNED_EXIT_PREFIX)
}

/**
 * Planned buy/sell of an investment, expressed as one-time transfers so the
 * whole tested transfer path — balance checks, entry/exit fees, the
 * insufficient-funds warning — applies without duplicating it here. The sell
 * sweeps whatever the investment is worth at that point, so it needs no
 * amount.
 *
 * The buy is deliberately nominal: the price the user typed is what leaves
 * cash in the purchase year, with no `inflation_adjusted` equivalent. A price
 * quoted today for a purchase in 2040 is the user's own estimate, and silently
 * inflating it would make the number they entered not the number they pay.
 */
const emptyWindow: PlannedWindow = {
  startYear: Number.NEGATIVE_INFINITY,
  exitYear: Number.POSITIVE_INFINITY,
  fundsFromCash: false,
}

function plannedTimingTransfers(
  asset: { id: string; name: string },
  /** What leaves cash on the way in — the full price, or only a down payment. */
  buyAmount: number,
  window: PlannedWindow,
): { start?: Transfer; exit?: Transfer } {
  const start: Transfer | undefined = window.fundsFromCash
    ? {
        id: `${PLANNED_START_PREFIX}${asset.id}`,
        name: asset.name,
        from_asset_id: 'cash',
        to_asset_id: asset.id,
        amount: buyAmount,
        schedule: 'one_time',
        transaction_year: window.startYear,
      }
    : undefined
  const exit: Transfer | undefined = Number.isFinite(window.exitYear)
    ? {
        id: `${PLANNED_EXIT_PREFIX}${asset.id}`,
        name: asset.name,
        from_asset_id: asset.id,
        to_asset_id: 'cash',
        amount: 0,
        transfer_all: true,
        schedule: 'one_time',
        transaction_year: window.exitYear,
      }
    : undefined
  return { start, exit }
}

/** Cash paid at purchase: the whole price, or just the down payment. */
function purchaseCashAmount(asset: ProfileTangibleAsset): number {
  if (asset.status !== 'financed') return asset.value
  return Math.max(asset.value - (asset.outstanding_balance ?? 0), 0)
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
    inflation_adjusted: transfer.inflation_adjusted,
    change_over_time: transfer.change_over_time ?? 'none',
    change_percentage: transfer.change_percentage,
  }
}

// Whether the transfer should fire in the given year (independent of amount).
function isTransferActiveThisYear(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birthYear: number | undefined,
): boolean {
  if (transfer.schedule === 'one_time') return year === transfer.transaction_year
  const temporal = transferToTemporal(transfer)
  const tStart = resolveStartYear(temporal, planStartYear, birthYear)
  const tEnd = resolveEndYear(temporal, birthYear)
  if (year < tStart || year > tEnd) return false
  return !activeMonthFraction(temporal, year, tStart, tEnd).isZero()
}

// Nominal transfer amount that should be applied in the given year (for
// fixed-amount transfers only — caller should use the live source balance
// instead when `transfer.transfer_all` is true).
function transferAmountForYear(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birthYear: number | undefined,
  inflationRate: Decimal,
): Decimal {
  if (transfer.schedule === 'one_time') {
    if (year !== transfer.transaction_year) return DECIMAL_0
    // For one-time transfers the amount is interpreted as today's-money when
    // inflation_adjusted is on, so we scale it forward to the transaction
    // year. yearsSinceStart can't go negative — a transfer before plan start
    // is already filtered by the year === transaction_year check above only
    // when the plan contains that year.
    const base = new Decimal(transfer.amount)
    if (!transfer.inflation_adjusted) return base
    const yearsForward = Math.max(0, year - planStartYear)
    return base.mul(DECIMAL_1.plus(inflationRate).pow(yearsForward))
  }
  const temporal = transferToTemporal(transfer)
  const tStart = resolveStartYear(temporal, planStartYear, birthYear)
  const tEnd = resolveEndYear(temporal, birthYear)
  if (year < tStart || year > tEnd) return DECIMAL_0
  const fraction = activeMonthFraction(temporal, year, tStart, tEnd)
  if (fraction.isZero()) return DECIMAL_0
  const yearsSinceStart = year - tStart
  const yearsSincePlanStart = year - planStartYear
  const annual = annualizedAmount(new Decimal(transfer.amount), transfer.frequency ?? 'monthly')
  return annual
    .mul(growthFactor(temporal, yearsSinceStart, yearsSincePlanStart, inflationRate))
    .mul(fraction)
}

/**
 * Sum the annualized, grown, month-fractioned nominal amounts of the cash
 * flows active in `year`, and report which items were active. `growthFactor`
 * takes both the years-since-the-cash-flow-started (for change_over_time
 * growth) and the years-since-plan-start (for the inflation factor, which is
 * always anchored to plan start so the entered amount is consistently
 * interpreted as today's-money).
 */
function accumulateCashFlows<T extends CashFlowTemporal & { id: string; frequency: Frequency }>(
  items: T[],
  year: number,
  planStartYear: number,
  birthYear: number | undefined,
  inflationRate: Decimal,
  getAmount: (item: T) => Decimal,
): { total: Decimal; activeIds: string[] } {
  let total = DECIMAL_0
  const activeIds: string[] = []
  for (const item of items) {
    const itemStart = resolveStartYear(item, planStartYear, birthYear)
    const itemEnd = resolveEndYear(item, birthYear)
    if (year < itemStart || year > itemEnd) continue
    const fraction = activeMonthFraction(item, year, itemStart, itemEnd)
    if (fraction.isZero()) continue
    const annual = annualizedAmount(getAmount(item), item.frequency)
    total = total.plus(
      annual
        .mul(growthFactor(item, year - itemStart, year - planStartYear, inflationRate))
        .mul(fraction),
    )
    activeIds.push(item.id)
  }
  return { total, activeIds }
}

export function filterById<T extends { id: string }>(
  items: T[] | undefined,
  includedIds: string[] | undefined,
): T[] {
  if (!items) return []
  if (!includedIds) return items
  const set = new Set(includedIds)
  return items.filter((item) => set.has(item.id))
}

/**
 * Year of a date-only ISO string (`YYYY-MM-DD`), parsed directly from the
 * string. ISO date-only strings parse as UTC, so `new Date(...).getFullYear()`
 * shifts first-of-year dates back a year in UTC-negative timezones — use this
 * whenever only the year is needed. When an actual `Date` is required, use
 * `parseDateOnly()` from `$lib/utils`, which parses to local midnight.
 */
export function yearOf(dateString: string): number {
  return Number(dateString.slice(0, 4))
}

export function getYearlyPlanProjection(plan: Portfolio, profile: Profile): YearlyProjection[] {
  const startYear = yearOf(plan.start_date)
  const endYear = yearOf(plan.end_date)

  if (endYear < startYear) return []

  const birthYear = profile.birth_date ? yearOf(profile.birth_date) : undefined

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

  // One map for both kinds: investments and tangible assets share the planned
  // buy/sell machinery, so the transfer loop guards them with the same check.
  const assetWindows = new Map<string, PlannedWindow>([
    ...investments.map((i): [string, PlannedWindow] => [
      i.id,
      plannedWindow(investmentToTemporal(i), startYear, birthYear),
    ]),
    ...tangibleAssets.map((a): [string, PlannedWindow] => [
      a.id,
      plannedWindow(tangibleToTemporal(a), startYear, birthYear),
    ]),
  ])

  // A financed asset's loan only runs while the asset is owned: it starts at
  // the purchase year and a sale settles whatever is left. Standalone
  // liabilities have no window and run for the whole plan, as before.
  const tangibleAssetLiabilities = tangibleAssets
    .map((asset) => ({ asset, liability: financingToLiability(asset) }))
    .filter(
      (x): x is { asset: ProfileTangibleAsset; liability: ProfileLiability } =>
        x.liability !== undefined,
    )

  const standaloneSchedules = liabilities.map((l) => simulateLiability(l, startYear, endYear))
  const financedSchedules = tangibleAssetLiabilities.map(({ asset, liability }) => {
    const window = assetWindows.get(asset.id)
    return {
      assetId: asset.id,
      schedule: simulateLiability(
        liability,
        startYear,
        endYear,
        window === undefined
          ? undefined
          : { firstYear: window.startYear, lastYear: window.exitYear },
      ),
    }
  })

  // A planned purchase the plan could not afford never happens: the asset is
  // not acquired, so its financing must not run either. Recorded once and
  // honoured for every following year — the buy is a one-time transfer, so it
  // is never retried.
  const abandonedAssetIds = new Set<string>()

  const initialCashNominal = plan.include_cash === false ? 0 : (profile.cash_amount ?? 0)

  let cashNominal = new Decimal(initialCashNominal)
  const inflationRate = new Decimal(plan.inflation_rate)

  // State-based per-asset balance tracking. Each year we (a) compound
  // investments by APY, (b) apply cash flows to cash, (c) apply transfers
  // between balances. This carries the running balance forward so a transfer
  // in year N affects compounding from year N+1 onward.
  // A future-start investment is not held yet, so it starts at 0 and its
  // synthetic buy (below) pays the balance in when the start year arrives.
  // Held from the plan's first year: not bought later, and not already sold
  // before the plan even starts (an exit in the past never fires as a
  // one-time transfer, so seeding the balance would strand it forever).
  function heldAtPlanStart(id: string): boolean {
    const window = assetWindows.get(id)
    if (window === undefined) return true
    return !window.fundsFromCash && window.exitYear >= startYear
  }
  const invBalancesNominal = new Map<string, Decimal>(
    investments.map((i) => [i.id, heldAtPlanStart(i.id) ? new Decimal(i.balance) : DECIMAL_0]),
  )
  // A not-yet-purchased asset starts at 0; its synthetic buy (plus the
  // lender-funded part, below) brings it to full value in the purchase year.
  const tangValuesNominal = new Map<string, Decimal>(
    tangibleAssets.map((a) => [a.id, heldAtPlanStart(a.id) ? new Decimal(a.value) : DECIMAL_0]),
  )
  // Per-investment lookup so the transfer loop can apply entry/exit fees by
  // asset id without re-scanning the array.
  const investmentsById = new Map<string, ProfileInvestment>(investments.map((i) => [i.id, i]))
  // Effective APY = APY − TER − ongoing portion of the entry fee. The ongoing
  // entry-fee component models the year-after-year drag (whole fee for
  // 'ongoing', 60% for 'forty-sixty', 0 for 'upfront'). Floored at −100% (a
  // total loss) so the yearly multiplier bottoms out at 0 — fees exceeding
  // 100 + APY would otherwise flip the multiplier negative and make the
  // balance oscillate in sign.
  const investmentApy = new Map<string, Decimal>(
    investments.map((i) => {
      const apy = new Decimal(i.apy)
      const ter = new Decimal(i.ter ?? 0)
      const entryFee = new Decimal(i.entry_fee ?? 0)
      let ongoingDrag = DECIMAL_0
      if (i.entry_fee_type === 'ongoing') ongoingDrag = entryFee
      else if (i.entry_fee_type === 'forty-sixty') ongoingDrag = entryFee.mul(0.6)
      return [i.id, Decimal.max(apy.minus(ter).minus(ongoingDrag), DECIMAL_MINUS_100)]
    }),
  )

  // Nominal yearly multiplier per tangible asset. Absent value_over_time it
  // is the inflation factor (real value flat); appreciate/depreciate replace
  // it with the user's nominal rate. Floored at 0 — a total write-off.
  const tangibleGrowth = new Map<string, Decimal>(
    tangibleAssets.flatMap((a) => {
      if (a.value_over_time === undefined) return []
      const rate = new Decimal(a.value_rate ?? 0).div(100)
      const signed = a.value_over_time === 'depreciate' ? rate.negated() : rate
      return [[a.id, Decimal.max(DECIMAL_1.plus(signed), DECIMAL_0)] as [string, Decimal]]
    }),
  )

  // Only honor transfers whose endpoints are part of this plan; anything else
  // is ignored (e.g. a transfer referencing an investment that was excluded).
  // Also honor the plan's `included_transfer_ids` whitelist when set. Transfers
  // live on the profile and are referenced by the plan by id, mirroring how
  // incomes and expenses behave.
  const knownAssetIds = new Set<string>([
    'cash',
    ...investments.map((i) => i.id),
    ...tangibleAssets.map((a) => a.id),
  ])
  // Planned buys/sells belong to their investment, not to the profile's
  // transfer list, so they bypass the included_transfer_ids whitelist. Buys
  // run before the user's transfers so a same-year contribution lands in a
  // live investment, and sells run last so that contribution is swept out
  // with the rest rather than stranded in a liquidated asset.
  const timingTransfers = [
    ...investments.map((i) =>
      plannedTimingTransfers(i, i.balance, assetWindows.get(i.id) ?? emptyWindow),
    ),
    ...tangibleAssets.map((a) =>
      plannedTimingTransfers(a, purchaseCashAmount(a), assetWindows.get(a.id) ?? emptyWindow),
    ),
  ]
  const planTransfers = [
    ...timingTransfers.map((t) => t.start).filter((t): t is Transfer => t !== undefined),
    ...filterById(profile.transfers, plan.included_transfer_ids).filter(
      (t) => knownAssetIds.has(t.from_asset_id) && knownAssetIds.has(t.to_asset_id),
    ),
    ...timingTransfers.map((t) => t.exit).filter((t): t is Transfer => t !== undefined),
  ]

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
      // Tangibles passively track inflation: compound the nominal value at
      // the inflation rate so the real value stays flat absent transfers.
      // Keeping this balance truly nominal (instead of treating it as
      // already-real) is what makes transfers unit-consistent — withdraw()
      // and deposit() move nominal amounts between cash, investments, and
      // tangibles, so mixing units would create or destroy net worth. An
      // asset with its own value_over_time rate compounds at that instead.
      for (const [id, value] of tangValuesNominal) {
        tangValuesNominal.set(
          id,
          value.mul(tangibleGrowth.get(id) ?? DECIMAL_1.plus(inflationRate)),
        )
      }
    }

    // 2. Income / expense accumulation (see accumulateCashFlows).
    const incomesThisYearNominal = accumulateCashFlows(
      incomes,
      year,
      startYear,
      birthYear,
      inflationRate,
      netIncome,
    ).total
    const { total: cashFlowExpensesNominal, activeIds: activeExpenseIdsThisYear } =
      accumulateCashFlows(
        expenses,
        year,
        startYear,
        birthYear,
        inflationRate,
        (expense) => new Decimal(expense.amount),
      )
    // 3. Apply income to cash up front, then run transfers, then settle
    //    expenses + liability payments. Doing transfers before the cash check
    //    is what lets a transfer-into-cash (e.g. drawing from an investment
    //    to fund a monthly expense) actually cover that expense instead of
    //    being booked too late and tripping a spurious insufficient-funds
    //    warning.
    if (plan.include_cash !== false) {
      cashNominal = cashNominal.plus(incomesThisYearNominal)
    }

    // 4. Transfer flows for this year. Each transfer is applied atomically:
    //    if the source balance is less than the requested amount, the entire
    //    transfer is skipped (no partial move, no overdraft). Balances after
    //    transfers are what's shown for year Y and what next year's
    //    compounding works from.
    function getBalance(id: string): Decimal {
      if (id === 'cash') return cashNominal
      if (invBalancesNominal.has(id)) return invBalancesNominal.get(id) ?? DECIMAL_0
      if (tangValuesNominal.has(id)) return tangValuesNominal.get(id) ?? DECIMAL_0
      return DECIMAL_0
    }

    function withdraw(id: string, amount: Decimal): void {
      if (id === 'cash') {
        cashNominal = cashNominal.minus(amount)
      } else if (invBalancesNominal.has(id)) {
        invBalancesNominal.set(id, (invBalancesNominal.get(id) ?? DECIMAL_0).minus(amount))
      } else if (tangValuesNominal.has(id)) {
        tangValuesNominal.set(id, (tangValuesNominal.get(id) ?? DECIMAL_0).minus(amount))
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

    // Exit fee bites the withdrawal before it lands at the destination —
    // sells/redemptions usually take the fee out of proceeds, so the source
    // loses `amount` but the destination receives less.
    function applyExitFee(fromId: string, amount: Decimal): Decimal {
      const inv = investmentsById.get(fromId)
      if (!inv || !inv.exit_fee) return amount
      const exitFee = new Decimal(inv.exit_fee)
      if (inv.exit_fee_type === 'fixed') {
        return Decimal.max(amount.minus(exitFee), DECIMAL_0)
      }
      // Default to percentage (matches the schema default and Figma).
      return Decimal.max(amount.mul(DECIMAL_1.minus(exitFee.div(100))), DECIMAL_0)
    }

    // Entry fee bites the deposit — for 'upfront' the whole fee comes out of
    // the inflow; 'forty-sixty' takes 40 % upfront and amortizes the rest via
    // the APY drag set up above; 'ongoing' takes none here (all drag).
    function applyEntryFee(toId: string, amount: Decimal): Decimal {
      const inv = investmentsById.get(toId)
      if (!inv || !inv.entry_fee) return amount
      const entryFee = new Decimal(inv.entry_fee)
      let upfrontPct = DECIMAL_0
      if (inv.entry_fee_type === 'upfront') upfrontPct = entryFee
      else if (inv.entry_fee_type === 'forty-sixty') upfrontPct = entryFee.mul(0.4)
      if (upfrontPct.isZero()) return amount
      return Decimal.max(amount.mul(DECIMAL_1.minus(upfrontPct.div(100))), DECIMAL_0)
    }

    // An investment only takes part in transfers between its start and exit
    // years — money must not flow into one the user has not bought yet, or
    // into one they have already sold. Non-investment endpoints always pass.
    function isEndpointActive(id: string): boolean {
      const window = assetWindows.get(id)
      if (!window) return true
      return year >= window.startYear && year <= window.exitYear
    }

    const insufficientFundTransferIdsThisYear: string[] = []
    const insufficientFundAssetIdsThisYear: string[] = []
    for (const transfer of planTransfers) {
      if (!isTransferActiveThisYear(transfer, year, startYear, birthYear)) continue
      // The synthetic buy is what makes its asset active, so it is exempt
      // from the endpoint check on the way in.
      const plannedStartFor = plannedBuyAssetId(transfer)
      if (plannedStartFor === undefined) {
        if (!isEndpointActive(transfer.from_asset_id) || !isEndpointActive(transfer.to_asset_id))
          continue
      }
      let amount: Decimal
      if (transfer.transfer_all) {
        // "Max" mode: take whatever the source has at execution time. If the
        // source is empty when the transfer fires we flag it — the user
        // intended a sweep that produced nothing. A planned exit of an empty
        // investment is not a plan failure, so it stays silent.
        amount = getBalance(transfer.from_asset_id)
        if (amount.lessThanOrEqualTo(0)) {
          if (!isPlannedSell(transfer)) insufficientFundTransferIdsThisYear.push(transfer.id)
          continue
        }
      } else {
        amount = transferAmountForYear(transfer, year, startYear, birthYear, inflationRate)
        if (amount.isZero()) continue
        if (getBalance(transfer.from_asset_id).lessThan(amount)) {
          if (plannedStartFor !== undefined) {
            insufficientFundAssetIdsThisYear.push(plannedStartFor)
            abandonedAssetIds.add(plannedStartFor)
          } else {
            insufficientFundTransferIdsThisYear.push(transfer.id)
          }
          continue
        }
      }
      // Source loses the full `amount`. Destination receives what's left
      // after the exit fee on the way out and the upfront entry fee on the
      // way in. Difference is lost to the broker.
      withdraw(transfer.from_asset_id, amount)
      const netToDestination = applyEntryFee(
        transfer.to_asset_id,
        applyExitFee(transfer.from_asset_id, amount),
      )
      deposit(transfer.to_asset_id, netToDestination)
    }

    // 5. The lender funds the rest of a financed purchase, so the asset is
    //    worth its full price from the purchase year even though only the
    //    down payment left cash. Net worth is unchanged: the financing
    //    liability starts the same year. Runs after the transfer loop so a
    //    down payment the plan could not afford books nothing at all — the
    //    fully-owned path gets that for free by never reaching its deposit.
    for (const asset of tangibleAssets) {
      const window = assetWindows.get(asset.id)
      if (!window?.fundsFromCash || year !== window.startYear) continue
      if (asset.status !== 'financed' || !asset.outstanding_balance) continue
      if (abandonedAssetIds.has(asset.id)) continue
      tangValuesNominal.set(
        asset.id,
        (tangValuesNominal.get(asset.id) ?? DECIMAL_0).plus(new Decimal(asset.outstanding_balance)),
      )
    }

    // 6. Liability schedules (pre-computed for the full range, no state change
    //    here) and property tax, both settled from post-transfer cash below.
    //    An abandoned purchase owes nothing and is taxed on nothing.
    let liabilitiesOutstandingNominal = DECIMAL_0
    let liabilitiesPaidThisYearNominal = DECIMAL_0
    function addSchedule(schedule: LiabilitySchedule): void {
      liabilitiesOutstandingNominal = liabilitiesOutstandingNominal.plus(
        schedule.outstandingByYear.get(year) ?? DECIMAL_0,
      )
      liabilitiesPaidThisYearNominal = liabilitiesPaidThisYearNominal.plus(
        schedule.paidByYear.get(year) ?? DECIMAL_0,
      )
    }
    for (const schedule of standaloneSchedules) addSchedule(schedule)
    for (const { assetId, schedule } of financedSchedules) {
      if (!abandonedAssetIds.has(assetId)) addSchedule(schedule)
    }
    // Property tax is charged on the purchase price — deliberately the flat
    // nominal value, not the inflated or appreciated one — for every year the
    // asset is held, and settled from cash alongside the ordinary expenses.
    const propertyTaxThisYearNominal = tangibleAssets.reduce<Decimal>((sum, asset) => {
      if (!asset.property_tax_rate || abandonedAssetIds.has(asset.id)) return sum
      const window = assetWindows.get(asset.id)
      if (window && (year < window.startYear || year > window.exitYear)) return sum
      return sum.plus(new Decimal(asset.value).mul(new Decimal(asset.property_tax_rate).div(100)))
    }, DECIMAL_0)
    const expensesThisYearNominal = cashFlowExpensesNominal.plus(propertyTaxThisYearNominal)

    // 7. Settle expenses + liability payments against post-transfer cash.
    //    If the result would go negative, flag every expense active this
    //    year. Liabilities are part of the overflow math (they also drain
    //    cash) but aren't blamed in the sidebar today.
    const insufficientFundExpenseIdsThisYear: string[] = []
    if (plan.include_cash !== false) {
      const attemptedCashNominal = cashNominal
        .minus(expensesThisYearNominal)
        .minus(liabilitiesPaidThisYearNominal)
      if (attemptedCashNominal.lessThan(0)) {
        insufficientFundExpenseIdsThisYear.push(...activeExpenseIdsThisYear)
      }
      cashNominal = Decimal.max(attemptedCashNominal, DECIMAL_0)
    }

    // 8. Aggregate + deflate.
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

    const tangibleAssetsReal = tangibleAssetsTotalNominal.div(deflationFactor)

    const netWorth = cashReal.plus(investmentsReal).plus(tangibleAssetsReal).minus(liabilitiesReal)

    // Defensive output clamp: balances are conceptually >= 0; any tiny
    // negative residual from Decimal arithmetic or `-0` from
    // `Decimal.minus` would otherwise display as "-EUR 0" via Intl.
    const clampNonNeg = (d: Decimal): number => Math.max(0, d.toNumber())

    const investmentsByItem: YearlyProjectionItem[] = investments.map((inv) => ({
      id: inv.id,
      name: inv.name,
      value: clampNonNeg((invBalancesNominal.get(inv.id) ?? DECIMAL_0).div(deflationFactor)),
    }))

    const tangibleAssetsByItem: YearlyProjectionItem[] = tangibleAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      value: clampNonNeg((tangValuesNominal.get(asset.id) ?? DECIMAL_0).div(deflationFactor)),
    }))

    // Only user-defined liabilities; tangible-asset financings are tracked as
    // part of the asset, not as standalone items in the sidebar list.
    const liabilitiesByItem: YearlyProjectionItem[] = liabilities.map((liability, i) => ({
      id: liability.id,
      name: liability.name,
      value: clampNonNeg(
        (standaloneSchedules[i].outstandingByYear.get(year) ?? DECIMAL_0).div(deflationFactor),
      ),
    }))

    // 9. Per-year FI % and runway, mirroring the dashboard's snapshot
    //    formulas (getFiPercent/getRunwayYears in financial-totals.ts):
    //    investable wealth excludes tangibles and subtracts only standalone
    //    liabilities (a mortgage is secured by its asset), while outflows
    //    include every installment actually paid this year. Numerator and denominator are both nominal,
    //    so the deflator cancels and the ratio is basis-independent.
    const standaloneOutstandingNominal = standaloneSchedules.reduce<Decimal>(
      (sum, s) => sum.plus(s.outstandingByYear.get(year) ?? DECIMAL_0),
      DECIMAL_0,
    )
    const outflowsNominal = expensesThisYearNominal.plus(liabilitiesPaidThisYearNominal)
    const investableNominal = cashNominal
      .plus(investmentsNominal)
      .minus(standaloneOutstandingNominal)
    let fiPercent: number | undefined
    let runwayYears: number | undefined
    if (outflowsNominal.greaterThan(0)) {
      fiPercent = Math.max(0, investableNominal.div(outflowsNominal.mul(25)).mul(100).toNumber())
      runwayYears = Math.max(0, investableNominal.div(outflowsNominal).toNumber())
    }

    projection.push({
      year,
      cash: clampNonNeg(cashReal),
      investments: clampNonNeg(investmentsReal),
      tangibleAssets: clampNonNeg(tangibleAssetsReal),
      liabilities: clampNonNeg(liabilitiesReal),
      netWorth: netWorth.toNumber(),
      investmentsByItem,
      tangibleAssetsByItem,
      liabilitiesByItem,
      totalIncome: incomesThisYearReal.toNumber(),
      totalExpenses: expensesThisYearReal.toNumber(),
      fiPercent,
      runwayYears,
      insufficientFundTransferIds: insufficientFundTransferIdsThisYear,
      insufficientFundAssetIds: insufficientFundAssetIdsThisYear,
      insufficientFundExpenseIds: insufficientFundExpenseIdsThisYear,
    })
  }

  return projection
}
