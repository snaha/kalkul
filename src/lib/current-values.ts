import Decimal from 'decimal.js'

import { DECIMAL_0, daysBetween } from '$lib/@snaha/kalkul-maths'
import {
  getAnnualDebtServiceTotal,
  getAnnualExpensesTotal,
  getAnnualIncomeTotal,
} from '$lib/financial-totals'
import { effectiveInvestmentApy } from '$lib/plan-projection'
import type { Profile } from '$lib/schemas'
import { latestSnapshot } from '$lib/snapshots'
import { toDateOnlyString } from '$lib/utils'

const DAYS_PER_YEAR = 365.25
/**
 * Projected balances are rounded to the cent. Compounding a fraction of a year
 * leaves a long tail of digits that is pure noise at money scale, and it would
 * otherwise be shown verbatim in the Quick update inputs.
 */
const MONEY_DECIMALS = 2

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

  const netAnnualFlow = new Decimal(getAnnualIncomeTotal(profile))
    .minus(getAnnualExpensesTotal(profile))
    .minus(getAnnualDebtServiceTotal(profile))

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
