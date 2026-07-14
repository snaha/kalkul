import type { Portfolio, Transfer } from '$lib/schemas'

type AppParent = {
  persist(): void
  deletePortfolio(id: string): void
}

export type PortfolioStore = Portfolio & {
  update(updates: Partial<Omit<Portfolio, 'id'>>): void
  delete(): void
  toJSON(): Portfolio
}

export function withPortfolioStore(portfolio: Portfolio, app: AppParent): PortfolioStore {
  let id = $state(portfolio.id)
  let name = $state(portfolio.name)
  let notes = $state(portfolio.notes)
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

  return {
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
    get notes() {
      return notes
    },
    set notes(v) {
      notes = v
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

    update(updates: Partial<Omit<Portfolio, 'id'>>) {
      Object.assign(this, updates)
      app.persist()
    },

    delete() {
      app.deletePortfolio(id)
    },

    toJSON(): Portfolio {
      return {
        id,
        name,
        ...(notes !== undefined ? { notes } : {}),
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
      }
    },
  }
}
