import { base } from '$app/paths'
const ROUTER = import.meta.env.VITE_ROUTER

const routePrefix = `${base}${ROUTER === 'hash' ? '/#' : ''}`

export default {
  HOME: `${routePrefix}/`,
  SETTINGS: `${routePrefix}/settings`,
  EDIT_PROFILE: `${routePrefix}/profile/edit`,
  NEW_PORTFOLIO: `${routePrefix}/portfolio/new`,
  PORTFOLIO: (portfolioId: string) => `${routePrefix}/portfolio/${portfolioId}`,
  EDIT_PORTFOLIO: (portfolioId: string) => `${routePrefix}/portfolio/${portfolioId}/edit`,
  NEW_INVESTMENT: (portfolioId: string) => `${routePrefix}/portfolio/${portfolioId}/new-investment`,
  EDIT_INVESTMENT: (portfolioId: string, investmentId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/edit-investment/${investmentId}`,
  NEW_GOAL: (portfolioId: string) => `${routePrefix}/portfolio/${portfolioId}/goals/new`,
  RETIREMENT_GOAL_CALCULATOR: (portfolioId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/goals/retirement/calculator`,
  RETIREMENT_GOAL_PREVIEW: (portfolioId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/goals/retirement/preview`,
  KID_EDUCATION_GOAL_CALCULATOR: (portfolioId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/goals/kid-education/calculator`,
  KID_EDUCATION_GOAL_PREVIEW: (portfolioId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/goals/kid-education/preview`,
  PDF_EXPORT_PARAMS: (portfolioId: string) =>
    `${routePrefix}/portfolio/${portfolioId}/pdf-export-params`,
  PDF_EXPORT: (portfolioId: string) => `${routePrefix}/portfolio/${portfolioId}/pdf-export`,
}
