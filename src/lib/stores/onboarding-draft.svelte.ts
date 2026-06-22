import type {
  Expense,
  Frequency,
  Income,
  ProfileInvestment,
  ProfileLiability,
  ProfileTangibleAsset,
  TangibleAssetStatus,
} from '$lib/schemas'
import { stableStringify } from '$lib/utils'

import { appStore } from './app.svelte'

/** UI-shaped rows: the persisted data plus transient editing flags. */
export type IncomeUI = Omit<Income, 'amount'> & {
  amount: number | undefined
  showAdvanced: boolean
  editing: boolean
  editingName: boolean
}

export type ExpenseUI = Omit<Expense, 'amount'> & {
  amount: number | undefined
  showAdvanced: boolean
  editing: boolean
  editingName: boolean
}

export interface InvestmentUI {
  id: string
  name: string
  balance: number | undefined
  apy: number | undefined
  editing: boolean
  editingName: boolean
}

export interface LiabilityUI {
  id: string
  name: string
  outstanding_balance: number | undefined
  installment_frequency: Frequency
  annual_rate: number | undefined
  installment_amount: number | undefined
  remaining_term: number | undefined
  editing: boolean
  editingName: boolean
}

export interface AssetUI {
  id: string
  name: string
  value: number | undefined
  status: TangibleAssetStatus
  outstanding_balance: number | undefined
  installment_frequency: Frequency
  annual_rate: number | undefined
  installment_amount: number | undefined
  remaining_term: number | undefined
  editing: boolean
  editingName: boolean
}

/**
 * Shared reactive draft for the multi-step onboarding flow.
 *
 * The `(onboarding)` layout stays mounted across all steps, so holding the
 * in-progress form state here preserves it across the wizard's `goto()`-based
 * Back/Continue navigation (SvelteKit snapshots only restore on browser
 * back/forward, not `goto()`). The layout seeds a fresh draft from the profile
 * on entry; each step commits its slice to `appStore` on Continue. Mirrors the
 * add-plan `planDraftStore` pattern.
 */
class OnboardingDraftStore {
  // --- Profile step ---
  name = $state('')
  birthYear = $state('')
  birthMonth = $state('')
  location = $state('')
  currency = $state('')
  userChangedCurrency = $state(false)

  // --- Finances overview step ---
  cashAmount = $state<number | undefined>(undefined)
  hasInvestments = $state(false)
  hasTangibleAssets = $state(false)
  hasLiabilities = $state(false)

  // --- Category steps ---
  incomes = $state<IncomeUI[]>([])
  incomeCounter = $state(0)
  expenses = $state<ExpenseUI[]>([])
  expenseCounter = $state(0)
  investments = $state<InvestmentUI[]>([])
  investmentCounter = $state(0)
  liabilities = $state<LiabilityUI[]>([])
  liabilityCounter = $state(0)
  assets = $state<AssetUI[]>([])
  assetCounter = $state(0)

  /** Re-seed the whole draft from the current profile, for a fresh flow entry. */
  reset(): void {
    const p = appStore.profile
    this.name = p.name
    const birthDate = p.birthDate
    this.birthYear = birthDate ? String(birthDate.getFullYear()) : ''
    this.birthMonth = birthDate ? String(birthDate.getMonth()) : ''
    this.location = p.location ?? ''
    this.currency = p.currency ?? ''
    this.userChangedCurrency = false

    this.cashAmount = p.cash_amount
    this.hasInvestments = p.has_investments ?? false
    this.hasTangibleAssets = p.has_tangible_assets ?? false
    this.hasLiabilities = p.has_liabilities ?? false

    this.incomes = incomesToUI(p.incomes ?? [])
    this.incomeCounter = this.incomes.length
    this.expenses = expensesToUI(p.expenses ?? [])
    this.expenseCounter = this.expenses.length
    this.investments = investmentsToUI(p.investments ?? [])
    this.investmentCounter = this.investments.length
    this.liabilities = liabilitiesToUI(p.liabilities ?? [])
    this.liabilityCounter = this.liabilities.length
    this.assets = assetsToUI(p.tangible_assets ?? [])
    this.assetCounter = this.assets.length
  }

