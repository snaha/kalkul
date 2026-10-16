import { type Portfolio, portfolioSchema } from '$lib/schemas'

type AppParent = {
  persist(): void
  deletePortfolio(id: string): void
}

export type PortfolioStore = Portfolio & {
  update(updates: Partial<Omit<Portfolio, 'id'>>): void
  delete(): void
  toJSON(): Portfolio
}

const PORTFOLIO_KEYS = Object.keys(portfolioSchema.shape) as (keyof Portfolio)[]

export function withPortfolioStore(portfolio: Portfolio, app: AppParent): PortfolioStore {
  const data = $state<Portfolio>({ ...portfolio })
  const store = {
    /** The validation gate for a plan, as `updateProfile` is for financial data: an update the schema rejects throws and nothing is written. */
    update(updates: Partial<Omit<Portfolio, 'id'>>) {
      portfolioSchema.parse({ ...$state.snapshot(data), ...updates })
      Object.assign(data, updates)
      app.persist()
    },
    delete() {
      app.deletePortfolio(data.id)
    },
    /** The stored shape: a field set to undefined is left out. */
    toJSON(): Portfolio {
      return Object.fromEntries(
        Object.entries($state.snapshot(data)).filter(([, v]) => v !== undefined),
      ) as Portfolio
    },
  }
  // One reactive accessor per schema field, so a new field never needs a new getter here.
  for (const key of PORTFOLIO_KEYS) {
    Object.defineProperty(store, key, {
      enumerable: true,
      get: () => data[key],
      set: (v: unknown) => {
        ;(data as Record<string, unknown>)[key] = v
      },
    })
  }
  return store as PortfolioStore
}
