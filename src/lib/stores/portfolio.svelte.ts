import type { SvelteSet } from 'svelte/reactivity'

import type { Transfer } from '$lib/schemas'
import type { Investment, InvestmentNested, Portfolio, PortfolioNested } from '$lib/types'

import type { InvestmentStore } from './investment.svelte'
import { withInvestmentStore } from './investment.svelte'

type AppParent = {
  persist(): void
  deletePortfolio(id: string): void
  duplicatePortfolio(newPortfolio: PortfolioNested): string | undefined
  hiddenIds: SvelteSet<string>
}

export type PortfolioStore = Omit<PortfolioNested, 'investments' | 'goals'> & {
  investments: InvestmentStore[]
  goals: InvestmentStore[]
  update(updates: Partial<Omit<Portfolio, 'id'>>): void
  delete(): void
  duplicate(): string | undefined
  addInvestment(data: Omit<Investment, 'id'>): string
  addGoal(data: Omit<Investment, 'id'>): string
  removeChild(id: string): void
  duplicateChild(newInv: InvestmentNested): string | undefined
  getSiblingsOf(id: string): InvestmentStore[]
  persist(): void
  hiddenIds: SvelteSet<string>
  toJSON(): PortfolioNested
}

export function withPortfolioStore(portfolio: PortfolioNested, app: AppParent): PortfolioStore {
  let id = $state(portfolio.id)
  let name = $state(portfolio.name)
  let currency = $state(portfolio.currency)
  let start_date = $state(portfolio.start_date)
  let end_date = $state(portfolio.end_date)
  let inflation_rate = $state(portfolio.inflation_rate)
  let include_cash = $state<boolean | undefined>(portfolio.include_cash)
  let included_investment_ids = $state<string[] | undefined>(portfolio.included_investment_ids)
  let included_tangible_asset_ids = $state<string[] | undefined>(
    portfolio.included_tangible_asset_ids,
  )
  let included_liability_ids = $state<string[] | undefined>(portfolio.included_liability_ids)
  let included_income_ids = $state<string[] | undefined>(portfolio.included_income_ids)
  let included_expense_ids = $state<string[] | undefined>(portfolio.included_expense_ids)
  let transfers = $state<Transfer[]>(portfolio.transfers ?? [])
  let included_transfer_ids = $state<string[] | undefined>(portfolio.included_transfer_ids)
  let investments = $state<InvestmentStore[]>([])
  let goals = $state<InvestmentStore[]>([])

  const store: PortfolioStore = {
    get id() {
      return id
    },
    set id(v) {
      id = v
    },
    get name() {
      return name
    },
    set name(v) {
      name = v
    },
    get currency() {
      return currency
    },
    set currency(v) {
      currency = v
    },
    get start_date() {
      return start_date
    },
    set start_date(v) {
      start_date = v
    },
    get end_date() {
      return end_date
    },
    set end_date(v) {
      end_date = v
    },
    get inflation_rate() {
      return inflation_rate
    },
    set inflation_rate(v) {
      inflation_rate = v
    },
    get include_cash() {
      return include_cash
    },
    set include_cash(v) {
      include_cash = v
    },
    get included_investment_ids() {
      return included_investment_ids
    },
    set included_investment_ids(v) {
      included_investment_ids = v
    },
    get included_tangible_asset_ids() {
      return included_tangible_asset_ids
    },
    set included_tangible_asset_ids(v) {
      included_tangible_asset_ids = v
    },
    get included_liability_ids() {
      return included_liability_ids
    },
    set included_liability_ids(v) {
      included_liability_ids = v
    },
    get included_income_ids() {
      return included_income_ids
    },
    set included_income_ids(v) {
      included_income_ids = v
    },
    get included_expense_ids() {
      return included_expense_ids
    },
    set included_expense_ids(v) {
      included_expense_ids = v
    },
    get transfers() {
      return transfers
    },
    set transfers(v) {
      transfers = v
    },
    get included_transfer_ids() {
      return included_transfer_ids
    },
    set included_transfer_ids(v) {
      included_transfer_ids = v
    },
    get investments() {
      return investments
    },
    set investments(v) {
      investments = v
    },
    get goals() {
      return goals
    },
    set goals(v) {
      goals = v
    },

    get hiddenIds() {
      return app.hiddenIds
    },

    update(updates: Partial<Omit<Portfolio, 'id'>>) {
      Object.assign(this, updates)
      app.persist()
    },

    delete() {
      app.deletePortfolio(id)
    },

    duplicate(): string | undefined {
      function deepCopyInvestments(invs: InvestmentNested[]) {
        return invs.map((inv) => ({
          ...inv,
          id: crypto.randomUUID(),
          transactions: inv.transactions.map((t) => ({ ...t, id: crypto.randomUUID() })),
        }))
      }

      const { investments: invs, goals: gs, ...rest } = this.toJSON()
      const newPortfolio: PortfolioNested = {
        ...rest,
        id: crypto.randomUUID(),
        name: name + ' - Copy',
        investments: deepCopyInvestments(invs),
        goals: deepCopyInvestments(gs),
      }
      return app.duplicatePortfolio(newPortfolio)
    },

    addInvestment(data: Omit<Investment, 'id'>) {
      const invId = crypto.randomUUID()
      const newInvestment: InvestmentNested = {
        ...data,
        id: invId,
        transactions: [],
      }
      const enrichedInv = withInvestmentStore(newInvestment, this)
      investments.push(enrichedInv)
      app.persist()
      return invId
    },

    addGoal(data: Omit<Investment, 'id'>) {
      const goalId = crypto.randomUUID()
      const newGoal: InvestmentNested = {
        ...data,
        id: goalId,
        transactions: [],
      }
      const enrichedGoal = withInvestmentStore(newGoal, this)
      goals.push(enrichedGoal)
      app.persist()
      return goalId
    },

    removeChild(childId: string) {
      let idx = investments.findIndex((i) => i.id === childId)
      if (idx !== -1) {
        investments.splice(idx, 1)
        app.persist()
        return
      }
      idx = goals.findIndex((i) => i.id === childId)
      if (idx !== -1) {
        goals.splice(idx, 1)
        app.persist()
      }
    },

    duplicateChild(newInv: InvestmentNested): string | undefined {
      const isGoal = newInv.goal_data !== undefined
      const enrichedInv = withInvestmentStore(newInv, this)
      if (isGoal) {
        goals.push(enrichedInv)
      } else {
        investments.push(enrichedInv)
      }
      app.persist()
      return newInv.id
    },

    getSiblingsOf(childId: string): InvestmentStore[] {
      if (investments.some((i) => i.id === childId)) return investments
      if (goals.some((i) => i.id === childId)) return goals
      return []
    },

    persist() {
      app.persist()
    },

    toJSON(): PortfolioNested {
      return {
        id,
        name,
        currency,
        start_date,
        end_date,
        inflation_rate,
        ...(include_cash !== undefined ? { include_cash } : {}),
        ...(included_investment_ids !== undefined ? { included_investment_ids } : {}),
        ...(included_tangible_asset_ids !== undefined ? { included_tangible_asset_ids } : {}),
        ...(included_liability_ids !== undefined ? { included_liability_ids } : {}),
        ...(included_income_ids !== undefined ? { included_income_ids } : {}),
        ...(included_expense_ids !== undefined ? { included_expense_ids } : {}),
        ...(transfers.length > 0 ? { transfers } : {}),
        ...(included_transfer_ids !== undefined ? { included_transfer_ids } : {}),
        investments: investments.map((i) => i.toJSON()),
        goals: goals.map((g) => g.toJSON()),
      }
    },
  }

  // Enrich child investments and goals
  investments = portfolio.investments.map((inv) => withInvestmentStore(inv, store))
  goals = portfolio.goals.map((g) => withInvestmentStore(g, store))

  return store
}
