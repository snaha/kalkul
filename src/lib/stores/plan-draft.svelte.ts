import { SvelteSet } from 'svelte/reactivity'

import type { PlanEndType, PlanStartType, Profile } from '$lib/schemas'
import { DEFAULT_CURRENCY } from '$lib/utils'

/**
 * Shared reactive draft for the multi-step add-plan flow.
 *
 * The `(add-plan)` layout stays mounted across the intro/details/data steps, so
 * holding the draft in this module-level store preserves every form entry as the
 * user navigates back and forth — no sessionStorage round-trip needed. The layout
 * calls `reset()` when the flow is entered, so each fresh "Add plan" starts clean
 * while in-flow navigation keeps the user's input.
 */
class PlanDraftStore {
  // --- Details step ---
  name = $state('')
  notes = $state('')
  startType = $state<PlanStartType>('now')
  startYear = $state(String(new Date().getFullYear()))
  startMonth = $state(String(new Date().getMonth()))
  endType = $state<PlanEndType>('when_age_is')
  endAge = $state<number | undefined>(85)
  endYear = $state('')
  endMonth = $state('')
  currency = $state(DEFAULT_CURRENCY)
  inflation = $state<number | undefined>(2)

  // --- Data step ---
  includeCash = $state(true)
  includeInvestments = $state(true)
  includeTangibleAssets = $state(true)
  includeLiabilities = $state(true)
  includeIncomes = $state(true)
  includeExpenses = $state(true)
  readonly selectedInvestmentIds = new SvelteSet<string>()
  readonly selectedTangibleAssetIds = new SvelteSet<string>()
  readonly selectedLiabilityIds = new SvelteSet<string>()
  readonly selectedIncomeIds = new SvelteSet<string>()
  readonly selectedExpenseIds = new SvelteSet<string>()

  /** Serialized draft captured at the last reset, used to detect unsaved edits. */
  #baseline = ''

  /** Re-seed the whole draft from the current profile, for a fresh flow entry. */
  reset(profile: Profile, portfolioCount: number): void {
    const now = new Date()
    this.name = `Plan ${portfolioCount + 1}`
    this.notes = ''
    this.startType = 'now'
    this.startYear = String(now.getFullYear())
    this.startMonth = String(now.getMonth())
    this.endType = 'when_age_is'
    this.endAge = 85
    this.endYear = ''
    this.endMonth = ''
    this.currency = profile.currency ?? DEFAULT_CURRENCY
    this.inflation = 2
    this.selectAll(profile)
    this.#baseline = this.#serialize()
  }

  /** Whether the draft has diverged from its freshly-reset defaults. */
  get dirty(): boolean {
    return this.#serialize() !== this.#baseline
  }

  #serialize(): string {
    return JSON.stringify({
      name: this.name,
      notes: this.notes,
      startType: this.startType,
      startYear: this.startYear,
      startMonth: this.startMonth,
      endType: this.endType,
      endAge: this.endAge,
      endYear: this.endYear,
      endMonth: this.endMonth,
      currency: this.currency,
      inflation: this.inflation,
      includeCash: this.includeCash,
      includeInvestments: this.includeInvestments,
      includeTangibleAssets: this.includeTangibleAssets,
      includeLiabilities: this.includeLiabilities,
      includeIncomes: this.includeIncomes,
      includeExpenses: this.includeExpenses,
      selectedInvestmentIds: [...this.selectedInvestmentIds].sort(),
      selectedTangibleAssetIds: [...this.selectedTangibleAssetIds].sort(),
      selectedLiabilityIds: [...this.selectedLiabilityIds].sort(),
      selectedIncomeIds: [...this.selectedIncomeIds].sort(),
      selectedExpenseIds: [...this.selectedExpenseIds].sort(),
    })
  }

  /** Include every category and select every item. */
  selectAll(profile: Profile): void {
    this.includeCash = true
    this.includeInvestments = true
    this.includeTangibleAssets = true
    this.includeLiabilities = true
    this.includeIncomes = true
    this.includeExpenses = true
    reseed(
      this.selectedInvestmentIds,
      (profile.investments ?? []).map((i) => i.id),
    )
    reseed(
      this.selectedTangibleAssetIds,
      (profile.tangible_assets ?? []).map((a) => a.id),
    )
    reseed(
      this.selectedLiabilityIds,
      (profile.liabilities ?? []).map((l) => l.id),
    )
    reseed(
      this.selectedIncomeIds,
      (profile.incomes ?? []).map((i) => i.id),
    )
    reseed(
      this.selectedExpenseIds,
      (profile.expenses ?? []).map((e) => e.id),
    )
  }

  /** Exclude every category and clear all item selections. */
  deselectAll(): void {
    this.includeCash = false
    this.includeInvestments = false
    this.includeTangibleAssets = false
    this.includeLiabilities = false
    this.includeIncomes = false
    this.includeExpenses = false
    this.selectedInvestmentIds.clear()
    this.selectedTangibleAssetIds.clear()
    this.selectedLiabilityIds.clear()
    this.selectedIncomeIds.clear()
    this.selectedExpenseIds.clear()
  }
}

/** Re-seed a SvelteSet in place from an array of ids. */
function reseed(set: SvelteSet<string>, ids: string[]): void {
  set.clear()
  for (const id of ids) set.add(id)
}

export const planDraftStore = new PlanDraftStore()
