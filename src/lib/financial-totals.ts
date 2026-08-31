import Decimal from 'decimal.js'

import { DECIMAL_0 } from '$lib/@snaha/kalkul-maths'
import { CATEGORY_COLORS } from '$lib/chart-colors'
import { annualizedAmount, netIncome } from '$lib/plan-projection'
import type { Frequency, Profile } from '$lib/schemas'
import { hasAnyBalance, snapshotBalances, snapshotNetWorth } from '$lib/snapshots'

export type CategoryLabel = 'cash' | 'investments' | 'tangible-assets' | 'liabilities'

export interface OverviewSegment {
  label: CategoryLabel
  value: number
  color: string
}

export function getCashTotal(profile: Profile): number {
  return profile.cash_amount ?? 0
}

export function getInvestmentsTotal(profile: Profile): number {
  return (profile.investments ?? []).reduce((sum, i) => sum + i.balance, 0)
}

export function getTangibleAssetsTotal(profile: Profile): number {
  return (profile.tangible_assets ?? []).reduce((sum, a) => sum + a.value, 0)
}

function getStandaloneLiabilitiesTotal(profile: Profile): number {
  return (profile.liabilities ?? []).reduce((sum, l) => sum + l.outstanding_balance, 0)
}

export function getFinancedAssetsDebtTotal(profile: Profile): number {
  return (profile.tangible_assets ?? [])
    .filter((a) => a.status === 'financed')
    .reduce((sum, a) => sum + (a.outstanding_balance ?? 0), 0)
}

export function getLiabilitiesTotal(profile: Profile): number {
  return getStandaloneLiabilitiesTotal(profile) + getFinancedAssetsDebtTotal(profile)
}

export function getTotalAssets(profile: Profile): number {
  return getCashTotal(profile) + getInvestmentsTotal(profile) + getTangibleAssetsTotal(profile)
}

/**
 * Assets less every debt. Delegated to `snapshotNetWorth` so the live profile
 * and a recorded snapshot are summed by one definition — the History chart
 * plots snapshots next to this figure and the two must agree.
 */
export function getNetWorth(profile: Profile): number {
  return snapshotNetWorth(snapshotBalances(profile))
}

export function getOverviewSegments(profile: Profile): OverviewSegment[] {
  const segments: OverviewSegment[] = []
  const cash = getCashTotal(profile)
  if (cash > 0) {
    segments.push({ label: 'cash', value: cash, color: CATEGORY_COLORS.cash })
  }
  const investments = getInvestmentsTotal(profile)
  if (investments > 0) {
    segments.push({
      label: 'investments',
      value: investments,
      color: CATEGORY_COLORS.investments[0],
    })
  }
  const tangible = getTangibleAssetsTotal(profile)
  if (tangible > 0) {
    segments.push({
      label: 'tangible-assets',
      value: tangible,
      color: CATEGORY_COLORS.tangibleAssets[0],
    })
  }
  const liabilities = getLiabilitiesTotal(profile)
  if (liabilities > 0) {
    segments.push({
      label: 'liabilities',
      value: liabilities,
      color: CATEGORY_COLORS.liabilities[0],
    })
  }
  return segments
}

/**
 * Yearly living expenses at today's levels, counting every expense regardless
 * of its start/end window. That is the convention the savings rate, FI % and
 * runway are stated in. The dashboard's cash accrual asks a different question
 * ("what is running right now") and uses its own window-aware totals in
 * `current-values.ts`.
 */
export function getAnnualExpensesTotal(profile: Profile): number {
  return (profile.expenses ?? [])
    .reduce<Decimal>(
      (sum, e) => sum.plus(annualizedAmount(new Decimal(e.amount), e.frequency)),
      DECIMAL_0,
    )
    .toNumber()
}

/**
 * Yearly take-home income. Withheld taxes come off the top via the projection
 * engine's `netIncome`, so the dashboard's savings rate and the Current
 * projection card agree on what the user actually receives.
 *
 * Window-agnostic like `getAnnualExpensesTotal` — see the note there.
 */
export function getAnnualIncomeTotal(profile: Profile): number {
  return (profile.incomes ?? [])
    .reduce<Decimal>((sum, i) => sum.plus(annualizedAmount(netIncome(i), i.frequency)), DECIMAL_0)
    .toNumber()
}

export interface SavingsRate {
  /** Share of income left after expenses and debt service, as a percentage. */
  percent: number
  /** The same figure in currency per year. Negative when outflows exceed income. */
  annualAmount: number
}

/**
 * What share of income survives the year's outflows. Debt service counts as an
 * outflow alongside living expenses, matching FI % and runway.
 *
 * Undefined when there is no income to take a share of.
 */
export function getSavingsRate(profile: Profile): SavingsRate | undefined {
  const income = getAnnualIncomeTotal(profile)
  if (income <= 0) return undefined
  const annualAmount = income - getAnnualExpensesTotal(profile) - getAnnualDebtServiceTotal(profile)
  return { percent: (annualAmount / income) * 100, annualAmount }
}

// Annualized loan payments (standalone liabilities + financed assets). Debt
// service is a non-optional outflow, so FI %/runway count it alongside
// living expenses.
//
// A loan is only serviced while it still has a balance — the same gate the
// dashboard's cash accrual applies in `current-values.ts`. A paid-off loan whose
// installment was never cleared out would otherwise drain phantom money from
// the savings rate, FI % and runway.
export function getAnnualDebtServiceTotal(profile: Profile): number {
  const annualize = (amount: number | undefined, frequency: Frequency | undefined) =>
    annualizedAmount(new Decimal(amount ?? 0), frequency ?? 'monthly')
  return (profile.liabilities ?? [])
    .filter((l) => (l.outstanding_balance ?? 0) > 0)
    .reduce<Decimal>(
      (sum, l) => sum.plus(annualize(l.installment_amount, l.installment_frequency)),
      DECIMAL_0,
    )
    .plus(
      (profile.tangible_assets ?? [])
        .filter((a) => a.status === 'financed' && (a.outstanding_balance ?? 0) > 0)
        .reduce<Decimal>(
          (sum, a) => sum.plus(annualize(a.installment_amount, a.installment_frequency)),
          DECIMAL_0,
        ),
    )
    .toNumber()
}

export function getInvestableNetWorth(profile: Profile): number {
  // Financed-asset debt (e.g. the home mortgage) is excluded along with the
  // asset that secures it — only standalone liabilities reduce investable wealth.
  return (
    getCashTotal(profile) + getInvestmentsTotal(profile) - getStandaloneLiabilitiesTotal(profile)
  )
}

export function getFiPercent(profile: Profile): number | undefined {
  const annualOutflows = getAnnualExpensesTotal(profile) + getAnnualDebtServiceTotal(profile)
  if (annualOutflows <= 0) return undefined
  return Math.max(0, (getInvestableNetWorth(profile) / (annualOutflows * 25)) * 100)
}

export function getRunwayYears(profile: Profile): number | undefined {
  const annualOutflows = getAnnualExpensesTotal(profile) + getAnnualDebtServiceTotal(profile)
  if (annualOutflows <= 0) return undefined
  return Math.max(0, getInvestableNetWorth(profile) / annualOutflows)
}

export function hasAnyFinancialData(profile: Profile): boolean {
  return hasAnyBalance(snapshotBalances(profile))
}