  // --- Build committable data from the current UI rows ---
  buildIncomes(): Income[] {
    return this.incomes
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount ?? 0,
        frequency: i.frequency,
        withhold_taxes: i.withhold_taxes,
        tax_percentage: i.tax_percentage,
        start: i.start,
        start_year: i.start === 'at_specific_date' ? i.start_year : undefined,
        start_month: i.start === 'at_specific_date' ? i.start_month : undefined,
        start_age: i.start === 'when_age_is' ? i.start_age : undefined,
        end: i.end,
        end_year: i.end === 'at_specific_date' ? i.end_year : undefined,
        end_month: i.end === 'at_specific_date' ? i.end_month : undefined,
        end_age: i.end === 'when_age_is' ? i.end_age : undefined,
        change_over_time: i.change_over_time,
        change_percentage:
          i.change_over_time === 'increase_yearly' || i.change_over_time === 'decrease_yearly'
            ? (i.change_percentage ?? 0)
            : undefined,
      }))
  }

  buildExpenses(): Expense[] {
    return this.expenses
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount ?? 0,
        frequency: e.frequency,
        start: e.start,
        start_year: e.start === 'at_specific_date' ? e.start_year : undefined,
        start_month: e.start === 'at_specific_date' ? e.start_month : undefined,
        start_age: e.start === 'when_age_is' ? e.start_age : undefined,
        end: e.end,
        end_year: e.end === 'at_specific_date' ? e.end_year : undefined,
        end_month: e.end === 'at_specific_date' ? e.end_month : undefined,
        end_age: e.end === 'when_age_is' ? e.end_age : undefined,
        change_over_time: e.change_over_time,
        change_percentage:
          e.change_over_time === 'increase_yearly' || e.change_over_time === 'decrease_yearly'
            ? (e.change_percentage ?? 0)
            : undefined,
      }))
  }

  buildInvestments(): ProfileInvestment[] {
    return this.investments
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({ id: i.id, name: i.name, balance: i.balance ?? 0, apy: i.apy ?? 0 }))
  }

  buildLiabilities(): ProfileLiability[] {
    return this.liabilities
      .filter((l) => l.name.trim().length > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        outstanding_balance: l.outstanding_balance ?? 0,
        installment_frequency: l.installment_frequency,
        annual_rate: l.annual_rate ?? 0,
        installment_amount: l.installment_amount ?? 0,
        remaining_term: l.remaining_term ?? 0,
      }))
  }

  buildAssets(): ProfileTangibleAsset[] {
    return this.assets
      .filter((a) => a.name.trim().length > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        value: a.value ?? 0,
        status: a.status,
        outstanding_balance: a.status === 'financed' ? (a.outstanding_balance ?? 0) : undefined,
        installment_frequency: a.status === 'financed' ? a.installment_frequency : undefined,
        annual_rate: a.status === 'financed' ? (a.annual_rate ?? 0) : undefined,
        installment_amount: a.status === 'financed' ? (a.installment_amount ?? 0) : undefined,
        remaining_term: a.status === 'financed' ? (a.remaining_term ?? 0) : undefined,
      }))
  }

  // --- Commit a step's slice to the profile (called on Continue) ---
  commitProfile(): void {
    const updates: Record<string, string | undefined> = {
      name: this.name.trim(),
      location: this.location || undefined,
      currency: this.currency || undefined,
    }
    if (this.birthYear !== '' && this.birthMonth !== '') {
      const date = new Date(Number(this.birthYear), Number(this.birthMonth), 1)
      updates.birth_date = date.toISOString().split('T')[0]
    }
    appStore.updateProfile(updates)
  }

  commitOverview(): void {
    appStore.updateProfile({
      cash_amount: this.cashAmount,
      has_investments: this.hasInvestments,
      has_tangible_assets: this.hasTangibleAssets,
      has_liabilities: this.hasLiabilities,
    })
  }

  commitIncomes(): void {
    appStore.updateProfile({ incomes: this.buildIncomes() })
  }

  commitExpenses(): void {
    appStore.updateProfile({ expenses: this.buildExpenses() })
  }

  commitInvestments(): void {
    const data = this.buildInvestments()
    appStore.updateProfile({ investments: data, has_investments: data.length > 0 })
  }

  commitLiabilities(): void {
    const data = this.buildLiabilities()
    appStore.updateProfile({ liabilities: data, has_liabilities: data.length > 0 })
  }

  commitAssets(): void {
    const data = this.buildAssets()
    appStore.updateProfile({ tangible_assets: data, has_tangible_assets: data.length > 0 })
  }

  /** Whether any step's draft has diverged from what's committed to the profile. */
  get dirty(): boolean {
    const p = appStore.profile
    const builtBirth =
      this.birthYear !== '' && this.birthMonth !== ''
        ? new Date(Number(this.birthYear), Number(this.birthMonth), 1).toISOString().split('T')[0]
        : undefined
    return (
      this.name.trim() !== p.name ||
      (this.location || undefined) !== p.location ||
      (this.currency || undefined) !== p.currency ||
      builtBirth !== p.birth_date ||
      this.cashAmount !== p.cash_amount ||
      this.hasInvestments !== (p.has_investments ?? false) ||
      this.hasTangibleAssets !== (p.has_tangible_assets ?? false) ||
      this.hasLiabilities !== (p.has_liabilities ?? false) ||
      stableStringify(this.buildIncomes()) !== stableStringify(p.incomes ?? []) ||
      stableStringify(this.buildExpenses()) !== stableStringify(p.expenses ?? []) ||
      stableStringify(this.buildInvestments()) !== stableStringify(p.investments ?? []) ||
      stableStringify(this.buildLiabilities()) !== stableStringify(p.liabilities ?? []) ||
      stableStringify(this.buildAssets()) !== stableStringify(p.tangible_assets ?? [])
    )
  }
}

