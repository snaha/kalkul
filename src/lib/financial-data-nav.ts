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
  | typeof routes.FINANCIAL_DATA_TRANSFERS

// `resolve()` is declared with per-literal overloads, so passing a union
// breaks type inference. This switch maps each literal back onto its own
// overload so callers can work with a FinancialDataRoute union.
export function resolveFinancialDataRoute(route: FinancialDataRoute): string {
  switch (route) {
    case routes.FINANCIAL_DATA:
      return resolve(routes.FINANCIAL_DATA)
    case routes.FINANCIAL_DATA_CASH:
      return resolve(routes.FINANCIAL_DATA_CASH)
    case routes.FINANCIAL_DATA_INVESTMENTS:
      return resolve(routes.FINANCIAL_DATA_INVESTMENTS)
    case routes.FINANCIAL_DATA_TANGIBLE_ASSETS:
      return resolve(routes.FINANCIAL_DATA_TANGIBLE_ASSETS)
    case routes.FINANCIAL_DATA_LIABILITIES:
      return resolve(routes.FINANCIAL_DATA_LIABILITIES)
    case routes.FINANCIAL_DATA_INCOMES:
      return resolve(routes.FINANCIAL_DATA_INCOMES)
    case routes.FINANCIAL_DATA_EXPENSES:
      return resolve(routes.FINANCIAL_DATA_EXPENSES)
    case routes.FINANCIAL_DATA_TRANSFERS:
      return resolve(routes.FINANCIAL_DATA_TRANSFERS)
  }
}
