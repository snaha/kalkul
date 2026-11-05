import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths'
import { getAnnualExpensesTotal, getAnnualIncomeTotal } from '$lib/financial-totals'
import {
  INSTALLMENT_PERIODS_PER_YEAR,
  effectiveInvestmentApy,
  financingToLiability,
  installmentPeriodRate,
} from '$lib/plan-projection'
import type { Profile, ProfileLiability, ProfileTangibleAsset } from '$lib/schemas'

/**
 * What the Runway card may draw on after cash. Each key is stored flat on the
 * profile as `runway_<key>`, the shape `fi_withdrawal_rate` uses, so Apply
 * writes only the fields the user changed.
 */
export interface RunwaySettings {
  withdraw_investments: boolean
  investment_growth: boolean
  /** Percent of the gain since today taken when an investment is sold. */
  investment_tax_rate: number
  include_income: boolean
  sell_tangible_assets: boolean
  tangible_asset_growth: boolean
  /** Percent of the gain since today taken when an asset is sold. */
  tangible_asset_tax_rate: number
}

/** The Figma defaults: cash and investments without growth; income and asset sales off. */
export const DEFAULT_RUNWAY_SETTINGS: RunwaySettings = {
  withdraw_investments: true,
  investment_growth: false,
  investment_tax_rate: 0,
  include_income: false,
  sell_tangible_assets: false,
  tangible_asset_growth: false,
  tangible_asset_tax_rate: 0,
}

const SETTING_KEYS = Object.keys(DEFAULT_RUNWAY_SETTINGS) as (keyof RunwaySettings)[]

/** The settings stored on the profile, each falling back to its default. */
export function runwaySettingsOf(profile: Profile): RunwaySettings {
  return {
    withdraw_investments:
      profile.runway_withdraw_investments ?? DEFAULT_RUNWAY_SETTINGS.withdraw_investments,
    investment_growth:
      profile.runway_investment_growth ?? DEFAULT_RUNWAY_SETTINGS.investment_growth,
    investment_tax_rate:
      profile.runway_investment_tax_rate ?? DEFAULT_RUNWAY_SETTINGS.investment_tax_rate,
    include_income: profile.runway_include_income ?? DEFAULT_RUNWAY_SETTINGS.include_income,
    sell_tangible_assets:
      profile.runway_sell_tangible_assets ?? DEFAULT_RUNWAY_SETTINGS.sell_tangible_assets,
    tangible_asset_growth:
      profile.runway_tangible_asset_growth ?? DEFAULT_RUNWAY_SETTINGS.tangible_asset_growth,
    tangible_asset_tax_rate:
      profile.runway_tangible_asset_tax_rate ?? DEFAULT_RUNWAY_SETTINGS.tangible_asset_tax_rate,
  }
}

/**
 * Which tax rates are in effect: each only while its switch and its growth
 * checkbox are on, which is also when the dialog shows it.
 */
export function taxRatesInEffect(settings: RunwaySettings): {
  investment: boolean
  tangible: boolean
} {
  return {
    investment: settings.withdraw_investments && settings.investment_growth,
    tangible: settings.sell_tangible_assets && settings.tangible_asset_growth,
  }
}

/**
 * The profile fields `settings` changes, which is all the dialog's Apply
 * writes. A tax rate not in effect is left as stored.
 */
export function changedRunwaySettings(
  profile: Profile,
  settings: RunwaySettings,
): Partial<Profile> {
  const stored = runwaySettingsOf(profile)
  const shown = taxRatesInEffect(settings)
  const next: RunwaySettings = {
    ...settings,
    investment_tax_rate: shown.investment
      ? settings.investment_tax_rate
      : stored.investment_tax_rate,
    tangible_asset_tax_rate: shown.tangible
      ? settings.tangible_asset_tax_rate
      : stored.tangible_asset_tax_rate,
  }
  return Object.fromEntries(
    SETTING_KEYS.filter((key) => next[key] !== stored[key]).map((key) => [
      `runway_${key}`,
      next[key],
    ]),
  ) as Partial<Profile>
}

/** Whether a tax rate is a percentage the schema accepts. */
export function validTaxRate(rate: number): boolean {
  return rate >= 0 && rate <= 100
}

/** Whether the tax rates in effect are percentages the schema accepts. */
export function validRunwaySettings(settings: RunwaySettings): boolean {
  const shown = taxRatesInEffect(settings)
  return (
    (!shown.investment || validTaxRate(settings.investment_tax_rate)) &&
    (!shown.tangible || validTaxRate(settings.tangible_asset_tax_rate))
  )
}

/** Past this the money is as good as endless and the card reads "100+ years". */
export const RUNWAY_CAP_YEARS = 100

const MONTHS_PER_YEAR = 12
const DECIMAL_12 = new Decimal(MONTHS_PER_YEAR)
const DECIMAL_100 = new Decimal(100)