function incomesToUI(stored: Income[]): IncomeUI[] {
  return stored.map((inc) => ({
    ...inc,
    amount: inc.amount > 0 ? inc.amount : undefined,
    showAdvanced: false,
    editing: false,
    editingName: false,
  }))
}

function expensesToUI(stored: Expense[]): ExpenseUI[] {
  return stored.map((exp) => ({
    ...exp,
    amount: exp.amount > 0 ? exp.amount : undefined,
    showAdvanced: false,
    editing: false,
    editingName: false,
  }))
}

function investmentsToUI(stored: ProfileInvestment[]): InvestmentUI[] {
  return stored.map((inv) => ({
    id: inv.id,
    name: inv.name,
    balance: inv.balance > 0 ? inv.balance : undefined,
    apy: inv.apy > 0 ? inv.apy : undefined,
    editing: false,
    editingName: false,
  }))
}

function liabilitiesToUI(stored: ProfileLiability[]): LiabilityUI[] {
  return stored.map((l) => ({
    id: l.id,
    name: l.name,
    outstanding_balance: l.outstanding_balance > 0 ? l.outstanding_balance : undefined,
    installment_frequency: l.installment_frequency,
    annual_rate: l.annual_rate > 0 ? l.annual_rate : undefined,
    installment_amount: l.installment_amount > 0 ? l.installment_amount : undefined,
    remaining_term: l.remaining_term > 0 ? l.remaining_term : undefined,
    editing: false,
    editingName: false,
  }))
}

function assetsToUI(stored: ProfileTangibleAsset[]): AssetUI[] {
  return stored.map((a) => ({
    id: a.id,
    name: a.name,
    value: a.value > 0 ? a.value : undefined,
    status: a.status,
    outstanding_balance:
      a.outstanding_balance !== undefined && a.outstanding_balance > 0
        ? a.outstanding_balance
        : undefined,
    installment_frequency: a.installment_frequency ?? 'monthly',
    annual_rate: a.annual_rate !== undefined && a.annual_rate > 0 ? a.annual_rate : undefined,
    installment_amount:
      a.installment_amount !== undefined && a.installment_amount > 0
        ? a.installment_amount
        : undefined,
    remaining_term:
      a.remaining_term !== undefined && a.remaining_term > 0 ? a.remaining_term : undefined,
    editing: false,
    editingName: false,
  }))
}

export const onboardingDraft = new OnboardingDraftStore()
