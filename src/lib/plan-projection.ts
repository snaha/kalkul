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
  // × 100 / the profile's withdrawal rate, 25× at the default 4%.
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
 * last < first. Nothing runs before the plan's start month (#487).
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
  /** What is owed at the end of each year's December. */
  outstandingByYear: Map<number, Decimal>
  /** What is paid in each month, by `monthIndex`; absent when nothing. */
  paidByMonth: Map<number, Decimal>
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
  /** The month the loan is taken out, or the plan's start for debt already owed. */
  firstAt: number,
  /**
   * The month the rest is settled in one go: a planned pay-off, or the sale of
   * the asset it finances. Nothing is owed after it.
   */
  settleAt: number | undefined,
  /** The plan's first and last month. */
  fromAt: number,
  toAt: number,
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
  let periodsPaid = 0

  const outstandingByYear = new Map<number, Decimal>()
  const paidByMonth = new Map<number, Decimal>()

  for (let at = fromAt; at <= toAt; at++) {
    const live = at >= firstAt && (settleAt === undefined || at <= settleAt)
    let paid = DECIMAL_0
    if (live) {
      // Installments fall on their cadence from the month the loan runs from:
      // monthly every month, weekly 52 a year spread over the months, yearly
      // in every twelfth month (December for a loan running from January).
      const due = Math.floor(((at - firstAt + 1) * periodsPerYear) / 12)
      for (; periodsPaid < due; periodsPaid++) {
        if (periodsRemaining <= 0 || balance.lessThanOrEqualTo(0)) continue
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
        balance = Decimal.max(grossDue.minus(payment), DECIMAL_0)
        paid = paid.plus(payment)
        periodsRemaining -= 1
      }
      // Selling the asset settles the rest of the loan from the proceeds; for a
      // standalone liability this is a planned pay-off date.
      if (at === settleAt && balance.greaterThan(0)) {
        paid = paid.plus(balance)
        balance = DECIMAL_0
      }
    } else if (settleAt !== undefined && at > settleAt) {
      balance = DECIMAL_0
    }
    if (paid.greaterThan(0)) paidByMonth.set(at, paid)
    const { year, month } = monthOf(at)
    if (month === 12) outstandingByYear.set(year, live ? balance : DECIMAL_0)
  }

  return { outstandingByYear, paidByMonth }
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

