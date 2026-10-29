import Decimal from 'decimal.js'

import { DECIMAL_0 } from '$lib/@snaha/kalkul-maths'
import { getAnnualExpensesTotal, getAnnualIncomeTotal } from '$lib/financial-totals'
import {
  INSTALLMENT_PERIODS_PER_YEAR,
  annualizedAmount,
  financingToLiability,
  remainingInstallmentPeriods,
} from '$lib/plan-projection'
import type { Profile, ProfileLiability, RunwaySettings } from '$lib/schemas'

// Off by default: income and asset sales. With cash and investments only, the
// default matches what the card showed before the settings existed.
export const DEFAULT_RUNWAY_SETTINGS: RunwaySettings = {
  include_income: false,
  withdraw_investments: true,
  investment_growth: true,
  investment_tax_rate: 0,
  sell_tangible_assets: false,
  tangible_asset_growth: true,
  tangible_asset_tax_rate: 0,
}

/** Past this the money is as good as endless and the card reads "100+ years". */
export const RUNWAY_CAP_YEARS = 100

const DECIMAL_1 = new Decimal(1)
const DECIMAL_12 = new Decimal(12)
const DECIMAL_100 = new Decimal(100)

/** Monthly growth factor for an annual percentage (negative to depreciate). */
function monthlyFactor(annualPercent: number | undefined): Decimal {
  return DECIMAL_1.plus(new Decimal(annualPercent ?? 0).div(DECIMAL_100)).pow(
    DECIMAL_1.div(DECIMAL_12),
  )
}

interface Loan {
  /** The financed asset this loan belongs to; selling it settles the loan. */
  assetId?: string
  monthly: Decimal
  months: number
  monthsLeft: number
  balance: Decimal
}

function loanOf(l: ProfileLiability, assetId?: string): Loan | undefined {
  if (!(l.outstanding_balance > 0) || !(l.installment_amount > 0)) return undefined
  const monthly = annualizedAmount(new Decimal(l.installment_amount), l.installment_frequency).div(
    DECIMAL_12,
  )
  const periods = remainingInstallmentPeriods(l)
  // Without a usable term the installments run until they cover the balance.
  const months =
    periods > 0
      ? Math.round((periods * 12) / INSTALLMENT_PERIODS_PER_YEAR[l.installment_frequency])
      : new Decimal(l.outstanding_balance).div(monthly).ceil().toNumber()
  return {
    assetId,
    monthly,
    months,
    monthsLeft: months,
    balance: new Decimal(l.outstanding_balance),
  }
}

/**
 * How long today's money lasts against today's outflows, in years.
 *
 * A month-by-month drawdown in today's money: expenses and loan installments
 * come out of cash, then out of investments, then out of tangible assets, as
 * far as `settings` allows. Growth is applied at each item's own rate and tax
 * only to growth accrued after today: the balance now is the cost basis, so a
 * rough gain estimate needs no purchase history. Installments run for the
 * loan's remaining term; selling a financed asset settles what is still owed
 * on it. `Infinity` means the money outlasts `RUNWAY_CAP_YEARS`, `undefined`
 * that there is nothing to pay.
 */
export function getRunwayYears(
  profile: Profile,
  settings: RunwaySettings = profile.runway_settings ?? DEFAULT_RUNWAY_SETTINGS,
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
  if (monthlyExpenses.isZero() && loans.length === 0) return undefined

  const investmentTax = new Decimal(settings.investment_tax_rate).div(DECIMAL_100)
  const tangibleTax = new Decimal(settings.tangible_asset_tax_rate).div(DECIMAL_100)
  const investments = (profile.investments ?? [])
    .filter((i) => i.balance > 0)
    .map((i) => ({
      balance: new Decimal(i.balance),
      basis: new Decimal(i.balance),
      factor: monthlyFactor(i.apy),
    }))
  const tangibles = (profile.tangible_assets ?? [])
    .filter((a) => a.value > 0)
    .map((a) => ({
      id: a.id,
      value: new Decimal(a.value),
      basis: new Decimal(a.value),
      factor: monthlyFactor(
        a.value_over_time === 'depreciate' ? -(a.value_rate ?? 0) : a.value_rate,
      ),
      sold: false,
    }))
  let cash = new Decimal(profile.cash_amount ?? 0)

  for (let month = 1; month <= RUNWAY_CAP_YEARS * 12; month++) {
    if (settings.investment_growth)
      for (const inv of investments) inv.balance = inv.balance.mul(inv.factor)
    if (settings.tangible_asset_growth)
      for (const t of tangibles) if (!t.sold) t.value = t.value.mul(t.factor)

    let out = monthlyExpenses
    for (const loan of loans) {
      if (loan.monthsLeft <= 0) continue
      if (tangibles.some((t) => t.id === loan.assetId && t.sold)) continue
      out = out.plus(loan.monthly)
      loan.monthsLeft--
    }
    const netOut = out.minus(monthlyIncome)
    cash = cash.minus(netOut)

    if (cash.lessThan(0) && settings.withdraw_investments) {
      for (const inv of investments) {
        if (!cash.lessThan(0)) break
        if (inv.balance.lessThanOrEqualTo(0)) continue
        // Only the gain share of what is sold is taxed; the rest is basis.
        const gainShare = Decimal.max(inv.balance.minus(inv.basis), 0).div(inv.balance)
        const netPerUnit = DECIMAL_1.minus(investmentTax.mul(gainShare))
        if (netPerUnit.lessThanOrEqualTo(0)) continue
        const wanted = cash.neg().div(netPerUnit)
        const sold = Decimal.min(inv.balance, wanted)
        // Selling exactly the shortfall lands on zero, not a rounding residue.
        cash = sold.equals(wanted) ? DECIMAL_0 : cash.plus(sold.mul(netPerUnit))
        inv.basis = inv.basis.mul(DECIMAL_1.minus(sold.div(inv.balance)))
        inv.balance = inv.balance.minus(sold)
      }
    }
    if (cash.lessThan(0) && settings.sell_tangible_assets) {
      for (const t of tangibles) {
        if (!cash.lessThan(0)) break
        if (t.sold) continue
        const loan = loans.find((l) => l.assetId === t.id)
        // ponytail: what is still owed amortises evenly; the schedule would be exact.
        const owed = loan ? loan.balance.mul(loan.monthsLeft).div(loan.months) : DECIMAL_0
        const tax = tangibleTax.mul(Decimal.max(t.value.minus(t.basis), 0))
        const proceeds = t.value.minus(tax).minus(owed)
        if (proceeds.lessThanOrEqualTo(0)) continue
        cash = cash.plus(proceeds)
        t.sold = true
      }
    }
    if (cash.lessThan(0)) {
      // The month ran out part-way: count the share of its net outflow that
      // was covered, from cash and from whatever was sold.
      const covered = DECIMAL_1.minus(cash.neg().div(netOut)).toNumber()
      return (month - 1 + covered) / 12
    }
  }
  return Infinity
}
