import { resolve } from '$app/paths'

import routes from './routes'

export type FinancialDataRoute =
  | typeof routes.FINANCIAL_DATA
  | typeof routes.FINANCIAL_DATA_CASH
  | typeof routes.FINANCIAL_DATA_INVESTMENTS
  | typeof routes.FINANCIAL_DATA_TANGIBLE_ASSETS
  | typeof routes.FINANCIAL_DATA_LIABILITIES
  | typeof routes.FINANCIAL_DATA_INCOMES
  | typeof routes.FINANCIAL_DATA_EXPENSES

// `resolve()` is declared with per-literal overloads, so passing a union
// breaks type inference. This switch maps each literal back onto its own
// overload so callers can work with a FinancialDataRoute union.
export function resolveFinancialDataRoute(route: FinancialDataRoute): string {
  switch (route) {
    case '/financial-data':
      return resolve('/financial-data')
    case '/financial-data/cash':
      return resolve('/financial-data/cash')
    case '/financial-data/investments':
      return resolve('/financial-data/investments')
    case '/financial-data/tangible-assets':
      return resolve('/financial-data/tangible-assets')
    case '/financial-data/liabilities':
      return resolve('/financial-data/liabilities')
    case '/financial-data/incomes':
      return resolve('/financial-data/incomes')
    case '/financial-data/expenses':
      return resolve('/financial-data/expenses')
  }
}
