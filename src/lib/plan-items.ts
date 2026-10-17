import type { PlanListKey, Portfolio } from '$lib/schemas'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

/**
 * The only way a plan dialog or MCP tool changes a plan's items. A plan holds
 * its own copy of everything it projects (`portfolioSchema`), so every write
 * here goes to `plan.update`; financial data is never touched.
 */

export type PlanListItem<K extends PlanListKey> = Portfolio[K][number]

function list<K extends PlanListKey>(plan: Portfolio, key: K): PlanListItem<K>[] {
  return plan[key] as PlanListItem<K>[]
}

/** Save an item edited or created inside a plan: replaced in place by id, else appended. */
export function upsertPlanItem<K extends PlanListKey>(
  key: K,
  item: PlanListItem<K>,
  plan: PortfolioStore,
): void {
  const own = list(plan, key)
  const idx = own.findIndex((it) => it.id === item.id)
  const next = idx === -1 ? [...own, item] : own.map((it, i) => (i === idx ? item : it))
  // Computed keys widen to an index signature, so the update is asserted back.
  plan.update({ [key]: next } as Partial<Omit<Portfolio, 'id'>>)
}

/** The plan no longer has the item. */
export function removePlanItem(key: PlanListKey, id: string, plan: PortfolioStore): void {
  const next = list(plan, key).filter((it) => it.id !== id)
  plan.update({ [key]: next } as Partial<Omit<Portfolio, 'id'>>)
}
