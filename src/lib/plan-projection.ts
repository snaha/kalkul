import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths'
import { DEFAULT_FI_WITHDRAWAL_RATE } from '$lib/schemas'
import type {
  CashFlowEnd,
  CashFlowSchedule,
  CashFlowStart,
  ChangeOverTime,
  CompoundingFrequency,
  Expense,
  Frequency,
  Income,
  InterestType,
  Portfolio,
  Profile,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
  Transfer,
} from '$lib/schemas'

// Common temporal shape shared by Income, Expense, and recurring Transfer.
/**
 * The start/end edges that window a cash flow, a held investment or an owned
 * asset. Split out from `CashFlowTemporal` because resolving *when* something
 * runs needs only these — a recurring transfer's edges are read this way
 * without inventing the growth fields it has no use for.
 */
export interface TimingWindow {
  start: CashFlowStart
  start_year?: number
  start_month?: number
  start_age?: number
  end: CashFlowEnd
  end_year?: number
  end_month?: number
  end_age?: number
}

interface CashFlowTemporal extends TimingWindow {
  // Independent toggle that compounds with change_over_time. Legacy data may
  // instead use change_over_time === 'match_inflation' to mean the same thing.
  inflation_adjusted?: boolean
  change_over_time: ChangeOverTime
  change_percentage?: number
}

/**
 * The transfer endpoint standing for the profile's cash, as the editor writes
 * it. Owned here because the projection is what gives it meaning; the
 * carry-forward in `current-values.ts` reads the same transfers.
 */
export const CASH_ENDPOINT = 'cash'

export interface YearlyProjectionItem {
  id: string
  name: string
  value: number
  // Set on a liabilities row that is the loan behind a financed tangible
  // asset: the asset it belongs to. The row is named after the asset.
  assetId?: string
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
  // Expenses plus property tax. Loan installments are apart, in
  // `totalInstallments`.
  totalExpenses: number
  // What the year's cash flow is made of, in the same real terms as the
  // totals. Only what is active in the year is listed: the incomes and
  // expenses that fire, the property tax of each taxed asset held, and the
  // installments paid on each loan (named like `liabilitiesByItem`).
  incomesByItem: YearlyProjectionItem[]
  expensesByItem: YearlyProjectionItem[]
  propertyTaxByItem: YearlyProjectionItem[]
  installmentsByItem: YearlyProjectionItem[]
  totalInstallments: number
  // What each investment loses to fees in the year: the TER and ongoing entry
  // fee taken off its growth, plus the upfront entry fee on what is paid in and
  // the exit fee on what is taken out, planned buys and sells included.
  investmentFeesByItem: YearlyProjectionItem[]
  // The tax each of the plan's own transfers deducts in the year.
  transferTaxByItem: YearlyProjectionItem[]
  // The year's cash flow: income less expenses, property tax, installments,
  // investment fees and transfer tax (docs/product/projections.md). Transfers
  // stay out of it.
  cashFlow: number
  // The plan's own transfers active in the year, each with the amount that
  // left its source: 0 when the transfer was skipped for lack of funds. The
  // planned buy and sell of an asset are not transfers the user entered and
  // stay out.
  transfersByItem: YearlyProjectionItem[]
  // Portfolio value, also called investable net worth: cash plus investments
  // minus the loans not secured by an asset (docs/product/net-worth.md). It is
  // what `fiPercent` and `runwayYears` are measured on.
  portfolioValue: number
  // Progress toward financial independence in this year: investable wealth
  // (cash + investments − standalone liabilities outstanding) as a percent of
  // the FI number: this year's outflows (living expenses + loan installments)
  // × 100 / the profile's withdrawal rate, 25× at the default 4%. The plan's
  // first year counts its months' outflows scaled to twelve months.
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
export const INSTALLMENT_PERIODS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1,
}

// Floor for the effective investment APY: −100% is a total loss.
const DECIMAL_MINUS_100 = new Decimal(-100)

function resolveStartYear(
  cashFlow: CashFlowTemporal,
  planStartYear: number,
  birth: Birth | undefined,
): number {
  if (cashFlow.start === 'immediately') return planStartYear
  // 'now' anchors to the real-world current month at projection time.
  if (cashFlow.start === 'now') return new Date().getFullYear()
  if (cashFlow.start === 'at_specific_date') return cashFlow.start_year ?? planStartYear
  if (cashFlow.start === 'when_age_is' && birth !== undefined && cashFlow.start_age !== undefined)
    return birth.year + cashFlow.start_age
  return planStartYear
}

function resolveEndYear(cashFlow: CashFlowTemporal, birth: Birth | undefined): number {
  if (cashFlow.end === 'never') return Number.POSITIVE_INFINITY
  if (cashFlow.end === 'at_specific_date') return cashFlow.end_year ?? Number.POSITIVE_INFINITY
  if (cashFlow.end === 'when_age_is' && birth !== undefined && cashFlow.end_age !== undefined)
    return birth.year + cashFlow.end_age
  return Number.POSITIVE_INFINITY
}

/**
 * The year a standalone liability is taken on. Undefined means "runs from the
 * plan's first year", which is the absent/'immediately' case — so the schedule
 * can defer the loan without needing the plan's start year here.
 */
function liabilityStartYear(
  liability: ProfileLiability,
  birth: Birth | undefined,
): number | undefined {
  if (liability.start === undefined || liability.start === 'immediately') return undefined
  if (liability.start === 'now') return new Date().getFullYear()
  if (liability.start === 'at_specific_date') return liability.start_year
  if (liability.start === 'when_age_is' && birth !== undefined && liability.start_age !== undefined)
    return birth.year + liability.start_age
  return undefined
}

/** The year a standalone liability is paid off early, or undefined when it runs its term. */
function liabilityPayOffYear(liability: ProfileLiability): number | undefined {
  return liability.pay_off === 'at_specific_date' ? liability.pay_off_year : undefined
}

/**
 * A per-period amount as a yearly one. Exported so the dashboard totals in
 * `financial-totals.ts` annualize exactly like the projection does instead of
 * keeping their own copy of the periods-per-year table.
 */
export function annualizedAmount(amount: Decimal, frequency: Frequency): Decimal {
  return amount.mul(FLOW_PERIODS_PER_YEAR[frequency])
}

function activeMonthFraction(
  cashFlow: CashFlowTemporal,
  year: number,
  startYear: number,
  endYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): Decimal {
  const [from, to] = activeMonthRange(cashFlow, year, startYear, endYear, birth, planStart)
  return new Decimal(Math.max(0, to - from + 1)).div(12)
}

/**
 * The first and last month (1..12) a recurring flow runs in `year`; empty when
 * last < first. Nothing runs before the plan's start month.
 */
function activeMonthRange(
  cashFlow: CashFlowTemporal,
  year: number,
  startYear: number,
  endYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): [number, number] {
  let startMonth = 1
  let endMonth = 12
  // An age is reached in the birthday month: a start at an age runs from it,
  // an end at an age stops before it (docs/product/projections.md).
  if (birth !== undefined) {
    if (year === startYear && cashFlow.start === 'when_age_is') startMonth = birth.month
    if (year === endYear && cashFlow.end === 'when_age_is') endMonth = birth.month - 1
  }
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
  // After the check above: a flow that ended before the plan starts is valid
  // data, not a start after its end.
  if (year === planStart.year) startMonth = Math.max(startMonth, planStart.month)
  return [startMonth, endMonth]
}

