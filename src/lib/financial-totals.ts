import Decimal from 'decimal.js'

import { DECIMAL_0 } from '$lib/@snaha/kalkul-maths'
import { CATEGORY_COLORS } from '$lib/chart-colors'
import { annualizedAmount, netIncome } from '$lib/plan-projection'
import type { Frequency, Profile } from '$lib/schemas'

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

export function getNetWorth(profile: Profile): number {
  return getTotalAssets(profile) - getLiabilitiesTotal(profile)
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

export function getAnnualExpensesTotal(profile: Profile): number {
  // ponytail: sums all expenses regardless of start/end windows; filter to
  // currently-active flows if future-dated expenses become common
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
 */
export function getAnnualIncomeTotal(profile: Profile): number {
  // ponytail: sums all incomes regardless of start/end windows, mirroring
  // getAnnualExpensesTotal
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
export function getAnnualDebtServiceTotal(profile: Profile): number {
  const annualize = (amount: number | undefined, frequency: Frequency | undefined) =>
    annualizedAmount(new Decimal(amount ?? 0), frequency ?? 'monthly')
  return (profile.liabilities ?? [])
    .reduce<Decimal>(
      (sum, l) => sum.plus(annualize(l.installment_amount, l.installment_frequency)),
      DECIMAL_0,
    )
    .plus(
      (profile.tangible_assets ?? [])
        .filter((a) => a.status === 'financed')
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
  if ((profile.cash_amount ?? 0) > 0) return true
  if ((profile.investments ?? []).some((i) => i.balance > 0)) return true
  if ((profile.tangible_assets ?? []).some((a) => a.value > 0)) return true
  if ((profile.liabilities ?? []).some((l) => l.outstanding_balance > 0)) return true
  return false
}