/** Monthly growth factor for an annual percentage; a total loss floors at 0. */
function monthlyFactor(annualPercent: Decimal): Decimal {
  return Decimal.max(DECIMAL_1.plus(annualPercent.div(DECIMAL_100)), DECIMAL_0).pow(
    DECIMAL_1.div(DECIMAL_12),
  )
}

/** The asset's own yearly change; one with no rate set does not move, as nothing else does. */
function tangibleAnnualRate(asset: ProfileTangibleAsset): Decimal {
  if (asset.value_over_time === undefined) return DECIMAL_0
  const rate = new Decimal(asset.value_rate ?? 0)
  return asset.value_over_time === 'depreciate' ? rate.negated() : rate
}

interface Loan {
  /** The financed asset this loan belongs to; selling it settles the loan. */
  assetId?: string
  balance: Decimal
  /** Interest for one month, from the loan's own per-installment rate. */
  monthlyRate: Decimal
  /** What a month's installments add up to. */
  monthlyPayment: Decimal
  monthsLeft: number
}

function loanOf(l: ProfileLiability, assetId?: string): Loan | undefined {
  if (!(l.outstanding_balance > 0)) return undefined
  const periodsPerMonth = new Decimal(INSTALLMENT_PERIODS_PER_YEAR[l.installment_frequency]).div(
    DECIMAL_12,
  )
  const months =
    l.remaining_term_unit === 'months' ? l.remaining_term : l.remaining_term * MONTHS_PER_YEAR
  // A loan with no installment is never paid, but it is still owed, so a sale
  // of its asset settles the balance as it stands.
  const scheduled = l.installment_amount > 0
  return {
    assetId,
    balance: new Decimal(l.outstanding_balance),
    monthlyRate: DECIMAL_1.plus(installmentPeriodRate(l)).pow(periodsPerMonth).minus(DECIMAL_1),
    monthlyPayment: new Decimal(l.installment_amount).mul(periodsPerMonth),
    // Without a usable term the installments run until they cover the balance.
    monthsLeft: !scheduled ? 0 : months > 0 ? months : Infinity,
  }
}

const owes = (loan: Loan): boolean => loan.balance.greaterThan(0) && loan.monthsLeft > 0

/** One month of the loan's schedule, on the terms the projection amortizes with; returns what it cost. */
function payMonth(loan: Loan): Decimal {
  if (!owes(loan)) return DECIMAL_0
  const due = loan.balance.plus(loan.balance.mul(loan.monthlyRate))
  // The last scheduled month settles whatever is left, the balloon the projection pays too.
  const payment = loan.monthsLeft <= 1 ? due : Decimal.min(loan.monthlyPayment, due)
  loan.balance = Decimal.max(due.minus(payment), DECIMAL_0)
  loan.monthsLeft -= 1
  return payment
}

function settle(loan: Loan): void {
  loan.balance = DECIMAL_0
  loan.monthsLeft = 0
}

/**
 * How long the money lasts against today's outflows, in years.
 *
 * A month-by-month drawdown. Expenses and loan installments come out of cash,
 * then out of investments, then out of tangible assets, as far as `settings`
 * allows. Loans run on their own schedule for their remaining term; selling a
 * financed asset settles what is still owed on it. Growth, where switched on,
 * runs at each item's own rate, and tax takes a share of the growth accrued
 * since today only: the balance now is the only cost basis there is. Nothing
 * else moves, so amounts are nominal and flat. `Infinity` means the money
 * never runs out or outlasts `RUNWAY_CAP_YEARS`, `undefined` that there is
 * nothing to pay.
 */