/**
 * The plan's start month, where its first year begins and its today's money
 * is anchored, with the inflation that counts months from it.
 */
interface PlanStart {
  year: number
  month: number
  // (1 + rate)^(1/12), and its powers by month as they are asked for: a
  // fractional Decimal pow is ~100× an integer one and runs per flow-month.
  monthly: Decimal
  byMonths: Map<number, Decimal>
}

function planStartOf(plan: Pick<Portfolio, 'start_date' | 'inflation_rate'>): PlanStart {
  return {
    year: yearOf(plan.start_date),
    month: Number(plan.start_date.slice(5, 7)),
    monthly: DECIMAL_1.plus(plan.inflation_rate).pow(new Decimal(1).div(12)),
    byMonths: new Map(),
  }
}

/**
 * How much prices have risen by month `month` (1..12) of `year` since the
 * plan's start month: (1 + rate)^(months / 12). 1 at or before the start.
 */
function inflationFactor(planStart: PlanStart, year: number, month: number): Decimal {
  const months = (year - planStart.year) * 12 + month - planStart.month
  if (months <= 0) return DECIMAL_1
  let factor = planStart.byMonths.get(months)
  if (factor === undefined) {
    factor = planStart.monthly.pow(months)
    planStart.byMonths.set(months, factor)
  }
  return factor
}

/** A flow's amount in a year, as paid and in the plan's start-month money. */
interface FlowAmount {
  nominal: Decimal
  real: Decimal
}

const NO_AMOUNT: FlowAmount = { nominal: DECIMAL_0, real: DECIMAL_0 }

/**
 * `perMonth` paid in each month from `from` to `to` of `year`. An amount that
 * follows inflation is in today's money and grows with each month's prices;
 * any other is paid as entered and is worth less each month in today's money.
 */
function monthlyAmounts(
  perMonth: Decimal,
  inflationAdjusted: boolean,
  planStart: PlanStart,
  year: number,
  from: number,
  to: number,
): FlowAmount {
  let nominal = DECIMAL_0
  let real = DECIMAL_0
  for (let month = from; month <= to; month++) {
    const factor = inflationFactor(planStart, year, month)
    nominal = nominal.plus(inflationAdjusted ? perMonth.mul(factor) : perMonth)
    real = real.plus(inflationAdjusted ? perMonth : perMonth.div(factor))
  }
  return { nominal, real }
}

/**
 * Whether a cash flow's amount follows inflation: the explicit toggle is on
 * or (legacy) the dropdown still says 'match_inflation'.
 */
export function followsInflation(
  cashFlow: Partial<Pick<CashFlowTemporal, 'inflation_adjusted' | 'change_over_time'>>,
): boolean {
  return cashFlow.inflation_adjusted === true || cashFlow.change_over_time === 'match_inflation'
}

/**
 * Real-terms change of a recurring amount since the flow's own start year: a
 * salary can both follow inflation and get a 2% raise each year.
 */
function changeFactor(cashFlow: CashFlowTemporal, yearsSinceStart: number): Decimal {
  if (yearsSinceStart <= 0) return DECIMAL_1
  if (cashFlow.change_over_time === 'increase_yearly') {
    return DECIMAL_1.plus(new Decimal(cashFlow.change_percentage ?? 0).div(100)).pow(
      yearsSinceStart,
    )
  }
  if (cashFlow.change_over_time === 'decrease_yearly') {
    // Clamp to ≤100 % so a decrease can't take the factor negative
    // (which would oscillate sign across integer year exponents).
    const pct = Decimal.min(new Decimal(cashFlow.change_percentage ?? 0), 100)
    return DECIMAL_1.minus(pct.div(100)).pow(yearsSinceStart)
  }
  return DECIMAL_1
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

/**
 * Interest charged on one installment period. Two paths:
 *  - 'simple' (or missing interest_type but compounding_frequency unset →
 *    keep legacy behaviour): nominal rate divided across installments.
 *  - 'compound': convert the nominal annual rate to an effective annual
 *    rate using the chosen compounding frequency, then back out the
 *    equivalent per-installment rate. Defaults to compounding at the
 *    installment frequency so unconfigured liabilities behave identically
 *    to the pre-advanced-options engine.
 *
 * Exported so `current-values.ts` can amortize a stored balance forward to
 * today on exactly the terms the projection would use.
 */
export function installmentPeriodRate(liability: ProfileLiability): Decimal {
  return periodRate(
    liability.annual_rate,
    liability.installment_frequency,
    liability.interest_type,
    liability.compounding_frequency,
  )
}

/**
 * Interest charged on one installment period for a loan described by its raw
 * terms. The single home of the rate maths, shared by `installmentPeriodRate`
 * (a stored liability) and the dialog's installment/term derivation helpers.
 */
function periodRate(
  annualRatePct: number,
  frequency: Frequency,
  interestType: InterestType | undefined,
  compoundingFrequency: CompoundingFrequency | undefined,
): Decimal {
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[frequency]
  const annualRate = new Decimal(annualRatePct).div(100)
  if (interestType === 'simple') return annualRate.div(periodsPerYear)
  const compoundingPeriodsPerYear =
    compoundingFrequency !== undefined
      ? COMPOUNDING_PERIODS_PER_YEAR[compoundingFrequency]
      : periodsPerYear
  // EAR = (1 + r/n)^n − 1; installment rate = (1 + EAR)^(1/p) − 1
  const periodicCompoundRate = annualRate.div(compoundingPeriodsPerYear)
  const ear = DECIMAL_1.plus(periodicCompoundRate).pow(compoundingPeriodsPerYear).minus(DECIMAL_1)
  return DECIMAL_1.plus(ear).pow(new Decimal(1).div(periodsPerYear)).minus(DECIMAL_1)
}

/** The raw terms a loan's installment/term derivation needs. */
export interface LoanTerms {
  outstanding_balance: number
  installment_frequency: Frequency
  annual_rate: number
  /** Term in years. */
  remaining_term: number
  interest_type?: InterestType
  compounding_frequency?: CompoundingFrequency
}

/**
 * The fully-amortizing installment for a loan: the payment that clears
 * `outstanding_balance` over `remaining_term` at its rate. Undefined when the
 * inputs can't describe a loan (no principal/term, or a payment that never
 * covers the interest). Used by the liability dialog to derive one side of the
 * Installment amount ⇄ Term pair from the other (issue #258).
 */
export function installmentAmountForLoan(loan: LoanTerms): number | undefined {
  const principal = new Decimal(loan.outstanding_balance)
  const periods = new Decimal(loan.remaining_term).mul(
    INSTALLMENT_PERIODS_PER_YEAR[loan.installment_frequency],
  )
  if (principal.lessThanOrEqualTo(0) || periods.lessThanOrEqualTo(0)) return undefined
  const rate = periodRate(
    loan.annual_rate,
    loan.installment_frequency,
    loan.interest_type,
    loan.compounding_frequency,
  )
  if (rate.isZero()) return principal.div(periods).toNumber()
  const discount = DECIMAL_1.minus(DECIMAL_1.plus(rate).pow(periods.neg()))
  if (discount.lessThanOrEqualTo(0)) return undefined
  return principal.mul(rate).div(discount).toNumber()
}

/**
 * The term (in years) a loan takes to clear `outstanding_balance` at the given
 * installment amount and rate. Inverse of `installmentAmountForLoan`; undefined
 * when the payment can't clear the loan (it never covers the period interest).
 */
export function termYearsForLoan(
  loan: LoanTerms & { installment_amount: number },
): number | undefined {
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[loan.installment_frequency]
  const principal = new Decimal(loan.outstanding_balance)
  const payment = new Decimal(loan.installment_amount)
  if (principal.lessThanOrEqualTo(0) || payment.lessThanOrEqualTo(0)) return undefined
  const rate = periodRate(
    loan.annual_rate,
    loan.installment_frequency,
    loan.interest_type,
    loan.compounding_frequency,
  )
  let periods: Decimal
  if (rate.isZero()) {
    periods = principal.div(payment)
  } else {
    const interestOnly = principal.mul(rate)
    // A payment at or below the period interest never amortizes the loan.
    if (payment.lessThanOrEqualTo(interestOnly)) return undefined
    periods = payment.div(payment.minus(interestOnly)).ln().div(DECIMAL_1.plus(rate).ln())
  }
  if (periods.lessThanOrEqualTo(0) || !periods.isFinite()) return undefined
  return periods.div(periodsPerYear).toNumber()
}

/**
 * How many whole scheduled installments a loan has left, in the unit its term
 * is stated in. Rounded because carrying a loan forward writes the term back as
 * a fraction of a year (whole installments over the periods per year), and
 * binary floating point leaves that a hair either side of the whole period
 * count it stands for.
 *
 * Exported so `current-values.ts` counts the same periods the projection does.
 * `simulateLiability` keeps the unrounded count: a term of 18 months on a
 * yearly cadence is a genuine 1.5 periods there, cleared by a balloon on the
 * fractional final period.
 */
export function remainingInstallmentPeriods(liability: ProfileLiability): number {
  return Math.round(
    remainingTermPeriods(
      liability.remaining_term,
      liability.remaining_term_unit,
      INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency],
    ),
  )
}

