/**
 * Plan ownership. An item created inside a plan carries that plan's id: it is
 * a scenario, not current data, so financial data and other plans never list
 * it. An item with no owner is current data shared by every plan.
 */
export interface PlanOwned {
  plan_id?: string
}

/** The items some plan owns: what financial data must carry through a save untouched. */
export function planOwnedItems<T extends PlanOwned>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => item.plan_id !== undefined)
}

/** Current data only: the items no plan owns. */
export function sharedItems<T extends PlanOwned>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => item.plan_id === undefined)
}

/**
 * What a plan can see: the shared items plus its own. Another plan's never
 * take part. An undefined plan id (route still resolving) lists shared only.
 */
export function itemsForPlan<T extends PlanOwned>(
  items: T[] | undefined,
  planId: string | undefined,
): T[] {
  return (items ?? []).filter((item) => item.plan_id === undefined || item.plan_id === planId)
}
