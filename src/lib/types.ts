import type { ChartDataset, ChartTypeRegistry } from 'chart.js'

// Re-export schema-derived types
export type {
  Json,
  Profile,
  Portfolio,
  Investment,
  Transaction,
  InvestmentNested,
  PortfolioNested,
  PeriodicWithdrawalGoalData,
  RetirementGoalData,
  EducationGoalData,
  GoalData,
} from './schemas'

export type { TransactionStore } from './stores/transaction.svelte'
export type { InvestmentStore } from './stores/investment.svelte'
export type { PortfolioStore } from './stores/portfolio.svelte'

export type InvestmentWithColorIndex = Investment & {
  colorIndex?: number
  hidden?: boolean
  toggleHide?: () => void
}

import type { Investment } from './schemas'

export type TooltipData = {
  dataIndex: number
  value: number
  colorIndex: number
  name: string
  type?: string
}

export type CustomDataset<T extends keyof ChartTypeRegistry> = ChartDataset<T> & {
  colorIndex: number
  label: string
}

export type ChartDatasetWithColor = ChartDataset & {
  colorIndex?: number
}
