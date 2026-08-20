import Decimal from 'decimal.js'

import { DECIMAL_0, daysBetween } from '$lib/@snaha/kalkul-maths'
import { annualizedAmount, effectiveInvestmentApy, netIncome, yearOf } from '$lib/plan-projection'
import type { CashFlowEnd, CashFlowStart, Profile } from '$lib/schemas'
import { latestSnapshot } from '$lib/snapshots'
import { toDateOnlyString } from '$lib/utils'

const DAYS_PER_YEAR = 365.25
/**
 * Projected balances are rounded to the cent. Compounding a fraction of a year
 * leaves a long tail of digits that is pure noise at money scale, and it would
 * otherwise be shown verbatim in the Quick update inputs.
 */
const MONEY_DECIMALS = 2

/** Comparable index for a calendar month, so window edges sort as plain numbers. */
function monthIndex(year: number, month: number): number {
  return year * 12 + month
}

/** The start/end fields incomes and expenses have in common. */
interface CashFlowWindow {
  start: CashFlowStart
  start_year?: number
  start_month?: number
  start_age?: number
  end: CashFlowEnd
  end_year?: number
  end_month?: number
  end_age?: number
}

/**
 * Whether a cash flow is running on `asOf`, resolving the same fields the same
 * way `plan-projection.ts` does: 'at_specific_date' is precise to the month,
 * 'when_age_is' covers the whole calendar year the user reaches that age, and
 * 'immediately'/'now' are always running. An edge with incomplete data (a mode
 * whose field was never filled in, or an age window on a profile with no birth
 * date) is treated as unbounded, mirroring the projection's fallback to the
 * plan's first year / no end.
 */
function isActiveOn(flow: CashFlowWindow, asOf: Date, birthYear: number | undefined): boolean {
  const now = monthIndex(asOf.getFullYear(), asOf.getMonth() + 1)

  let startsAt = Number.NEGATIVE_INFINITY
  if (flow.start === 'at_specific_date' && flow.start_year !== undefined) {
    startsAt = monthIndex(flow.start_year, flow.start_month ?? 1)
  } else if (
    flow.start === 'when_age_is' &&
    birthYear !== undefined &&
    flow.start_age !== undefined
  ) {
    startsAt = monthIndex(birthYear + flow.start_age, 1)
  }
  if (now < startsAt) return false

  let endsAt = Number.POSITIVE_INFINITY
  if (flow.end === 'at_specific_date' && flow.end_year !== undefined) {
    endsAt = monthIndex(flow.end_year, flow.end_month ?? 12)
  } else if (flow.end === 'when_age_is' && birthYear !== undefined && flow.end_age !== undefined) {
    endsAt = monthIndex(birthYear + flow.end_age, 12)
  }
  return now <= endsAt
}

/**
 * Net yearly cash flow from everything actually running on `asOf`: take-home
 * income, less living expenses, less debt service on loans that still carry a
 * balance.
 *
 * Deliberately not the profile-level totals in `financial-totals.ts`, which
 * ignore start/end windows: those answer "at today's flow levels" for the
 * savings rate, FI % and runway. Accrual is a different question — a salary
 * that starts next year must not top up today's cash, and an expense that
 * ended last spring must not keep draining it.
 */
function netAnnualFlowOn(profile: Profile, asOf: Date): Decimal {
  const birthYear = profile.birth_date ? yearOf(profile.birth_date) : undefined
  const active = <T extends CashFlowWindow>(items: T[] | undefined): T[] =>
    (items ?? []).filter((item) => isActiveOn(item, asOf, birthYear))

  const income = active(profile.incomes).reduce<Decimal>(
    (sum, i) => sum.plus(annualizedAmount(netIncome(i), i.frequency)),
    DECIMAL_0,
  )
  const expenses = active(profile.expenses).reduce<Decimal>(
    (sum, e) => sum.plus(annualizedAmount(new Decimal(e.amount), e.frequency)),
    DECIMAL_0,
  )
  // Loans carry no start/end window of their own — one is serviced for as long
  // as it still has a balance to pay off.
  const debtService = [
    ...(profile.liabilities ?? []),
    ...(profile.tangible_assets ?? []).filter((a) => a.status === 'financed'),
  ].reduce<Decimal>(
    (sum, loan) =>
      (loan.outstanding_balance ?? 0) > 0
        ? sum.plus(
            annualizedAmount(
              new Decimal(loan.installment_amount ?? 0),
              loan.installment_frequency ?? 'monthly',
            ),
          )
        : sum,
    DECIMAL_0,
  )

  return income.minus(expenses).minus(debtService)
}

/**
 * Balances as they stand *today*, projected forward from the most recent
 * snapshot. The stored profile holds the values the user last confirmed; this
 * grows investments at their effective APY and accrues cash at the net of
 * income, expenses and debt service over the elapsed time.
 *
 * Tangible assets and liabilities are returned untouched: their values only
 * change through an explicit edit in financial data, and Quick update does not
 * ask about them either.
 *
 * Returns the profile unchanged when nothing has elapsed — no snapshots yet, or
 * the latest one is dated today (or, defensively, in the future).
 */
export function getCurrentProfile(profile: Profile, today: Date): Profile {
  const snapshot = latestSnapshot(profile.snapshots)
  if (!snapshot) return profile

  const todayDate = toDateOnlyString(today)
  if (snapshot.date >= todayDate) return profile

  const yearFraction = new Decimal(daysBetween(snapshot.date, todayDate)).div(DAYS_PER_YEAR)

  // Which flows are running is evaluated once, as of today: a flow that
  // started or ended partway through the elapsed window counts for all of it or
  // none of it. Integrating piecewise over every window edge would buy little
  // for a figure the user sees and re-confirms in Quick update.
  const netAnnualFlow = netAnnualFlowOn(profile, today)

  return {
    ...profile,
    cash_amount: Decimal.max(
      new Decimal(profile.cash_amount ?? 0).plus(netAnnualFlow.mul(yearFraction)),
      DECIMAL_0,
    )
      .toDecimalPlaces(MONEY_DECIMALS)
      .toNumber(),
    investments: profile.investments?.map((investment) => ({
      ...investment,
      balance: new Decimal(investment.balance)
        .mul(effectiveInvestmentApy(investment).div(100).plus(1).pow(yearFraction))
        .toDecimalPlaces(MONEY_DECIMALS)
        .toNumber(),
    })),
  }
}

/**
 * Change from `previous` to `current` as a percentage, or undefined when there
 * is no baseline to compare against.
 */
export function percentChange(previous: number, current: number): number | undefined {
  if (previous === 0) return undefined
  return ((current - previous) / previous) * 100
}
