import { CATEGORY_COLORS } from '$lib/chart-colors'
import type { Profile } from '$lib/schemas'

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

// Mirrors FLOW_PERIODS_PER_YEAR in plan-projection.ts (Decimal-based, not exported)
const PERIODS_PER_YEAR: Record<string, number> = {
  weekly: 365.25 / 7,
  monthly: 12,
  yearly: 1,
}

export function getAnnualExpensesTotal(profile: Profile): number {
  // ponytail: sums all expenses regardless of start/end windows; filter to
  // currently-active flows if future-dated expenses become common
  return (profile.expenses ?? []).reduce(
    (sum, e) => sum + e.amount * (PERIODS_PER_YEAR[e.frequency] ?? 1),
    0,
  )
}

export function getAnnualIncomeTotal(profile: Profile): number {
  // ponytail: sums all incomes regardless of start/end windows, mirroring
  // getAnnualExpensesTotal
  return (profile.incomes ?? []).reduce(
    (sum, i) => sum + i.amount * (PERIODS_PER_YEAR[i.frequency] ?? 1),
    0,
  )
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
  const annualize = (amount: number | undefined, frequency: string | undefined) =>
    (amount ?? 0) * (PERIODS_PER_YEAR[frequency ?? 'monthly'] ?? 1)
  return (
    (profile.liabilities ?? []).reduce(
      (sum, l) => sum + annualize(l.installment_amount, l.installment_frequency),
      0,
    ) +
    (profile.tangible_assets ?? [])
      .filter((a) => a.status === 'financed')
      .reduce((sum, a) => sum + annualize(a.installment_amount, a.installment_frequency), 0)
  )
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