export function getRunwayYears(
  profile: Profile,
  settings: RunwaySettings = runwaySettingsOf(profile),
): number | undefined {
  const monthlyIncome = settings.include_income
    ? new Decimal(getAnnualIncomeTotal(profile)).div(DECIMAL_12)
    : DECIMAL_0
  const monthlyExpenses = new Decimal(getAnnualExpensesTotal(profile)).div(DECIMAL_12)
  const loans: Loan[] = []
  for (const l of profile.liabilities ?? []) {
    const loan = loanOf(l)
    if (loan) loans.push(loan)
  }
  for (const a of profile.tangible_assets ?? []) {
    const financing = financingToLiability(a)
    const loan = financing && loanOf(financing, a.id)
    if (loan) loans.push(loan)
  }
  if (monthlyExpenses.isZero() && !loans.some(owes)) return undefined

  const investmentTax = new Decimal(settings.investment_tax_rate).div(DECIMAL_100)
  const tangibleTax = new Decimal(settings.tangible_asset_tax_rate).div(DECIMAL_100)
  const investments = settings.withdraw_investments
    ? (profile.investments ?? [])
        .filter((i) => i.balance > 0)
        .map((i) => ({
          balance: new Decimal(i.balance),
          basis: new Decimal(i.balance),
          factor: monthlyFactor(effectiveInvestmentApy(i)),
        }))
    : []
  const tangibles = settings.sell_tangible_assets
    ? (profile.tangible_assets ?? [])
        .filter((a) => a.value > 0)
        .map((a) => ({
          id: a.id,
          value: new Decimal(a.value),
          basis: new Decimal(a.value),
          factor: monthlyFactor(tangibleAnnualRate(a)),
          sold: false,
        }))
    : []
  let cash = new Decimal(profile.cash_amount ?? 0)
  // What drains every month once the loans are paid.
  const baseOut = monthlyExpenses.minus(monthlyIncome)

  for (let month = 1; month <= RUNWAY_CAP_YEARS * MONTHS_PER_YEAR; month++) {
    if (settings.investment_growth)
      for (const inv of investments) inv.balance = inv.balance.mul(inv.factor)
    if (settings.tangible_asset_growth)
      for (const t of tangibles) if (!t.sold) t.value = t.value.mul(t.factor)

    let out = monthlyExpenses
    for (const loan of loans) out = out.plus(payMonth(loan))
    const netOut = out.minus(monthlyIncome)
    cash = cash.minus(netOut)

    for (const inv of investments) {
      if (!cash.lessThan(0)) break
      if (inv.balance.lessThanOrEqualTo(0)) continue
      // Only the gain share of what is sold is taxed; the rest is basis.
      const gainShare = Decimal.max(inv.balance.minus(inv.basis), DECIMAL_0).div(inv.balance)
      const netPerUnit = DECIMAL_1.minus(investmentTax.mul(gainShare))
      if (netPerUnit.lessThanOrEqualTo(0)) continue
      const wanted = cash.neg().div(netPerUnit)
      const sold = Decimal.min(inv.balance, wanted)
      // Selling exactly the shortfall lands on zero, not a rounding residue.
      cash = sold.equals(wanted) ? DECIMAL_0 : cash.plus(sold.mul(netPerUnit))
      inv.basis = inv.basis.mul(DECIMAL_1.minus(sold.div(inv.balance)))
      inv.balance = inv.balance.minus(sold)
    }
    for (const t of tangibles) {
      if (!cash.lessThan(0)) break
      if (t.sold) continue
      const loan = loans.find((l) => l.assetId === t.id)
      const tax = tangibleTax.mul(Decimal.max(t.value.minus(t.basis), DECIMAL_0))
      const proceeds = t.value.minus(tax).minus(loan?.balance ?? DECIMAL_0)
      if (proceeds.lessThanOrEqualTo(0)) continue
      cash = cash.plus(proceeds)
      t.sold = true
      if (loan) settle(loan)
    }

    if (cash.lessThan(0)) {
      // Cash below zero against a net surplus is climbing out; keep walking.
      if (netOut.lessThan(0)) continue
      // The month ran out part-way: count the share of its net outflow that
      // was covered. Cash that started below zero against no net outflow
      // never recovers, so it is simply out.
      const covered = netOut.greaterThan(0)
        ? Decimal.max(DECIMAL_1.minus(cash.neg().div(netOut)), DECIMAL_0)
        : DECIMAL_0
      return covered
        .plus(month - 1)
        .div(DECIMAL_12)
        .toNumber()
    }

    if (loans.some(owes)) continue
    // Nothing drains: the money never runs out.
    if (baseOut.lessThanOrEqualTo(0)) return Infinity
    const drawn = investments.find((inv) => inv.balance.greaterThan(0))
    if (settings.investment_growth && drawn) {
      // The investment being drawn can never shrink once a month's growth,
      // taxed as if it were all gain, covers the draw. Anything short of that
      // walks the months: the tax rises as sales eat the basis, and the next
      // investment in line may grow slower.
      const growth = drawn.balance.mul(drawn.factor.minus(DECIMAL_1))
      if (growth.mul(DECIMAL_1.minus(investmentTax)).greaterThanOrEqualTo(baseOut)) return Infinity
      continue
    }
    const unsold = tangibles.filter((t) => !t.sold)
    if (settings.tangible_asset_growth && unsold.length > 0) continue
    // Flat from here on, with no gain left to tax: what is left over what
    // drains, without walking the months.
    const left = investments
      .reduce((sum, inv) => sum.plus(inv.balance), cash)
      .plus(unsold.reduce((sum, t) => sum.plus(t.value), DECIMAL_0))
    const months = left.div(baseOut).plus(month)
    return months.greaterThan(RUNWAY_CAP_YEARS * MONTHS_PER_YEAR)
      ? Infinity
      : months.div(DECIMAL_12).toNumber()
  }
  return Infinity
}
