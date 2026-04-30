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

export function getLiabilitiesTotal(profile: Profile): number {
  return (profile.liabilities ?? []).reduce((sum, l) => sum + l.outstanding_balance, 0)
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

export function hasAnyFinancialData(profile: Profile): boolean {
  if ((profile.cash_amount ?? 0) > 0) return true
  if ((profile.investments ?? []).some((i) => i.balance > 0)) return true
  if ((profile.tangible_assets ?? []).some((a) => a.value > 0)) return true
  if ((profile.liabilities ?? []).some((l) => l.outstanding_balance > 0)) return true
  return false
}
