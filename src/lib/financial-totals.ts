import Decimal from 'decimal.js'

import { DECIMAL_0 } from '$lib/@snaha/kalkul-maths'
import { CATEGORY_COLORS } from '$lib/chart-colors'
import { annualizedAmount, fiPercentOf } from '$lib/plan-projection'
import {
  DEFAULT_FI_WITHDRAWAL_RATE,
  type Frequency,
  type Profile,
  type ProfileTangibleAsset,
} from '$lib/schemas'
import { countedCashFlows, hasAnyBalance, snapshotBalances, snapshotNetWorth } from '$lib/snapshots'

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
 * Assets less every debt. Delegated to `snapshotNetWorth` over
 * `snapshotBalances` so the live profile and a recorded snapshot are summed by
 * one definition — the History chart plots snapshots next to this figure and
 * the two must agree.
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
 * Yearly living expenses at today's levels, counting every recurring expense
 * regardless of its start/end window. That is the convention the savings
 * rate, FI % and runway are stated in. The dashboard's cash accrual asks a
 * different question ("what is running right now") and uses its own
 * window-aware totals in `current-values.ts`.
 *
 * One-time expenses are skipped: they are events rather than rates, and a
 * car purchase planned for 2030 must not distort a yearly rate (mirrors
 * one-time transfers).
 */
export function getAnnualExpensesTotal(profile: Profile): number {
  return countedCashFlows(profile.expenses)
    .reduce<Decimal>(
      (sum, e) => sum.plus(annualizedAmount(new Decimal(e.amount), e.frequency ?? 'monthly')),
      DECIMAL_0,
    )
    .toNumber()
}

/**
 * Yearly income, annualized through the projection engine's own
 * `annualizedAmount` so the dashboard's savings rate and the Current
 * projection card agree on what the user receives.
 *
 * Window-agnostic like `getAnnualExpensesTotal` — see the note there.
 * One-time incomes are skipped as events rather than rates.
 */
export function getAnnualIncomeTotal(profile: Profile): number {
  return countedCashFlows(profile.incomes)
    .reduce<Decimal>(
      (sum, i) => sum.plus(annualizedAmount(new Decimal(i.amount), i.frequency ?? 'monthly')),
      DECIMAL_0,
    )
    .toNumber()
}

export interface SavingsRate {
  /** Share of income left after expenses and debt service, as a percentage. */
  percent: number
  /** The same figure in currency per year. Negative when outflows exceed income. */
  annualAmount: number
}

/**
 * What share of income survives the year's outflows. Debt service and property
 * tax count as outflows alongside living expenses, as they do for the runway.
 *
 * Undefined when there is no income to take a share of.
 */
export function getSavingsRate(profile: Profile): SavingsRate | undefined {
  const income = getAnnualIncomeTotal(profile)
  if (income <= 0) return undefined
  const annualAmount = new Decimal(income)
    .minus(getAnnualExpensesTotal(profile))
    .minus(getAnnualDebtServiceTotal(profile))
    .minus(getAnnualPropertyTaxTotal(profile))
  return {
    percent: annualAmount.div(income).mul(100).toNumber(),
    annualAmount: annualAmount.toNumber(),
  }
}

// Annualized loan payments (standalone liabilities + financed assets). Debt
// service is a non-optional outflow, so the savings rate counts it alongside
// living expenses. FI % counts only the secured part
// (`getSecuredDebtServiceTotal`).
//
// A loan is only serviced while it still has a balance — the same gate the
// dashboard's cash accrual applies in `current-values.ts`. A paid-off loan whose
// installment was never cleared out would otherwise drain phantom money from
// the savings rate, FI % and runway.
export function getAnnualDebtServiceTotal(profile: Profile): number {
  return (profile.liabilities ?? [])
    .filter((l) => (l.outstanding_balance ?? 0) > 0)
    .reduce<Decimal>(
      (sum, l) => sum.plus(annualizedInstallment(l.installment_amount, l.installment_frequency)),
      DECIMAL_0,
    )
    .plus(getSecuredDebtServiceTotal(profile))
    .toNumber()
}

const annualizedInstallment = (amount: number | undefined, frequency: Frequency | undefined) =>
  annualizedAmount(new Decimal(amount ?? 0), frequency ?? 'monthly')

/** Annualized installments of the loans behind financed assets still owing. */
function getSecuredDebtServiceTotal(profile: Profile): Decimal {
  return (profile.tangible_assets ?? [])
    .filter((a) => a.status === 'financed' && (a.outstanding_balance ?? 0) > 0)
    .reduce<Decimal>(
      (sum, a) => sum.plus(annualizedInstallment(a.installment_amount, a.installment_frequency)),
      DECIMAL_0,
    )
}

/** A year's property tax on one asset, charged on its recorded value. */
export function annualPropertyTaxOf(asset: ProfileTangibleAsset): Decimal {
  return new Decimal(asset.value).mul(asset.property_tax_rate ?? 0).div(100)
}

/** A year's property tax on the tangible assets. */
export function getAnnualPropertyTaxTotal(profile: Profile): number {
  return (profile.tangible_assets ?? [])
    .reduce<Decimal>((sum, a) => sum.plus(annualPropertyTaxOf(a)), DECIMAL_0)
    .toNumber()
}

export function getInvestableNetWorth(profile: Profile): number {
  // Financed-asset debt (e.g. the home mortgage) is excluded along with the
  // asset that secures it — only standalone liabilities reduce investable wealth.
  return (
    getCashTotal(profile) + getInvestmentsTotal(profile) - getStandaloneLiabilitiesTotal(profile)
  )
}

/** Everything the household must pay in a year: expenses plus loan installments. */
/**
 * The yearly outflow level FI % is measured against: recurring expenses,
 * property tax and the installments of loans secured by an asset. A loan not
 * secured by an asset is left out, since its balance already comes off the
 * investable net worth (docs/product/financial-independence.md).
 */
export function getAnnualOutflowsTotal(profile: Profile): number {
  return new Decimal(getAnnualExpensesTotal(profile))
    .plus(getSecuredDebtServiceTotal(profile))
    .plus(getAnnualPropertyTaxTotal(profile))
    .toNumber()
}

/**
 * The Financial independence number: what the portfolio must be worth for a
 * `withdrawalRate` % draw a year to cover the outflows. At the default 4% that
 * is 25 times the outflows.
 */
export function getFiNumber(
  profile: Profile,
  withdrawalRate = profile.fi_withdrawal_rate ?? DEFAULT_FI_WITHDRAWAL_RATE,
): number | undefined {
  const annualOutflows = new Decimal(getAnnualOutflowsTotal(profile))
  if (annualOutflows.lessThanOrEqualTo(0) || withdrawalRate <= 0) return undefined
  return annualOutflows.mul(100).div(withdrawalRate).toNumber()
}

export function getFiPercent(
  profile: Profile,
  withdrawalRate = profile.fi_withdrawal_rate ?? DEFAULT_FI_WITHDRAWAL_RATE,
): number | undefined {
  return fiPercentOf(
    new Decimal(getInvestableNetWorth(profile)),
    new Decimal(getAnnualOutflowsTotal(profile)),
    withdrawalRate,
  )
}

export function hasAnyFinancialData(profile: Profile): boolean {
  return hasAnyBalance(snapshotBalances(profile))
}
