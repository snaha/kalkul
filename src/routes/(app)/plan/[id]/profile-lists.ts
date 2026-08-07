import type { Portfolio, Profile } from '$lib/schemas'
import { appStore } from '$lib/stores/app.svelte'
import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

/**
 * One config per profile financial list, shared by the plan edit dialogs.
 * The find-index/upsert/filter/updateProfile-with-flag/append-to-included-ids
 * algorithm used to be copy-pasted per kind inside each dialog method; these
 * helpers hold it once.
 */

export type ProfileListKey =
  | 'investments'
  | 'tangible_assets'
  | 'liabilities'
  | 'incomes'
  | 'expenses'

export type ProfileListItem<K extends ProfileListKey> = NonNullable<Profile[K]>[number]

export interface ProfileListConfig<K extends ProfileListKey = ProfileListKey> {
  key: K
  /** Onboarding has_* flag kept in sync for asset lists; cash flows have none. */
  hasKey?: 'has_investments' | 'has_tangible_assets' | 'has_liabilities'
  /** The plan's include list for this kind (undefined on the plan = all included). */
  includedKey:
    | 'included_investment_ids'
    | 'included_tangible_asset_ids'
    | 'included_liability_ids'
    | 'included_income_ids'
    | 'included_expense_ids'
}

export const PROFILE_LISTS = {
  investment: {
    key: 'investments',
    hasKey: 'has_investments',
    includedKey: 'included_investment_ids',
  },
  tangibleAsset: {
    key: 'tangible_assets',
    hasKey: 'has_tangible_assets',
    includedKey: 'included_tangible_asset_ids',
  },
  liability: {
    key: 'liabilities',
    hasKey: 'has_liabilities',
    includedKey: 'included_liability_ids',
  },
  income: { key: 'incomes', includedKey: 'included_income_ids' },
  expense: { key: 'expenses', includedKey: 'included_expense_ids' },
} as const satisfies Record<string, ProfileListConfig>

function listItems<K extends ProfileListKey>(config: ProfileListConfig<K>): ProfileListItem<K>[] {
  return (appStore.profile[config.key] ?? []) as ProfileListItem<K>[]
}

function persistList<K extends ProfileListKey>(
  config: ProfileListConfig<K>,
  next: ProfileListItem<K>[],
): void {
  // Computed keys widen to an index signature, so the assembled update is
  // asserted back to Partial<Profile>; updateProfile validates it with Zod.
  const update = { [config.key]: next } as Partial<Profile>
  if (config.hasKey) update[config.hasKey] = next.length > 0
  appStore.updateProfile(update)
}

/**
 * Insert or replace the item by id. Newly created items are appended to the
 * plan's include list when one exists, so they are visible in this plan by
 * default (an undefined include list already means "all included").
 */
export function upsertProfileItem<K extends ProfileListKey>(
  config: ProfileListConfig<K>,
  item: ProfileListItem<K>,
  plan: PortfolioStore,
): void {
  const existing = listItems(config)
  const idx = existing.findIndex((it) => it.id === item.id)
  const next = idx === -1 ? [...existing, item] : existing.map((it, i) => (i === idx ? item : it))
  persistList(config, next)
  if (idx === -1) {
    const included = plan[config.includedKey]
    if (included !== undefined) {
      plan.update({ [config.includedKey]: [...included, item.id] } as Partial<
        Omit<Portfolio, 'id'>
      >)
    }
  }
}

/**
 * Insert a renamed copy right after the original. Like upsertProfileItem, the
 * copy joins the plan's include list when one exists — otherwise duplicating
 * inside a plan that excludes anything would produce a copy that is excluded
 * by default, i.e. one that looks like it never got created.
 */
export function duplicateProfileItem(
  config: ProfileListConfig,
  id: string,
  copyName: (name: string) => string,
  plan: PortfolioStore,
): string | undefined {
  const existing = listItems(config)
  const idx = existing.findIndex((it) => it.id === id)
  if (idx === -1) return undefined
  const copy = { ...existing[idx], id: crypto.randomUUID(), name: copyName(existing[idx].name) }
  persistList(config, [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)])
  const included = plan[config.includedKey]
  if (included !== undefined) {
    plan.update({ [config.includedKey]: [...included, copy.id] } as Partial<Omit<Portfolio, 'id'>>)
  }
  return copy.id
}

/** Remove the item from the profile list. */
export function removeProfileItem(config: ProfileListConfig, id: string): void {
  persistList(
    config,
    listItems(config).filter((it) => it.id !== id),
  )
}

/** Whether the plan includes the item (no include list = everything included). */
export function isIncludedInPlan(
  config: ProfileListConfig,
  id: string,
  plan: PortfolioStore,
): boolean {
  const ids = plan[config.includedKey]
  return ids === undefined || ids.includes(id)
}

/**
 * Toggle the item's membership in the plan's include list, seeding the list
 * from "all current items" when the plan doesn't have one yet.
 */
export function toggleIncludedInPlan(
  config: ProfileListConfig,
  id: string,
  plan: PortfolioStore,
): void {
  const seeded = plan[config.includedKey] ?? listItems(config).map((it) => it.id)
  const nextIds = seeded.includes(id) ? seeded.filter((x) => x !== id) : [...seeded, id]
  plan.update({ [config.includedKey]: nextIds } as Partial<Omit<Portfolio, 'id'>>)
}
