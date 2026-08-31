export default {
  HOME: '/',
  PROFILE: '/profile',
  FINANCES_EDIT: '/finances/edit',
  FINANCES_EDIT_INVESTMENTS: '/finances/edit/investments',
  FINANCES_EDIT_TANGIBLE_ASSETS: '/finances/edit/tangible-assets',
  FINANCES_EDIT_LIABILITIES: '/finances/edit/liabilities',
  FINANCES_EDIT_INCOME: '/finances/edit/income',
  FINANCES_EDIT_EXPENSES: '/finances/edit/expenses',
  FINANCES_EDIT_TRANSFERS: '/finances/edit/transfers',
  FINANCIAL_DATA: '/financial-data',
  FINANCIAL_DATA_CASH: '/financial-data/cash',
  FINANCIAL_DATA_INVESTMENTS: '/financial-data/investments',
  FINANCIAL_DATA_TANGIBLE_ASSETS: '/financial-data/tangible-assets',
  FINANCIAL_DATA_LIABILITIES: '/financial-data/liabilities',
  FINANCIAL_DATA_INCOMES: '/financial-data/incomes',
  FINANCIAL_DATA_EXPENSES: '/financial-data/expenses',
  FINANCIAL_DATA_TRANSFERS: '/financial-data/transfers',
  PLAN_VIEW: '/plan',
  DEV: '/dev',
} as const

/**
 * Convert a SvelteKit route id (e.g. `/(app)/financial-data/cash`) into the
 * matching route constant path (`/financial-data/cash`) by dropping
 * layout-group segments. Unlike `page.url.pathname`, the route id is
 * unaffected by the configured base path and by the hash router used on PR
 * previews, so comparisons against the constants above work on every
 * deployment target.
 */
export function routeFromId(routeId: string | null | undefined): string {
  if (!routeId) return ''
  const path = routeId.replaceAll(/\/\([^)]+\)/g, '')
  return path === '' ? '/' : path
}
