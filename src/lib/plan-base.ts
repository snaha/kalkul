import type { PlanData, Portfolio, Profile } from '$lib/schemas'

/**
 * A copy of what the user has today: what a new plan starts from and what it
 * keeps as its `base`. A deep copy, so the plan never shares an object with
 * financial data (JSON-safe by construction: the data is schema-validated).
 */
export function snapshotFinancialData(profile: Profile): PlanData {
  const data: PlanData = {
    cash_amount: profile.cash_amount ?? 0,
    investments: profile.investments ?? [],
    tangible_assets: profile.tangible_assets ?? [],
    liabilities: profile.liabilities ?? [],
    incomes: profile.incomes ?? [],
    expenses: profile.expenses ?? [],
    transfers: profile.transfers ?? [],
  }
  return JSON.parse(JSON.stringify(data)) as PlanData
}

/** Nothing: what a plan started from scratch holds. */
export function emptyPlanData(): PlanData {
  return snapshotFinancialData({ name: '', email: '' })
}

/**
 * Financial data has changed since the plan was created, so the plan no longer
 * starts from what the user has today. Bringing it up to date is a planned
 * feature; for now the plan page says so.
 */
export function isPlanOutdated(plan: Portfolio, profile: Profile): boolean {
  return !deepEqual(plan.base, snapshotFinancialData(profile))
}

// ponytail: key-order-insensitive structural equality for JSON-shaped values;
// enough for schema-validated data, no need for a library.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => deepEqual(v, b[i]))
    )
  }
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)])
  return [...keys].every((k) => deepEqual(ra[k], rb[k]))
}
