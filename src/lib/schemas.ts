import { z } from 'zod'

// --- Domain schemas ---

export type Json = string | number | boolean | { [key: string]: Json | undefined } | Json[]

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(jsonSchema.optional()),
    z.array(jsonSchema),
  ]),
)

export const profileSchema = z.object({
  name: z.string(),
  email: z.string(),
  birth_date: z.string().optional(),
})

export const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  inflation_rate: z.number(),
})

export const transactionTypeSchema = z.enum(['deposit', 'withdrawal'])

export const periodSchema = z.enum(['day', 'week', 'month', 'year'])

export const investmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  apy: z.number().optional(),
  type: z.string().optional(),
  advanced_fees: z.boolean().optional(),
  entry_fee: z.number().optional(),
  entry_fee_type: z.string().optional(),
  exit_fee: z.number().optional(),
  exit_fee_type: z.string().optional(),
  management_fee: z.number().optional(),
  management_fee_type: z.string().optional(),
  success_fee: z.number().optional(),
  ter: z.number().optional(),
  goal_data: jsonSchema.optional(),
})

export const transactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.string(),
  end_date: z.string().optional(),
  type: transactionTypeSchema,
  inflation_adjusted: z.boolean(),
  label: z.string().optional(),
  repeat: z.number().optional(),
  repeat_unit: periodSchema.optional(),
})

export const investmentNestedSchema = investmentSchema.extend({
  transactions: z.array(transactionSchema),
})

export const portfolioNestedSchema = portfolioSchema.extend({
  investments: z.array(investmentNestedSchema),
  goals: z.array(investmentNestedSchema).default([]),
})

export const storedDataSchema = z.object({
  lastUpdated: z.number(),
  profile: profileSchema,
  portfolios: z.array(portfolioNestedSchema),
})

export const periodicWithdrawalGoalDataSchema = z.object({
  depositStart: z.string(),
  depositPeriod: z.enum(['month', 'year']),
  currentSavings: z.number(),
  customDepositAmount: z.number().optional(),
  withdrawalStart: z.string(),
  withdrawalDuration: z.number(),
  desiredBudget: z.number(),
  budgetPeriod: z.enum(['month', 'year']),
  apy: z.number(),
  inflation: z.number(),
})

export const retirementGoalDataSchema = periodicWithdrawalGoalDataSchema.extend({
  type: z.literal('retirement'),
})

// --- Derived types ---

export type Profile = z.infer<typeof profileSchema>
export type Portfolio = z.infer<typeof portfolioSchema>
export type Investment = z.infer<typeof investmentSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type InvestmentNested = z.infer<typeof investmentNestedSchema>
export type PortfolioNested = z.infer<typeof portfolioNestedSchema>
export type StoredData = z.infer<typeof storedDataSchema>
export type PeriodicWithdrawalGoalData = z.infer<typeof periodicWithdrawalGoalDataSchema>
export type RetirementGoalData = z.infer<typeof retirementGoalDataSchema>