function simulateLiability(
  liability: ProfileLiability,
  startYear: number,
  /** The plan's start month (1..12): its first year pays from there on. */
  startMonth: number,
  endYear: number,
  /**
   * Optional life span, used by a tangible asset's financing: the loan does
   * not exist before the purchase year, and a sale in `lastYear` settles
   * whatever is still owed out of the proceeds.
   */
  window?: { firstYear?: number; lastYear?: number },
): LiabilitySchedule {
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency]
  const installmentPeriodInterestRate = installmentPeriodRate(liability)
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
    // Not taken out yet, or already settled: nothing owed, nothing paid. An
    // absent bound is open-ended, so a standalone liability with neither a
    // planned start nor a planned pay-off runs from plan year one for its term.
    const beforeStart = window?.firstYear !== undefined && year < window.firstYear
    const afterEnd = window?.lastYear !== undefined && year > window.lastYear
    if (beforeStart || afterEnd) {
      outstandingByYear.set(year, DECIMAL_0)
      paidByYear.set(year, DECIMAL_0)
      if (afterEnd) balance = DECIMAL_0
      continue
    }
    // The plan's first year has only the months from its start, and
    // pays the whole installments that fit in them; the rest of the term
    // follows on. A yearly installment fits only a first year from January.
    const periodsThisYear =
      year === startYear ? Math.floor((periodsPerYear * (13 - startMonth)) / 12) : periodsPerYear
    for (let i = 0; i < periodsThisYear; i++) {
      if (periodsRemaining <= 0 || balance.lessThanOrEqualTo(0)) break
      const interest = balance.mul(installmentPeriodInterestRate)
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
    // Selling the asset settles the rest of the loan from the proceeds; for a
    // standalone liability this is a planned pay-off date.
    if (window?.lastYear !== undefined && year === window.lastYear && balance.greaterThan(0)) {
      paidThisYear = paidThisYear.plus(balance)
      balance = DECIMAL_0
    }
    outstandingByYear.set(year, balance)
    paidByYear.set(year, paidThisYear)
  }

  return { outstandingByYear, paidByYear }
}

/**
 * The loan behind a financed tangible asset, as a standalone liability — or
 * undefined when the asset is not financed or its financing terms are
 * incomplete. Exported for reuse by the current-balance projection.
 */