/** The year and month (1..12) of a `monthIndex`. */
function monthOf(at: number): { year: number; month: number } {
  const year = Math.floor((at - 1) / 12)
  return { year, month: at - year * 12 }
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
  /** The month it is bought in, or the plan's first month when already held. */
  startsAt: number
  /**
   * The month it is sold in: its sale month, or December of the sale year when
   * none is set. Infinity when it is kept.
   */
  exitsAt: number
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
  const startYear = Math.max(resolvedStart, planStartYear)
  const exitYear = resolveEndYear(temporal, birth)
  const fundsFromCash =
    startsAt === undefined ? resolvedStart > planStartYear : startsAt >= planStartsAt
  const exitMonth =
    temporal.end === 'at_specific_date' && temporal.end_month !== undefined
      ? temporal.end_month
      : 12
  return {
    startYear,
    exitYear,
    fundsFromCash,
    startsAt: fundsFromCash ? (startsAt ?? monthIndex(startYear, 1)) : planStartsAt,
    exitsAt: Number.isFinite(exitYear) ? monthIndex(exitYear, exitMonth) : Infinity,
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
  startsAt: Number.NEGATIVE_INFINITY,
  exitsAt: Number.POSITIVE_INFINITY,
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
        transaction_month: monthOf(window.startsAt).month,
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
        transaction_month: monthOf(window.exitsAt).month,
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
 * month comes before the plan starts. An item without a month (only from
 * unvalidated data) fires in its year.
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
 * The months a flow pays in during a year and what it pays in each, before
 * inflation: `perMonth` is in today's money when `inflationAdjusted`.
 */
interface MonthSpan {
  from: number
  to: number
  perMonth: Decimal
  inflationAdjusted: boolean
}

/** A one-time schedule pays its amount in its transaction month. */
function oneTimeSpan(
  schedule: { transaction_year?: number; transaction_month?: number; inflation_adjusted?: boolean },
  amount: Decimal,
  year: number,
  planStart: PlanStart,
): MonthSpan | undefined {
  if (!firesOneTime(schedule, year, planStart)) return undefined
  // A month is required, but unvalidated data may lack one: it then falls in
  // the first month the year has.
  const month = schedule.transaction_month ?? (year === planStart.year ? planStart.month : 1)
  return {
    from: month,
    to: month,
    perMonth: amount,
    inflationAdjusted: schedule.inflation_adjusted === true,
  }
}

/** A recurring amount spreads its yearly total evenly over the months it runs. */
function recurringSpan(
  temporal: CashFlowTemporal,
  annual: Decimal,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): MonthSpan | undefined {
  const start = resolveStartYear(temporal, planStartYear, birth)
  const end = resolveEndYear(temporal, birth)
  if (year < start || year > end) return undefined
  const [from, to] = activeMonthRange(temporal, year, start, end, birth, planStart)
  if (to < from) return undefined
  return {
    from,
    to,
    perMonth: annual.div(12).mul(changeFactor(temporal, year - start)),
    inflationAdjusted: followsInflation(temporal),
  }
}

/** What a span pays in `month`, as paid: 0 outside it. */
function spanMonthAmount(
  span: MonthSpan,
  planStart: PlanStart,
  year: number,
  month: number,
): Decimal {
  if (month < span.from || month > span.to) return DECIMAL_0
  return span.inflationAdjusted
    ? span.perMonth.mul(inflationFactor(planStart, year, month))
    : span.perMonth
}

/** What a span pays over its year, as paid and in today's money. */
function spanYearAmount(
  span: MonthSpan | undefined,
  planStart: PlanStart,
  year: number,
): FlowAmount {
  if (span === undefined) return NO_AMOUNT
  return monthlyAmounts(span.perMonth, span.inflationAdjusted, planStart, year, span.from, span.to)
}

function transferSpan(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): MonthSpan | undefined {
  const amount = new Decimal(transfer.amount)
  if (transfer.schedule === 'one_time') return oneTimeSpan(transfer, amount, year, planStart)
  return recurringSpan(
    transferToTemporal(transfer),
    annualizedAmount(amount, transfer.frequency ?? 'monthly'),
    year,
    planStartYear,
    birth,
    planStart,
  )
}

function cashFlowSpan(
  flow: ScheduledCashFlow,
  amount: Decimal,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): MonthSpan | undefined {
  if (flow.schedule === 'one_time') return oneTimeSpan(flow, amount, year, planStart)
  return recurringSpan(
    cashFlowToTemporal(flow),
    annualizedAmount(amount, flow.frequency ?? 'monthly'),
    year,
    planStartYear,
    birth,
    planStart,
  )
}

// Transfer amount over a year (for fixed-amount transfers only; a "Max"
// transfer takes the live source balance instead).
function transferAmountForYear(
  transfer: Transfer,
  year: number,
  planStartYear: number,
  birth: Birth | undefined,
  planStart: PlanStart,
): FlowAmount {
  return spanYearAmount(
    transferSpan(transfer, year, planStartYear, birth, planStart),
    planStart,
    year,
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
  return spanYearAmount(
    cashFlowSpan(flow, amount, year, planStartYear, birth, planStart),
    planStart,
    year,
  )
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

  const planEndsAt = monthIndex(endYear, 12)
  // A standalone loan runs from its planned start (the plan's first month when
  // unset or earlier) to its planned pay-off. Their own start and pay-off
  // months are not read yet (#456): a later start is taken out in January, a
  // pay-off settles in December.
  const loanStartsAt = (year: number | undefined) =>
    year === undefined || year <= startYear ? planStartsAt : monthIndex(year, 1)
  const standaloneLoans = liabilities.map((liability) => {
    const firstAt = loanStartsAt(liabilityStartYear(liability, birth))
    const payOffYear = liabilityPayOffYear(liability)
    const settleAt = payOffYear === undefined ? undefined : monthIndex(payOffYear, 12)
    return {
      liability,
      firstAt,
      settleAt,
      schedule: simulateLiability(liability, firstAt, settleAt, planStartsAt, planEndsAt),
    }
  })
  // The month each loan the plan takes on pays its principal into cash (#322):
  // that is new money, whereas a liability the plan was created with is debt
  // the user already carries, so that money is already in today's balances,
  // however the plan has edited it since. A start before the plan pays in at
  // plan start. A planned pay-off before that start means the schedule above
  // never goes live, so nothing is borrowed either.
  const fiWithdrawalRate = profile.fi_withdrawal_rate ?? DEFAULT_FI_WITHDRAWAL_RATE
  const currentDebtIds = new Set(plan.base.liabilities.map((l) => l.id))
  const borrowedByMonth = new Map<number, Decimal>()
  for (const { liability, firstAt, settleAt } of standaloneLoans) {
    if (currentDebtIds.has(liability.id)) continue
    if (settleAt !== undefined && settleAt < firstAt) continue
    const soFar = borrowedByMonth.get(firstAt) ?? DECIMAL_0
    borrowedByMonth.set(firstAt, soFar.plus(new Decimal(liability.outstanding_balance)))
  }
  // A financed asset's loan only runs while the asset is owned: from the month
  // it is bought, and its sale settles whatever is left.
  const financedLoans = tangibleAssetLiabilities.map(({ asset, liability }) => {
    const window = assetWindows.get(asset.id) ?? emptyWindow
    const firstAt = Math.max(window.startsAt, planStartsAt)
    const settleAt = Number.isFinite(window.exitsAt) ? window.exitsAt : undefined
    return {
      assetId: asset.id,
      liability,
      schedule: simulateLiability(liability, firstAt, settleAt, planStartsAt, planEndsAt),
    }
  })

  // A planned purchase the plan could not afford never happens: the asset is
  // not acquired, so its financing must not run either. Recorded once and
  // honoured for every following month — the buy is a one-time transfer, so it
  // is never retried.
  const abandonedAssetIds = new Set<string>()

  // Every plan has a cash balance and every flow runs through it (#331): it
  // opens at the plan's own cash (copied from the profile at creation), and
  // income, transfers, expenses and installments all go through it with the
  // insufficient-funds check applied. There is no way to exclude cash.
  let cashNominal = new Decimal(plan.cash_amount)

  // State-based per-asset balance tracking, stepped a month at a time. A
  // future-start investment is not held yet, so it starts at 0 and its
  // synthetic buy (below) pays the balance in when its month arrives.
  // Held from the plan's first month: not bought later, and not already sold
  // before the plan even starts (an exit before it never fires as a
  // one-time transfer, so seeding the balance would strand it forever).
  function heldAtPlanStart(id: string): boolean {
    const window = assetWindows.get(id)
    if (window === undefined) return true
    return !window.fundsFromCash && window.exitsAt >= planStartsAt
  }
  const invBalancesNominal = new Map<string, Decimal>(
    investments.map((i) => [i.id, heldAtPlanStart(i.id) ? new Decimal(i.balance) : DECIMAL_0]),
  )
  // A not-yet-purchased asset starts at 0; its synthetic buy (plus the
  // lender-funded part, below) brings it to full value in the purchase month.
  const tangValuesNominal = new Map<string, Decimal>(
    tangibleAssets.map((a) => [a.id, heldAtPlanStart(a.id) ? new Decimal(a.value) : DECIMAL_0]),
  )
  // Per-investment lookup so the transfer loop can apply entry/exit fees by
  // asset id without re-scanning the array.
  const investmentsById = new Map<string, ProfileInvestment>(investments.map((i) => [i.id, i]))

  // Monthly growth multipliers, taken once: (1 + yearly rate)^(1/12). An
  // investment grows at its APY net of fees (`effectiveInvestmentApy`). A
  // tangible asset follows inflation, so its real value stays flat, unless it
  // has its own value_over_time rate; floored at 0, a total write-off.
  // Balances stay truly nominal so that transfers, which move nominal amounts
  // between cash, investments and assets, neither create nor destroy wealth.
  const ONE_TWELFTH = new Decimal(1).div(12)
  const investmentMonthlyGrowth = new Map<string, Decimal>(
    investments.map((i) => [
      i.id,
      DECIMAL_1.plus(effectiveInvestmentApy(i).div(100)).pow(ONE_TWELFTH),
    ]),
  )
  // The same at the gross APY: the difference is what the fees take.
  const investmentGrossMonthlyGrowth = new Map<string, Decimal>(
    investments.map((i) => [i.id, DECIMAL_1.plus(new Decimal(i.apy).div(100)).pow(ONE_TWELFTH)]),
  )
  const tangibleMonthlyGrowth = new Map<string, Decimal>(
    tangibleAssets.map((a) => {
      if (a.value_over_time === undefined) return [a.id, planStart.monthly]
      const rate = new Decimal(a.value_rate ?? 0).div(100)
      const signed = a.value_over_time === 'depreciate' ? rate.negated() : rate
      return [a.id, Decimal.max(DECIMAL_1.plus(signed), DECIMAL_0).pow(ONE_TWELFTH)]
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
  // run before the user's transfers so a same-month contribution lands in a
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

  // An investment or asset only takes part in transfers from the month it is
  // bought to the month it is sold — money must not flow into one the user has
  // not bought yet, or into one they have already sold. Cash always passes.
  function isEndpointActive(id: string, at: number): boolean {
    const window = assetWindows.get(id)
    if (!window) return true
    return at >= window.startsAt && at <= window.exitsAt
  }

  const addTo = (map: Map<string, Decimal>, id: string, amount: Decimal) =>
    map.set(id, (map.get(id) ?? DECIMAL_0).plus(amount))
  const sumOf = (map: Map<string, Decimal>) =>
    Array.from(map.values()).reduce<Decimal>((sum, v) => sum.plus(v), DECIMAL_0)

  const projection: YearlyProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    // What each flow pays in each month of this year. Only what runs in the
    // year is listed among its cash flows.
    const incomeSpans = incomes.flatMap((item) => {
      const span = cashFlowSpan(item, new Decimal(item.amount), year, startYear, birth, planStart)
      return span ? [{ item, span }] : []
    })
    const expenseSpans = expenses.flatMap((item) => {
      const span = cashFlowSpan(item, new Decimal(item.amount), year, startYear, birth, planStart)
      return span ? [{ item, span }] : []
    })
    const transferSpans = new Map(
      planTransfers.map((t) => [t.id, transferSpan(t, year, startYear, birth, planStart)]),
    )

    // The year's flows, as paid (nominal) and in today's money (real): each
    // month's amount divided by that month's price level.
    const incomeNominal = new Map<string, Decimal>()
    const incomeReal = new Map<string, Decimal>()
    const expenseNominal = new Map<string, Decimal>()
    const expenseReal = new Map<string, Decimal>()
    const propertyTaxNominal = new Map<string, Decimal>()
    const propertyTaxReal = new Map<string, Decimal>()
    const installmentNominal = new Map<string, Decimal>()
    const installmentReal = new Map<string, Decimal>()
    // What left the source of each of the plan's own transfers this year.
    const transferMovedReal = new Map<string, Decimal>()
    // What each investment loses to fees this year, and each transfer to tax.
    const investmentFeesReal = new Map<string, Decimal>()
    const transferTaxReal = new Map<string, Decimal>()
    const addPositive = (map: Map<string, Decimal>, id: string, amount: Decimal) => {
      if (amount.greaterThan(0)) addTo(map, id, amount)
    }
    const insufficientTransferIds = new Set<string>()
    const insufficientAssetIds = new Set<string>()
    const insufficientExpenseIds = new Set<string>()

    for (let month = year === startYear ? planStart.month : 1; month <= 12; month++) {
      const at = monthIndex(year, month)
      const priceLevel = inflationFactor(planStart, year, month)

      // 1. Growth: the balances held at the start of the month earn it.
      //    The fee drag is what the balance would have grown by at the gross APY.
      for (const [id, balance] of invBalancesNominal) {
        const grown = balance.mul(investmentMonthlyGrowth.get(id) ?? DECIMAL_1)
        const grossGrown = balance.mul(investmentGrossMonthlyGrowth.get(id) ?? DECIMAL_1)
        addPositive(investmentFeesReal, id, grossGrown.minus(grown).div(priceLevel))
        invBalancesNominal.set(id, grown)
      }
      for (const [id, value] of tangValuesNominal) {
        tangValuesNominal.set(id, value.mul(tangibleMonthlyGrowth.get(id) ?? DECIMAL_1))
      }

      // 2. Income into cash up front, so this month's transfers and expenses
      //    can use it. A loan the plan takes on pays its principal in the
      //    month it starts (#322): booked alongside income, not as income, so
      //    it does not lift the savings rate or FI %.
      for (const { item, span } of incomeSpans) {
        const amount = spanMonthAmount(span, planStart, year, month)
        if (amount.isZero()) continue
        addTo(incomeNominal, item.id, amount)
        addTo(incomeReal, item.id, amount.div(priceLevel))
        cashNominal = cashNominal.plus(amount)
      }
      cashNominal = cashNominal.plus(borrowedByMonth.get(at) ?? DECIMAL_0)

      // 3. Transfers, before the cash check: a transfer into cash (drawing
      //    from an investment to fund an expense) then covers that expense
      //    instead of tripping a spurious insufficient-funds warning. Each is
      //    applied atomically: a source short of the amount skips it (no
      //    partial move, no overdraft).
      for (const transfer of planTransfers) {
        const span = transferSpans.get(transfer.id)
        if (span === undefined || month < span.from || month > span.to) continue
        // A recurring "Max" transfer has no amount to spread: it sweeps on its
        // frequency, a yearly one once a year in its first month that year
        // (when within a year is #490's question).
        if (
          transfer.transfer_all &&
          transfer.schedule !== 'one_time' &&
          transfer.frequency === 'yearly' &&
          month !== span.from
        )
          continue
        // The synthetic buy is what makes its asset active, so it is exempt
        // from the endpoint check on the way in.
        const plannedStartFor = plannedBuyAssetId(transfer)
        if (plannedStartFor === undefined) {
          if (
            !isEndpointActive(transfer.from_asset_id, at) ||
            !isEndpointActive(transfer.to_asset_id, at)
          )
            continue
        }
        const source = investmentsById.get(transfer.from_asset_id)
        const heldYears = year - (assetWindows.get(transfer.from_asset_id)?.startYear ?? startYear)
        const ownTransfer = plannedStartFor === undefined && !isPlannedSell(transfer)
        if (ownTransfer && !transferMovedReal.has(transfer.id)) {
          transferMovedReal.set(transfer.id, DECIMAL_0)
        }
        let amount: Decimal
        if (transfer.transfer_all) {
          // "Max" mode: take whatever the source has when the transfer fires.
          // If the source is empty we flag it — the user intended a sweep that
          // produced nothing. A planned exit of an empty investment is not a
          // plan failure, so it stays silent.
          amount = getBalance(transfer.from_asset_id)
          if (amount.lessThanOrEqualTo(0)) {
            if (!isPlannedSell(transfer)) insufficientTransferIds.add(transfer.id)
            continue
          }
        } else {
          // The entered amount is what arrives after the tax, so the source
          // gives up that plus the tax (`grossTransferAmount`).
          const entered = spanMonthAmount(span, planStart, year, month)
          amount = grossTransferAmount(transfer, entered, source, heldYears)
          if (amount.isZero()) continue
          const balance = getBalance(transfer.from_asset_id)
          // The source holds the amount but not the tax on top: sweep it the
          // way Max would (it lands less the tax) rather than skip the transfer.
          if (balance.lessThan(amount) && balance.greaterThanOrEqualTo(entered)) amount = balance
          if (balance.lessThan(amount)) {
            if (plannedStartFor !== undefined) {
              insufficientAssetIds.add(plannedStartFor)
              abandonedAssetIds.add(plannedStartFor)
            } else {
              insufficientTransferIds.add(transfer.id)
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
        if (ownTransfer) addTo(transferMovedReal, transfer.id, amount.div(priceLevel))
        const afterExitFee = applyExitFee(source, amount)
        const tax = estimatedTransferTax(transfer, amount, source, heldYears)
        const afterTax = Decimal.max(afterExitFee.minus(tax), DECIMAL_0)
        const net = applyEntryFee(investmentsById.get(transfer.to_asset_id), afterTax)
        addPositive(
          investmentFeesReal,
          transfer.from_asset_id,
          amount.minus(afterExitFee).div(priceLevel),
        )
        addPositive(transferTaxReal, transfer.id, afterExitFee.minus(afterTax).div(priceLevel))
        addPositive(investmentFeesReal, transfer.to_asset_id, afterTax.minus(net).div(priceLevel))
        deposit(transfer.to_asset_id, net)
      }

      // 4. The lender funds the rest of a financed purchase, so the asset is
      //    worth its full price from the purchase month even though only the
      //    down payment left cash. Net worth is unchanged: the financing
      //    liability starts the same month. Runs after the transfers so a
      //    down payment the plan could not afford books nothing at all.
      for (const asset of tangibleAssets) {
        const window = assetWindows.get(asset.id)
        if (!window?.fundsFromCash || at !== window.startsAt) continue
        if (asset.status !== 'financed' || !asset.outstanding_balance) continue
        if (abandonedAssetIds.has(asset.id)) continue
        tangValuesNominal.set(
          asset.id,
          (tangValuesNominal.get(asset.id) ?? DECIMAL_0).plus(
            new Decimal(asset.outstanding_balance),
          ),
        )
      }

      // 5. Expenses, installments and property tax, settled from cash after
      //    the transfers. If cash would go negative, every expense paid this
      //    month is flagged; installments drain cash too but aren't blamed.
      //    An abandoned purchase owes nothing and is taxed on nothing.
      let outflow = DECIMAL_0
      const paidExpenseIds: string[] = []
      for (const { item, span } of expenseSpans) {
        const amount = spanMonthAmount(span, planStart, year, month)
        if (amount.isZero()) continue
        addTo(expenseNominal, item.id, amount)
        addTo(expenseReal, item.id, amount.div(priceLevel))
        paidExpenseIds.push(item.id)
        outflow = outflow.plus(amount)
      }
      const payInstallment = (id: string, schedule: LiabilitySchedule) => {
        const paid = schedule.paidByMonth.get(at)
        if (paid === undefined) return
        addTo(installmentNominal, id, paid)
        addTo(installmentReal, id, paid.div(priceLevel))
        outflow = outflow.plus(paid)
      }
      for (const { liability, schedule } of standaloneLoans) payInstallment(liability.id, schedule)
      for (const { assetId, liability, schedule } of financedLoans) {
        if (!abandonedAssetIds.has(assetId)) payInstallment(liability.id, schedule)
      }
      // Property tax is a yearly percentage of the purchase price —
      // deliberately the flat nominal value, not the inflated or appreciated
      // one — paid a twelfth each month the asset is held.
      for (const asset of tangibleAssets) {
        if (!asset.property_tax_rate || abandonedAssetIds.has(asset.id)) continue
        const window = assetWindows.get(asset.id)
        if (window && (at < window.startsAt || at > window.exitsAt)) continue
        const tax = new Decimal(asset.value).mul(asset.property_tax_rate).div(100).div(12)
        addTo(propertyTaxNominal, asset.id, tax)
        addTo(propertyTaxReal, asset.id, tax.div(priceLevel))
        outflow = outflow.plus(tax)
      }
      const attemptedCash = cashNominal.minus(outflow)
      if (attemptedCash.lessThan(0)) paidExpenseIds.forEach((id) => insufficientExpenseIds.add(id))
      cashNominal = Decimal.max(attemptedCash, DECIMAL_0)
    }

    // 6. Aggregate the year at the end of its December, deflated by the price
    //    level then: (1 + inflation)^(months from the plan's start month).
    const deflationFactor = inflationFactor(planStart, year, 13)
    const investmentsNominal = sumOf(invBalancesNominal)
    const tangibleAssetsTotalNominal = sumOf(tangValuesNominal)
    const outstandingAt = (schedule: LiabilitySchedule) =>
      schedule.outstandingByYear.get(year) ?? DECIMAL_0
    const standaloneOutstandingNominal = standaloneLoans.reduce<Decimal>(
      (sum, { schedule }) => sum.plus(outstandingAt(schedule)),
      DECIMAL_0,
    )
    const liabilitiesOutstandingNominal = financedLoans.reduce<Decimal>(
      (sum, { assetId, schedule }) =>
        abandonedAssetIds.has(assetId) ? sum : sum.plus(outstandingAt(schedule)),
      standaloneOutstandingNominal,
    )

    const cashReal = cashNominal.div(deflationFactor)
    const investmentsReal = investmentsNominal.div(deflationFactor)
    const liabilitiesReal = liabilitiesOutstandingNominal.div(deflationFactor)
    const tangibleAssetsReal = tangibleAssetsTotalNominal.div(deflationFactor)
    const netWorth = cashReal.plus(investmentsReal).plus(tangibleAssetsReal).minus(liabilitiesReal)

    // Defensive output clamp: balances are conceptually >= 0; any tiny
    // negative residual from Decimal arithmetic or `-0` from
    // `Decimal.minus` would otherwise display as "-EUR 0" via Intl.
    const clampNonNeg = (d: Decimal): number => Math.max(0, d.toNumber())
    const real = (nominal: Decimal): number => nominal.div(deflationFactor).toNumber()

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
      ...standaloneLoans.map(({ liability, schedule }) => ({
        id: liability.id,
        name: liability.name,
        value: clampNonNeg(outstandingAt(schedule).div(deflationFactor)),
      })),
      ...financedLoans.map(({ assetId, liability, schedule }) => ({
        id: liability.id,
        name: liability.name,
        assetId,
        value: abandonedAssetIds.has(assetId)
          ? 0
          : clampNonNeg(outstandingAt(schedule).div(deflationFactor)),
      })),
    ]

    // 7. Per-year FI % and runway. FI mirrors the dashboard's getFiPercent in
    //    financial-totals.ts; the runway stays the ratio of investable wealth
    //    to outflows, while the dashboard's Runway card runs the drawdown in
    //    runway.ts (docs/product/runway.md). Investable wealth excludes
    //    tangibles and subtracts only standalone liabilities (a mortgage is
    //    secured by its asset); outflows include every installment actually
    //    paid this year. Numerator and denominator are both nominal, so the
    //    ratio is basis-independent.
    const outflowsNominal = sumOf(expenseNominal)
      .plus(sumOf(propertyTaxNominal))
      .plus(sumOf(installmentNominal))
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

    const items = (
      list: { id: string; name: string }[],
      amounts: Map<string, Decimal>,
    ): YearlyProjectionItem[] =>
      list.map((item) => ({
        id: item.id,
        name: item.name,
        value: (amounts.get(item.id) ?? DECIMAL_0).toNumber(),
      }))
    const incomesReal = sumOf(incomeReal)
    const expensesReal = sumOf(expenseReal).plus(sumOf(propertyTaxReal))
    const installmentsReal = sumOf(installmentReal)
    const loanItems = [
      ...standaloneLoans.map(({ liability }) => ({ liability, assetId: undefined })),
      ...financedLoans.map(({ liability, assetId }) => ({ liability, assetId })),
    ]

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
      totalIncome: incomesReal.toNumber(),
      totalExpenses: expensesReal.toNumber(),
      incomesByItem: items(
        incomeSpans.map(({ item }) => item),
        incomeReal,
      ),
      expensesByItem: items(
        expenseSpans.map(({ item }) => item),
        expenseReal,
      ),
      propertyTaxByItem: items(
        tangibleAssets.filter((a) => propertyTaxReal.has(a.id)),
        propertyTaxReal,
      ),
      installmentsByItem: loanItems.flatMap(({ liability, assetId }) => {
        const paid = installmentReal.get(liability.id)
        if (!paid) return []
        return [
          {
            id: liability.id,
            name: liability.name,
            value: paid.toNumber(),
            ...(assetId && { assetId }),
          },
        ]
      }),
      totalInstallments: installmentsReal.toNumber(),
      investmentFeesByItem: items(
        investments.filter((i) => investmentFeesReal.has(i.id)),
        investmentFeesReal,
      ),
      transferTaxByItem: items(
        plan.transfers.filter((t) => transferTaxReal.has(t.id)),
        transferTaxReal,
      ),
      cashFlow: incomesReal
        .minus(expensesReal)
        .minus(installmentsReal)
        .minus(sumOf(investmentFeesReal))
        .minus(sumOf(transferTaxReal))
        .toNumber(),
      transfersByItem: items(
        plan.transfers.filter((t) => transferMovedReal.has(t.id)),
        transferMovedReal,
      ),
      portfolioValue: real(investableNominal),
      fiPercent,
      runwayYears,
      insufficientFundTransferIds: [...insufficientTransferIds],
      insufficientFundAssetIds: [...insufficientAssetIds],
      insufficientFundExpenseIds: [...insufficientExpenseIds],
    })
  }

  return projection
}
