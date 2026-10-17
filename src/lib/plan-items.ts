import { changedFields } from '$lib/changed-fields'
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

/**
 * Save an item a plan dialog edited. `opened` is the item as stored when the
 * dialog opened (undefined for a new item). Only the fields where `edited`
 * differs from it are applied onto the item as stored now, so a change made
 * meanwhile elsewhere (another tab, an MCP tool) to a field the dialog left
 * alone is kept. A field the dialog merely normalises (a legacy term in
 * months shown in years) differs too, so it is written together with the
 * fields that belong to it.
 */
export function saveEditedPlanItem<K extends PlanListKey>(
  key: K,
  edited: PlanListItem<K>,
  opened: PlanListItem<K> | undefined,
  plan: PortfolioStore,
): void {
  const stored = list(plan, key).find((it) => it.id === edited.id)
  const item =
    stored !== undefined && opened !== undefined
      ? { ...stored, ...changedFields(opened, edited) }
      : edited
  upsertPlanItem(key, item, plan)
}