export function financingToLiability(asset: ProfileTangibleAsset): ProfileLiability | undefined {
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

export function investmentToTemporal(investment: ProfileInvestment): CashFlowTemporal {
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

/** Comparable index for a calendar month, so window edges sort as plain numbers. */
export function monthIndex(year: number, month: number): number {
  return year * 12 + month
}

/**
 * The month an explicitly planned start falls in, or undefined when the start
 * is not planned ('immediately'/'now') or its field was never filled in.
 */
function plannedStartsAt(flow: TimingWindow, birth: Birth | undefined): number | undefined {
  if (flow.start === 'at_specific_date' && flow.start_year !== undefined) {
    return monthIndex(flow.start_year, flow.start_month ?? 1)
  }
  if (flow.start === 'when_age_is' && birth !== undefined && flow.start_age !== undefined) {
    return monthIndex(birth.year + flow.start_age, 1)
  }
  return undefined
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
  /** The plan's first month, so a purchase later that same year is still a purchase. */
  planStartsAt: number,
  birth: Birth | undefined,
): PlannedWindow {
  const resolvedStart = resolveStartYear(temporal, planStartYear, birth)
  // A planned start is bought once the plan reaches its month — including a
  // month later in the plan's first year (#246). A start before the plan
  // window would never fire as a one-time transfer, so the start year is
  // clamped and the position is simply already held.
  const startsAt = plannedStartsAt(temporal, birth)
  return {
    startYear: Math.max(resolvedStart, planStartYear),
    exitYear: resolveEndYear(temporal, birth),
    fundsFromCash:
      startsAt === undefined ? resolvedStart > planStartYear : startsAt >= planStartsAt,
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
        from_asset_id: CASH_ENDPOINT,
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
        to_asset_id: CASH_ENDPOINT,
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
  birth: Birth | undefined,
  planStart: PlanStart,
): boolean {
  if (transfer.schedule === 'one_time') return firesOneTime(transfer, year, planStart)
  const temporal = transferToTemporal(transfer)
  const tStart = resolveStartYear(temporal, planStartYear, birth)
  const tEnd = resolveEndYear(temporal, birth)
  if (year < tStart || year > tEnd) return false
  return !activeMonthFraction(temporal, year, tStart, tEnd, birth, planStart).isZero()
}

/**
 * Whether a one-time item fires in `year`: its transaction year, unless its
 * month comes before the plan starts. The planned buy and sell of an asset
 * carry no month and always fire in their year.
 */
function firesOneTime(
  schedule: { transaction_year?: number; transaction_month?: number },
  year: number,
  planStart: PlanStart,
): boolean {
  if (year !== schedule.transaction_year) return false
  if (schedule.transaction_month === undefined) return true
  return monthIndex(year, schedule.transaction_month) >= monthIndex(planStart.year, planStart.month)
}

/**
 * The fields of a stored cash flow the per-year amount math reads. The
 * recurring fields are optional because a one-time schedule leaves them
 * unset; `cashFlowToTemporal` applies the projection's defaults.
 */
type ScheduledCashFlow = {
  schedule?: CashFlowSchedule
  // one-time fields
  transaction_year?: number
  transaction_month?: number
  // recurring fields
  frequency?: Frequency
  start?: CashFlowStart
  start_year?: number
  start_month?: number
  start_age?: number
  end?: CashFlowEnd
  end_year?: number
  end_month?: number
  end_age?: number
  inflation_adjusted?: boolean
  change_over_time?: ChangeOverTime
  change_percentage?: number
}

/**
 * A stored cash flow as the temporal shape the engine resolves, with the
 * projection's defaults applied for the optional fields. Exported so the
 * carry-forward in `current-values.ts` asks whether an income/expense is
 * running on exactly one way.
 */
export function cashFlowToTemporal(flow: ScheduledCashFlow): CashFlowTemporal {
  // Recurring cash flows reuse the same temporal shape as transfers. Defaults
  // are defensive — schema validation should already guarantee these are set
  // when schedule === 'recurring'.
  return {
    start: flow.start ?? 'immediately',
    start_year: flow.start_year,
    start_month: flow.start_month,
    start_age: flow.start_age,
    end: flow.end ?? 'never',
    end_year: flow.end_year,
    end_month: flow.end_month,
    end_age: flow.end_age,
    inflation_adjusted: flow.inflation_adjusted,
    change_over_time: flow.change_over_time ?? 'none',
    change_percentage: flow.change_percentage,
  }
}

/**
 * What a one-time schedule contributes in `year`: nothing outside the
 * transaction year, and otherwise the amount in its transaction month (see
 * `monthlyAmounts`). Shared by one-time transfers and cash flows so both
 * inflate identically.
 */
function oneTimeAmountForYear(
  schedule: { transaction_year?: number; transaction_month?: number; inflation_adjusted?: boolean },
  amount: Decimal,
  year: number,
  planStart: PlanStart,
): FlowAmount {
  if (!firesOneTime(schedule, year, planStart)) return NO_AMOUNT
  const month = schedule.transaction_month ?? 1
  return monthlyAmounts(amount, schedule.inflation_adjusted === true, planStart, year, month, month)
}

/** A recurring amount over the months it runs in `year`. */
function recurringAmountForYear(
  temporal: CashFlowTemporal,
  annual: Decimal,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): FlowAmount {
  const start = resolveStartYear(temporal, planStartYear, birth)
  const end = resolveEndYear(temporal, birth)
  if (year < start || year > end) return NO_AMOUNT
  const [from, to] = activeMonthRange(temporal, year, start, end, birth, planStart)
  const perMonth = annual.div(12).mul(changeFactor(temporal, year - start))
  return monthlyAmounts(perMonth, followsInflation(temporal), planStart, year, from, to)
}

// Transfer amount that should be applied in the given year (for
// fixed-amount transfers only — caller should use the live source balance
// instead when `transfer.transfer_all` is true).
function transferAmountForYear(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): FlowAmount {
  const amount = new Decimal(transfer.amount)
  if (transfer.schedule === 'one_time') {
    return oneTimeAmountForYear(transfer, amount, year, planStart)
  }
  return recurringAmountForYear(
    transferToTemporal(transfer),
    annualizedAmount(amount, transfer.frequency ?? 'monthly'),
    year,
    planStartYear,
    birth,
    planStart,
  )
}

/**
 * The share of an investment's balance that is gain after `heldYears` at
 * `apyPercent`: a rough estimate for taxing a withdrawal, since a plan keeps
 * no cost basis. A balance that grew by (1 + r)^n is gain for 1 − (1 + r)^−n
 * of it; nothing in the year it was bought, nothing at a loss.
 */
export function estimatedGainShare(apyPercent: number, heldYears: number): Decimal {
  if (heldYears <= 0 || apyPercent <= 0) return DECIMAL_0
  return DECIMAL_1.minus(DECIMAL_1.plus(new Decimal(apyPercent).div(100)).pow(-heldYears))
}

/**
 * The tax a transfer deducts from `amount` on the way out of `source`, held
 * for `heldYears`: nothing unless the transfer asks for it and draws on an
 * investment, since cash has no gain.
 */
export function estimatedTransferTax(
  transfer: Pick<Transfer, 'deduct_tax' | 'tax_rate'>,
  amount: Decimal,
  source: ProfileInvestment | undefined,
  heldYears: number,
): Decimal {
  if (!transfer.deduct_tax || !transfer.tax_rate || !source) return DECIMAL_0
  return amount
    .mul(estimatedGainShare(source.apy, heldYears))
    .mul(new Decimal(transfer.tax_rate).div(100))
}

/**
 * What has to leave `source`, held for `heldYears`, so that `net` is left
 * after the estimated tax: the amount the user enters is what they get, the
 * tax is paid on top of it. The gain share is strictly below 1 and the rate
 * at most 100 %, so the divisor never reaches 0.
 */
export function grossTransferAmount(
  transfer: Pick<Transfer, 'deduct_tax' | 'tax_rate'>,
  net: Decimal,
  source: ProfileInvestment | undefined,
  heldYears: number,
): Decimal {
  if (!transfer.deduct_tax || !transfer.tax_rate || !source) return net
  const taxShare = estimatedGainShare(source.apy, heldYears).mul(
    new Decimal(transfer.tax_rate).div(100),
  )
  return net.div(DECIMAL_1.minus(taxShare))
}

export interface TransferSummary {
  /** How many times the transfer fires within the plan. */
  occurrences: number
  /** Sum of the entered amounts, after inflation and change over time: what arrives before fees. */
  nominalTotal: number
  /** The same sum in today's money (inflation factor stripped). */
  realTotal: number
  /** What leaves the source: `nominalTotal` plus the tax, when the transfer deducts one. */
  grossTotal: number
  /** The estimated gain inside `grossTotal` when the transfer deducts tax. */
  gainTotal: number
  /** The tax deducted from `grossTotal` on that gain. */
  taxTotal: number
}

/**
 * Preview totals for the transfer dialogs: how often a transfer fires within
 * the plan and how much it moves in nominal and in today's money. Reuses the
 * per-year amount the projection itself applies, so the preview and the chart
 * cannot disagree.
 */
export function summarizeTransfer(
  transfer: Transfer,
  plan: Pick<Portfolio, 'start_date' | 'end_date' | 'inflation_rate' | 'investments'>,
  birthDate: string | undefined,
): TransferSummary {
  const birth = birthOf(birthDate)
  const startYear = yearOf(plan.start_date)
  const endYear = yearOf(plan.end_date)
  const planStart = planStartOf(plan)
  const source = plan.investments.find((i) => i.id === transfer.from_asset_id)
  // Held since the same year the engine counts from: the plan start, or a
  // later planned purchase (`assetWindows` in `getYearlyPlanProjection`).
  const boughtYear = source
    ? Math.max(resolveStartYear(investmentToTemporal(source), startYear, birth), startYear)
    : startYear
  let occurrences = 0
  let nominalTotal = DECIMAL_0
  let realTotal = DECIMAL_0
  let grossTotal = DECIMAL_0
  let gainTotal = DECIMAL_0
  let taxTotal = DECIMAL_0
  for (let year = startYear; year <= endYear; year++) {
    if (!isTransferActiveThisYear(transfer, year, startYear, birth, planStart)) continue
    if (transfer.schedule === 'one_time') {
      occurrences += 1
    } else {
      const temporal = transferToTemporal(transfer)
      const fraction = activeMonthFraction(
        temporal,
        year,
        resolveStartYear(temporal, startYear, birth),
        resolveEndYear(temporal, birth),
        birth,
        planStart,
      )
      occurrences += Math.round(
        FLOW_PERIODS_PER_YEAR[transfer.frequency ?? 'monthly'] * fraction.toNumber(),
      )
    }
    const { nominal: amount, real } = transferAmountForYear(
      transfer,
      year,
      startYear,
      birth,
      planStart,
    )
    nominalTotal = nominalTotal.plus(amount)
    realTotal = realTotal.plus(real)
    const heldYears = year - boughtYear
    const gross = grossTransferAmount(transfer, amount, source, heldYears)
    grossTotal = grossTotal.plus(gross)
    if (transfer.deduct_tax && source) {
      gainTotal = gainTotal.plus(gross.mul(estimatedGainShare(source.apy, heldYears)))
      taxTotal = taxTotal.plus(estimatedTransferTax(transfer, gross, source, heldYears))
    }
  }
  return {
    occurrences,
    nominalTotal: nominalTotal.toNumber(),
    realTotal: realTotal.toNumber(),
    grossTotal: grossTotal.toNumber(),
    gainTotal: gainTotal.toNumber(),
    taxTotal: taxTotal.toNumber(),
  }
}

export interface CashFlowSummary {
  /** How many times the cash flow fires within the plan. */
  occurrences: number
  /** Sum of the amounts actually paid or received, after inflation and change over time. */
  nominalTotal: number
  /** The same sum in today's money (inflation factor stripped). */
  realTotal: number
}

/**
 * Preview totals for the income/expense dialogs: how often a cash flow fires
 * within the plan and how much it moves in nominal and in today's money.
 * Reuses the per-year amount the projection itself applies, so the preview
 * and the chart cannot disagree.
 */
export function summarizeCashFlow(
  flow: Income | Expense,
  plan: Pick<Portfolio, 'start_date' | 'end_date' | 'inflation_rate'>,
  birthDate: string | undefined,
): CashFlowSummary {
  const birth = birthOf(birthDate)
  const startYear = yearOf(plan.start_date)
  const endYear = yearOf(plan.end_date)
  const planStart = planStartOf(plan)
  let occurrences = 0
  let nominalTotal = DECIMAL_0
  let realTotal = DECIMAL_0
  for (let year = startYear; year <= endYear; year++) {
    if (flow.schedule === 'one_time') {
      if (!firesOneTime(flow, year, planStart)) continue
      occurrences += 1
    } else {
      const temporal = cashFlowToTemporal(flow)
      const itemStart = resolveStartYear(temporal, startYear, birth)
      const itemEnd = resolveEndYear(temporal, birth)
      if (year < itemStart || year > itemEnd) continue
      const fraction = activeMonthFraction(temporal, year, itemStart, itemEnd, birth, planStart)
      if (fraction.isZero()) continue
      occurrences += Math.round(
        FLOW_PERIODS_PER_YEAR[flow.frequency ?? 'monthly'] * fraction.toNumber(),
      )
    }
    const { nominal, real } = cashFlowAmountForYear(
      flow,
      new Decimal(flow.amount),
      year,
      startYear,
      birth,
      planStart,
    )
    nominalTotal = nominalTotal.plus(nominal)
    realTotal = realTotal.plus(real)
  }
  return { occurrences, nominalTotal: nominalTotal.toNumber(), realTotal: realTotal.toNumber() }
}

/**
 * Nominal amount one cash flow contributes in `year` (0 when inactive): the
 * transaction-year amount for a one-time schedule, or the annualized, grown,
 * month-fractioned amount for a recurring one.
 */
function cashFlowAmountForYear(
  flow: ScheduledCashFlow,
  amount: Decimal,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): FlowAmount {
  if (flow.schedule === 'one_time') {
    return oneTimeAmountForYear(flow, amount, year, planStart)
  }
  return recurringAmountForYear(
    cashFlowToTemporal(flow),
    annualizedAmount(amount, flow.frequency ?? 'monthly'),
    year,
    planStartYear,
    birth,
    planStart,
  )
}

/**
 * Sum the amounts of the cash flows active in `year`, as paid and in today's
 * money, and report which items were active. Recurring flows annualize by
 * frequency, change over time from their own start year and are paid in each
 * month they run; one-time flows in their transaction month. Inflation counts
 * months from the plan's start month (`monthlyAmounts`).
 */
function accumulateCashFlows<T extends ScheduledCashFlow & { id: string }>(
  items: T[],
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
  getAmount: (item: T) => Decimal,
): {
  total: Decimal
  realTotal: Decimal
  activeIds: string[]
  amounts: { item: T; amount: Decimal; real: Decimal }[]
} {
  let total = DECIMAL_0
  let realTotal = DECIMAL_0
  const activeIds: string[] = []
  const amounts: { item: T; amount: Decimal; real: Decimal }[] = []
  for (const item of items) {
    if (item.schedule === 'one_time') {
      if (!firesOneTime(item, year, planStart)) continue
    } else {
      const temporal = cashFlowToTemporal(item)
      const itemStart = resolveStartYear(temporal, planStartYear, birth)
      const itemEnd = resolveEndYear(temporal, birth)
      if (year < itemStart || year > itemEnd) continue
      if (activeMonthFraction(temporal, year, itemStart, itemEnd, birth, planStart).isZero())
        continue
    }
    const { nominal, real } = cashFlowAmountForYear(
      item,
      getAmount(item),
      year,
      planStartYear,
      birth,
      planStart,
    )
    total = total.plus(nominal)
    realTotal = realTotal.plus(real)
    activeIds.push(item.id)
    amounts.push({ item, amount: nominal, real })
  }
  return { total, realTotal, activeIds, amounts }
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

/** The year and month (1–12) an age counts from. */
interface Birth {
  year: number
  month: number
}

function birthOf(dateString: string | undefined): Birth | undefined {
  if (!dateString) return undefined
  return { year: yearOf(dateString), month: Number(dateString.slice(5, 7)) }
}

/**
 * Effective APY = APY − TER − ongoing portion of the entry fee. The ongoing
 * entry-fee component models the year-after-year drag (whole fee for
 * 'ongoing', 60% for 'forty-sixty', 0 for 'upfront'). Floored at −100% (a
 * total loss) so the yearly multiplier bottoms out at 0 — fees exceeding
 * 100 + APY would otherwise flip the multiplier negative and make the
 * balance oscillate in sign.
 */
export function effectiveInvestmentApy(investment: ProfileInvestment): Decimal {
  const apy = new Decimal(investment.apy)
  const ter = new Decimal(investment.ter ?? 0)
  const entryFee = new Decimal(investment.entry_fee ?? 0)
  let ongoingDrag = DECIMAL_0
  if (investment.entry_fee_type === 'ongoing') ongoingDrag = entryFee
  else if (investment.entry_fee_type === 'forty-sixty') ongoingDrag = entryFee.mul(0.6)
  return Decimal.max(apy.minus(ter).minus(ongoingDrag), DECIMAL_MINUS_100)
}

/**
 * Exit fee on a withdrawal, before it lands at the destination —
 * sells/redemptions usually take the fee out of proceeds, so the source loses
 * `amount` but the destination receives less. `undefined` (cash, or an id that
 * is not an investment) is free to withdraw from.
 *
 * Exported so `current-values.ts` charges transfers the same fees the
 * projection does instead of keeping its own copy of the rule.
 */
export function applyExitFee(investment: ProfileInvestment | undefined, amount: Decimal): Decimal {
  if (!investment || !investment.exit_fee) return amount
  const exitFee = new Decimal(investment.exit_fee)
  if (investment.exit_fee_type === 'fixed') {
    return Decimal.max(amount.minus(exitFee), DECIMAL_0)
  }
  // Default to percentage (matches the schema default and Figma).
  return Decimal.max(amount.mul(DECIMAL_1.minus(exitFee.div(100))), DECIMAL_0)
}

/**
 * Entry fee on a deposit — for 'upfront' the whole fee comes out of the
 * inflow; 'forty-sixty' takes 40 % upfront and amortizes the rest through the
 * APY drag in `effectiveInvestmentApy`; 'ongoing' takes none here (all drag).
 * `undefined` (cash, or an id that is not an investment) is free to pay into.
 */
export function applyEntryFee(investment: ProfileInvestment | undefined, amount: Decimal): Decimal {
  if (!investment || !investment.entry_fee) return amount
  const entryFee = new Decimal(investment.entry_fee)
  let upfrontPct = DECIMAL_0
  if (investment.entry_fee_type === 'upfront') upfrontPct = entryFee
  else if (investment.entry_fee_type === 'forty-sixty') upfrontPct = entryFee.mul(0.4)
  if (upfrontPct.isZero()) return amount
  return Decimal.max(amount.mul(DECIMAL_1.minus(upfrontPct.div(100))), DECIMAL_0)
}

export function getYearlyPlanProjection(plan: Portfolio, profile: Profile): YearlyProjection[] {
  const startYear = yearOf(plan.start_date)
  const planStart = planStartOf(plan)
  const endYear = yearOf(plan.end_date)

  if (endYear < startYear) return []

  const birth = birthOf(profile.birth_date)

  // A plan holds its own copy of everything it projects; financial data is
  // only consulted for what a plan does not copy (birth date).
  const investments: ProfileInvestment[] = plan.investments
  const liabilities: ProfileLiability[] = plan.liabilities
  const tangibleAssets = plan.tangible_assets
  const incomes: Income[] = plan.incomes
  const expenses: Expense[] = plan.expenses

  // One map for both kinds: investments and tangible assets share the planned
  // buy/sell machinery, so the transfer loop guards them with the same check.
  const planStartsAt = monthIndex(startYear, Number(plan.start_date.slice(5, 7)))
  const assetWindows = new Map<string, PlannedWindow>([
    ...investments.map((i): [string, PlannedWindow] => [
      i.id,
      plannedWindow(investmentToTemporal(i), startYear, planStartsAt, birth),
    ]),
    ...tangibleAssets.map((a): [string, PlannedWindow] => [
      a.id,
      plannedWindow(tangibleToTemporal(a), startYear, planStartsAt, birth),
    ]),
  ])

  // A financed asset's loan only runs while the asset is owned: it starts at
  // the purchase year and a sale settles whatever is left. A standalone
  // liability runs from its planned start (or plan year one when unset) to its
  // planned pay-off (or its whole term when unset).
  const tangibleAssetLiabilities = tangibleAssets
    .map((asset) => ({ asset, liability: financingToLiability(asset) }))
    .filter(
      (x): x is { asset: ProfileTangibleAsset; liability: ProfileLiability } =>
        x.liability !== undefined,
    )

  const standaloneSchedules = liabilities.map((l) =>
    simulateLiability(l, startYear, planStart.month, endYear, {
      firstYear: liabilityStartYear(l, birth),
      lastYear: liabilityPayOffYear(l),
    }),
  )
  // The year each loan the plan takes on pays its principal into cash (#322):
  // that is new money, whereas a liability the plan was created with is debt
  // the user already carries, so that money is already in today's balances,
  // however the plan has edited it since. A start before the plan pays in at
  // plan start. A planned pay-off before that start means the schedule above
  // never goes live, so nothing is borrowed either.
  const fiWithdrawalRate = profile.fi_withdrawal_rate ?? DEFAULT_FI_WITHDRAWAL_RATE
  const currentDebtIds = new Set(plan.base.liabilities.map((l) => l.id))
  const borrowedByYear = new Map<number, Decimal>()
  for (const l of liabilities) {
    if (currentDebtIds.has(l.id)) continue
    const firstYear = Math.max(liabilityStartYear(l, birth) ?? startYear, startYear)
    const lastYear = liabilityPayOffYear(l)
    if (lastYear !== undefined && lastYear < firstYear) continue
    const soFar = borrowedByYear.get(firstYear) ?? DECIMAL_0
    borrowedByYear.set(firstYear, soFar.plus(new Decimal(l.outstanding_balance)))
  }
  const financedSchedules = tangibleAssetLiabilities.map(({ asset, liability }) => {
    const window = assetWindows.get(asset.id)
    return {
      assetId: asset.id,
      liability,
      schedule: simulateLiability(
        liability,
        startYear,
        planStart.month,
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

  // Every plan has a cash balance and every flow runs through it (#331): it
  // opens at the plan's own cash (copied from the profile at creation), and
  // income, transfers, expenses and installments all go through it with the
  // insufficient-funds check applied. There is no way to exclude cash.
  const initialCashNominal = plan.cash_amount

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
  const investmentApy = new Map<string, Decimal>(
    investments.map((i) => [i.id, effectiveInvestmentApy(i)]),
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
  const knownAssetIds = new Set<string>([
    CASH_ENDPOINT,
    ...investments.map((i) => i.id),
    ...tangibleAssets.map((a) => a.id),
  ])
  // Planned buys/sells belong to their investment, not to the plan's
  // transfer list, so they are never filtered by endpoint. Buys
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
    ...plan.transfers.filter(
      (t) => knownAssetIds.has(t.from_asset_id) && knownAssetIds.has(t.to_asset_id),
    ),
    ...timingTransfers.map((t) => t.exit).filter((t): t is Transfer => t !== undefined),
  ]

  const projection: YearlyProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    const yearsSincePlanStart = year - startYear

    // 1. Compound investments for this year (skip the first year — initial
    //    balance is the year-0 nominal value).
    // What each investment loses to fees this year, and each transfer to tax.
    const investmentFeesNominal = new Map<string, Decimal>()
    const transferTaxNominal = new Map<string, Decimal>()
    const addTo = (map: Map<string, Decimal>, id: string, amount: Decimal) => {
      if (amount.greaterThan(0)) map.set(id, (map.get(id) ?? DECIMAL_0).plus(amount))
    }
    if (yearsSincePlanStart > 0) {
      for (const [id, balance] of invBalancesNominal) {
        const apy = investmentApy.get(id) ?? DECIMAL_0
        const grown = balance.mul(DECIMAL_1.plus(apy.div(100)))
        // The drag is what the balance would have grown by at the gross APY.
        const grossApy = new Decimal(investmentsById.get(id)?.apy ?? 0)
        addTo(
          investmentFeesNominal,
          id,
          balance.mul(DECIMAL_1.plus(grossApy.div(100))).minus(grown),
        )
        invBalancesNominal.set(id, grown)
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
    const {
      total: incomesThisYearNominal,
      realTotal: incomesThisYearReal,
      amounts: incomeAmounts,
    } = accumulateCashFlows(
      incomes,
      year,
      startYear,
      birth,
      planStart,
      (income) => new Decimal(income.amount),
    )
    const {
      total: cashFlowExpensesNominal,
      realTotal: cashFlowExpensesReal,
      activeIds: activeExpenseIdsThisYear,
      amounts: expenseAmounts,
    } = accumulateCashFlows(
      expenses,
      year,
      startYear,
      birth,
      planStart,
      (expense) => new Decimal(expense.amount),
    )
    // 3. Apply income to cash up front, then run transfers, then settle
    //    expenses + liability payments. Doing transfers before the cash check
    //    is what lets a transfer-into-cash (e.g. drawing from an investment
    //    to fund a monthly expense) actually cover that expense instead of
    //    being booked too late and tripping a spurious insufficient-funds
    //    warning.
    //    A loan the plan takes on pays its principal into cash in the year it
    //    starts (`borrowedByYear`, #322). Booked alongside income, not as
    //    income: it is not earnings and must not lift the savings rate or FI %.
    const borrowedThisYearNominal = borrowedByYear.get(year) ?? DECIMAL_0
    cashNominal = cashNominal.plus(incomesThisYearNominal).plus(borrowedThisYearNominal)

    // 4. Transfer flows for this year. Each transfer is applied atomically:
    //    if the source balance is less than the requested amount, the entire
    //    transfer is skipped (no partial move, no overdraft). Balances after
    //    transfers are what's shown for year Y and what next year's
    //    compounding works from.
    function getBalance(id: string): Decimal {
      if (id === CASH_ENDPOINT) return cashNominal
      if (invBalancesNominal.has(id)) return invBalancesNominal.get(id) ?? DECIMAL_0
      if (tangValuesNominal.has(id)) return tangValuesNominal.get(id) ?? DECIMAL_0
      return DECIMAL_0
    }

    function withdraw(id: string, amount: Decimal): void {
      if (id === CASH_ENDPOINT) {
        cashNominal = cashNominal.minus(amount)
      } else if (invBalancesNominal.has(id)) {
        invBalancesNominal.set(id, (invBalancesNominal.get(id) ?? DECIMAL_0).minus(amount))
      } else if (tangValuesNominal.has(id)) {
        tangValuesNominal.set(id, (tangValuesNominal.get(id) ?? DECIMAL_0).minus(amount))
      }
    }

    function deposit(id: string, amount: Decimal): void {
      if (id === CASH_ENDPOINT) {
        cashNominal = cashNominal.plus(amount)
      } else if (invBalancesNominal.has(id)) {
        invBalancesNominal.set(id, (invBalancesNominal.get(id) ?? DECIMAL_0).plus(amount))
      } else if (tangValuesNominal.has(id)) {
        tangValuesNominal.set(id, (tangValuesNominal.get(id) ?? DECIMAL_0).plus(amount))
      }
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
    // What left the source of each of the plan's own transfers this year.
    const transferMovedNominal = new Map<string, Decimal>()
    // Today's money per unit moved, for a fixed amount: its months' inflation.
    // A "Max" sweep has none and is deflated by the year like a balance.
    const transferRealPerNominal = new Map<string, Decimal>()
    for (const transfer of planTransfers) {
      if (!isTransferActiveThisYear(transfer, year, startYear, birth, planStart)) continue
      // The synthetic buy is what makes its asset active, so it is exempt
      // from the endpoint check on the way in.
      const plannedStartFor = plannedBuyAssetId(transfer)
      if (plannedStartFor === undefined) {
        if (!isEndpointActive(transfer.from_asset_id) || !isEndpointActive(transfer.to_asset_id))
          continue
      }
      const source = investmentsById.get(transfer.from_asset_id)
      const heldYears = year - (assetWindows.get(transfer.from_asset_id)?.startYear ?? startYear)
      if (plannedStartFor === undefined && !isPlannedSell(transfer)) {
        transferMovedNominal.set(transfer.id, DECIMAL_0)
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
        // The entered amount is what arrives after the tax, so the source
        // gives up that plus the tax (`grossTransferAmount`).
        const scheduled = transferAmountForYear(transfer, year, startYear, birth, planStart)
        const entered = scheduled.nominal
        if (entered.greaterThan(0)) {
          transferRealPerNominal.set(transfer.id, scheduled.real.div(entered))
        }
        amount = grossTransferAmount(transfer, entered, source, heldYears)
        if (amount.isZero()) continue
        const balance = getBalance(transfer.from_asset_id)
        // The source holds the amount but not the tax on top: sweep it the
        // way Max would (it lands less the tax) rather than skip the transfer.
        if (balance.lessThan(amount) && balance.greaterThanOrEqualTo(entered)) amount = balance
        if (balance.lessThan(amount)) {
          if (plannedStartFor !== undefined) {
            insufficientFundAssetIdsThisYear.push(plannedStartFor)
            abandonedAssetIds.add(plannedStartFor)
          } else {
            insufficientFundTransferIdsThisYear.push(transfer.id)
          }
          continue
        }
      }
      // Source loses the full `amount`; the destination receives what is left
      // after the fees and the estimated tax, each booked to what it is lost
      // to: the exit fee and the estimated tax come off on the way out, the
      // upfront entry fee on the way in. The tax is on the gross gain share,
      // before the exit fee: a modelling choice, real brokers usually tax net
      // proceeds.
      withdraw(transfer.from_asset_id, amount)
      if (transferMovedNominal.has(transfer.id)) transferMovedNominal.set(transfer.id, amount)
      const destination = investmentsById.get(transfer.to_asset_id)
      const afterExitFee = applyExitFee(source, amount)
      const tax = estimatedTransferTax(transfer, amount, source, heldYears)
      const afterTax = Decimal.max(afterExitFee.minus(tax), DECIMAL_0)
      const net = applyEntryFee(destination, afterTax)
      addTo(investmentFeesNominal, transfer.from_asset_id, amount.minus(afterExitFee))
      addTo(transferTaxNominal, transfer.id, afterExitFee.minus(afterTax))
      addTo(investmentFeesNominal, transfer.to_asset_id, afterTax.minus(net))
      deposit(transfer.to_asset_id, net)
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
    const installmentsNominal: { item: YearlyProjectionItem; paid: Decimal }[] = []
    function addSchedule(
      schedule: LiabilitySchedule,
      liability: ProfileLiability,
      assetId?: string,
    ): void {
      liabilitiesOutstandingNominal = liabilitiesOutstandingNominal.plus(
        schedule.outstandingByYear.get(year) ?? DECIMAL_0,
      )
      const paid = schedule.paidByYear.get(year) ?? DECIMAL_0
      liabilitiesPaidThisYearNominal = liabilitiesPaidThisYearNominal.plus(paid)
      if (paid.greaterThan(0)) {
        installmentsNominal.push({
          item: { id: liability.id, name: liability.name, value: 0, ...(assetId && { assetId }) },
          paid,
        })
      }
    }
    standaloneSchedules.forEach((schedule, i) => addSchedule(schedule, liabilities[i]))
    for (const { assetId, liability, schedule } of financedSchedules) {
      if (!abandonedAssetIds.has(assetId)) addSchedule(schedule, liability, assetId)
    }
    // Property tax is charged on the purchase price — deliberately the flat
    // nominal value, not the inflated or appreciated one — for every year the
    // asset is held, and settled from cash alongside the ordinary expenses.
    const propertyTaxNominal: { asset: ProfileTangibleAsset; tax: Decimal }[] = []
    for (const asset of tangibleAssets) {
      if (!asset.property_tax_rate || abandonedAssetIds.has(asset.id)) continue
      const window = assetWindows.get(asset.id)
      if (window && (year < window.startYear || year > window.exitYear)) continue
      propertyTaxNominal.push({
        asset,
        // A year's tax; the plan's first year pays for its months only.
        tax: new Decimal(asset.value)
          .mul(new Decimal(asset.property_tax_rate).div(100))
          .mul(year === startYear ? new Decimal(13 - planStart.month).div(12) : DECIMAL_1),
      })
    }
    const propertyTaxThisYearNominal = propertyTaxNominal.reduce<Decimal>(
      (sum, { tax }) => sum.plus(tax),
      DECIMAL_0,
    )
    const expensesThisYearNominal = cashFlowExpensesNominal.plus(propertyTaxThisYearNominal)

    // 7. Settle expenses + liability payments against post-transfer cash.
    //    If the result would go negative, flag every expense active this
    //    year. Liabilities are part of the overflow math (they also drain
    //    cash) but aren't blamed in the sidebar today.
    const insufficientFundExpenseIdsThisYear: string[] = []
    const attemptedCashNominal = cashNominal
      .minus(expensesThisYearNominal)
      .minus(liabilitiesPaidThisYearNominal)
    if (attemptedCashNominal.lessThan(0)) {
      insufficientFundExpenseIdsThisYear.push(...activeExpenseIdsThisYear)
    }
    cashNominal = Decimal.max(attemptedCashNominal, DECIMAL_0)

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
    // Flows are deflated month by month (`monthlyAmounts`), property tax like
    // a balance.
    const expensesThisYearReal = cashFlowExpensesReal.plus(
      propertyTaxThisYearNominal.div(deflationFactor),
    )

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

    // Every liability, standalone or the loan behind a financed asset, so the
    // rows add up to the total. A loan not yet taken out, paid off, settled by
    // a sale, or behind a purchase the plan could not afford stays listed at 0.
    const liabilitiesByItem: YearlyProjectionItem[] = [
      ...liabilities.map((liability, i) => ({
        id: liability.id,
        name: liability.name,
        value: clampNonNeg(
          (standaloneSchedules[i].outstandingByYear.get(year) ?? DECIMAL_0).div(deflationFactor),
        ),
      })),
      ...financedSchedules.map(({ assetId, liability, schedule }) => ({
        id: liability.id,
        name: liability.name,
        assetId,
        value: abandonedAssetIds.has(assetId)
          ? 0
          : clampNonNeg((schedule.outstandingByYear.get(year) ?? DECIMAL_0).div(deflationFactor)),
      })),
    ]

    // 9. Per-year FI % and runway. FI mirrors the dashboard's getFiPercent in
    //    financial-totals.ts; the runway stays the ratio of investable wealth
    //    to outflows, while the dashboard's Runway card runs the drawdown in
    //    runway.ts (docs/product/runway.md). Investable wealth excludes
    //    tangibles and subtracts only standalone liabilities (a mortgage is
    //    secured by its asset); outflows include every installment actually
    //    paid this year, scaled to twelve months in the plan's first year,
    //    which has only the months from its start. Numerator and denominator
    //    are both nominal, so the deflator cancels and the ratio is
    //    basis-independent.
    const standaloneOutstandingNominal = standaloneSchedules.reduce<Decimal>(
      (sum, s) => sum.plus(s.outstandingByYear.get(year) ?? DECIMAL_0),
      DECIMAL_0,
    )
    const outflowsNominal = expensesThisYearNominal
      .plus(liabilitiesPaidThisYearNominal)
      .mul(year === startYear ? new Decimal(12).div(13 - planStart.month) : DECIMAL_1)
    const investableNominal = cashNominal
      .plus(investmentsNominal)
      .minus(standaloneOutstandingNominal)
    let fiPercent: number | undefined
    let runwayYears: number | undefined
    if (outflowsNominal.greaterThan(0)) {
      // Investable over the FI number (outflows × 100 / rate), as a percentage.
      fiPercent = Math.max(
        0,
        investableNominal.mul(fiWithdrawalRate).div(outflowsNominal).toNumber(),
      )
      runwayYears = Math.max(0, investableNominal.div(outflowsNominal).toNumber())
    }

    const real = (nominal: Decimal): number => nominal.div(deflationFactor).toNumber()
    const sumOf = (map: Map<string, Decimal>) =>
      Array.from(map.values()).reduce<Decimal>((sum, v) => sum.plus(v), DECIMAL_0)
    const flowItems = (
      amounts: { item: { id: string; name: string }; amount: Decimal; real?: Decimal }[],
    ): YearlyProjectionItem[] =>
      amounts.map(({ item, amount, real: inTodaysMoney }) => ({
        id: item.id,
        name: item.name,
        value: inTodaysMoney ? inTodaysMoney.toNumber() : real(amount),
      }))

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
      incomesByItem: flowItems(incomeAmounts),
      expensesByItem: flowItems(expenseAmounts),
      propertyTaxByItem: flowItems(
        propertyTaxNominal.map(({ asset, tax }) => ({ item: asset, amount: tax })),
      ),
      installmentsByItem: installmentsNominal.map(({ item, paid }) => ({
        ...item,
        value: real(paid),
      })),
      totalInstallments: real(liabilitiesPaidThisYearNominal),
      investmentFeesByItem: investments.flatMap((inv) => {
        const fee = investmentFeesNominal.get(inv.id)
        return fee ? [{ id: inv.id, name: inv.name, value: real(fee) }] : []
      }),
      transferTaxByItem: plan.transfers.flatMap((transfer) => {
        const tax = transferTaxNominal.get(transfer.id)
        return tax ? [{ id: transfer.id, name: transfer.name, value: real(tax) }] : []
      }),
      cashFlow: incomesThisYearReal
        .minus(expensesThisYearReal)
        .minus(liabilitiesPaidThisYearNominal.div(deflationFactor))
        .minus(sumOf(investmentFeesNominal).div(deflationFactor))
        .minus(sumOf(transferTaxNominal).div(deflationFactor))
        .toNumber(),
      transfersByItem: plan.transfers.flatMap((transfer) => {
        const moved = transferMovedNominal.get(transfer.id)
        if (!moved) return []
        const perNominal = transferRealPerNominal.get(transfer.id)
        const value = perNominal ? moved.mul(perNominal).toNumber() : real(moved)
        return [{ id: transfer.id, name: transfer.name, value }]
      }),
      portfolioValue: real(investableNominal),
      fiPercent,
      runwayYears,
      insufficientFundTransferIds: insufficientFundTransferIdsThisYear,
      insufficientFundAssetIds: insufficientFundAssetIdsThisYear,
      insufficientFundExpenseIds: insufficientFundExpenseIdsThisYear,
    })
  }

  return projection
}
