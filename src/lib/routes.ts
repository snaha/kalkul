import { base } from '$app/paths'

const ROUTER = import.meta.env.VITE_ROUTER

const routePrefix = `${base}${ROUTER === 'hash' ? '/#' : ''}`

export default {
  HOME: `${routePrefix}/`,
  SETUP: `${routePrefix}/setup`,
  SETUP_FINANCES: `${routePrefix}/setup/finances`,
  SETUP_INCOME: `${routePrefix}/setup/income`,
  SETUP_EXPENSES: `${routePrefix}/setup/expenses`,
  SETTINGS: `${routePrefix}/settings`,
  FINANCES: `${routePrefix}/finances`,
  FINANCES_CASH: `${routePrefix}/finances/cash`,
  FINANCES_INVESTMENTS: `${routePrefix}/finances/investments`,
  FINANCES_TANGIBLE_ASSETS: `${routePrefix}/finances/tangible-assets`,
  FINANCES_LIABILITIES: `${routePrefix}/finances/liabilities`,
  FINANCES_INCOMES: `${routePrefix}/finances/incomes`,
  FINANCES_EXPENSES: `${routePrefix}/finances/expenses`,
  SNAPSHOT_NEW: `${routePrefix}/snapshot/new`,
  SNAPSHOT_EDIT: (id: string) => `${routePrefix}/snapshot/${id}/edit`,
  PLAN: (planId: string) => `${routePrefix}/plan/${planId}`,
}
