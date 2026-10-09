import type { Portfolio, Profile } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

/**
 * What a plan changes on top of financial data, and the only way a plan dialog
 * or MCP tool may change it. Financial data (the profile's lists) is read here
 * and never written: every write below goes to `plan.update`.
 *
 * A plan's own list holds two kinds of item. One whose id matches a
 * financial-data item overrides it for this plan; any other id is an item the
 * plan alone has. Deleting an override brings the financial-data item back.
 */

export type PlanListKey =
  | 'investments'
  | 'tangible_assets'
  | 'liabilities'
  | 'incomes'
  | 'expenses'
  | 'transfers'

export type PlanListItem<K extends PlanListKey> = NonNullable<Profile[K]>[number]

export interface PlanListConfig<K extends PlanListKey = PlanListKey> {
  key: K
  /** The plan's include list for this kind (undefined on the plan = all included). */
  includedKey:
    | 'included_investment_ids'
    | 'included_tangible_asset_ids'
    | 'included_liability_ids'
    | 'included_income_ids'
    | 'included_expense_ids'
    | 'included_transfer_ids'
}

export const PLAN_LISTS = {
  investment: { key: 'investments', includedKey: 'included_investment_ids' },
  tangibleAsset: { key: 'tangible_assets', includedKey: 'included_tangible_asset_ids' },
  liability: { key: 'liabilities', includedKey: 'included_liability_ids' },
  income: { key: 'incomes', includedKey: 'included_income_ids' },
  expense: { key: 'expenses', includedKey: 'included_expense_ids' },
  transfer: { key: 'transfers', includedKey: 'included_transfer_ids' },
} as const satisfies Record<string, PlanListConfig>

function list<K extends PlanListKey>(
  owner: Profile | Portfolio | undefined,
  key: K,
): PlanListItem<K>[] {
  return (owner?.[key] ?? []) as PlanListItem<K>[]
}

/**
 * What a plan sees: financial data with the plan's overrides in place, then the
 * items only the plan has. Another plan's items never take part because they
 * live on that plan.
 */
export function planItems<K extends PlanListKey>(
  profile: Profile,
  plan: Portfolio | undefined,
  key: K,
): PlanListItem<K>[] {
  const own = list(plan, key)
  const shared = list(profile, key)
  const sharedIds = new Set(shared.map((it) => it.id))
  return [
    ...shared.map((it) => own.find((o) => o.id === it.id) ?? it),
    ...own.filter((o) => !sharedIds.has(o.id)),
  ]
}

/** Ids of what the plan sees, the seed for an include list the plan has not got yet. */
function visibleIds(config: PlanListConfig, plan: PortfolioStore, profile: Profile): string[] {
  return planItems(profile, plan, config.key).map((it) => it.id)
}

function isShared(config: PlanListConfig, id: string, profile: Profile): boolean {
  return list(profile, config.key).some((it) => it.id === id)
}

/**
 * Save an item edited or created inside a plan. It lands on the plan: a
 * financial-data item edited here becomes an override under the same id, so
 * transfers pointing at it keep working and financial data keeps the original.
 * An item new to the plan joins its include list when one exists, so it is
 * visible here by default (an undefined include list means "all included").
 */
export function upsertPlanItem<K extends PlanListKey>(
  config: PlanListConfig<K>,
  item: PlanListItem<K>,
  plan: PortfolioStore,
  profile: Profile,
): void {
  const own = list(plan, config.key)
  const idx = own.findIndex((it) => it.id === item.id)
  const next = idx === -1 ? [...own, item] : own.map((it, i) => (i === idx ? item : it))
  // Computed keys widen to an index signature, so the update is asserted back.
  const update = { [config.key]: next } as Partial<Omit<Portfolio, 'id'>>
  const included = plan[config.includedKey]
  if (included !== undefined && idx === -1 && !isShared(config, item.id, profile)) {
    update[config.includedKey] = [...included, item.id]
  }
  plan.update(update)
}

/**
 * The plan no longer has the item. A plan item (or override) is dropped from
 * the plan's list; a financial-data item is excluded from the plan. Financial
 * data itself is never touched.
 */
export function removePlanItem(
  config: PlanListConfig,
  id: string,
  plan: PortfolioStore,
  profile: Profile,
): void {
  const own = list(plan, config.key)
  const update: Partial<Omit<Portfolio, 'id'>> = {}
  if (own.some((it) => it.id === id)) {
    Object.assign(update, { [config.key]: own.filter((it) => it.id !== id) })
  }
  const shared = isShared(config, id, profile)
  const included =
    plan[config.includedKey] ?? (shared ? visibleIds(config, plan, profile) : undefined)
  if (included !== undefined) update[config.includedKey] = included.filter((x) => x !== id)
  plan.update(update)
}
