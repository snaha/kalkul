import { _ } from 'svelte-i18n'
import { get } from 'svelte/store'

import { z } from 'zod'

// --- Enum schemas ---

export const frequencySchema = z.enum(['monthly', 'yearly', 'weekly'])

export const cashFlowStartSchema = z.enum(['immediately', 'at_specific_date', 'when_age_is'])

export const cashFlowEndSchema = z.enum(['never', 'at_specific_date', 'when_age_is'])

export const changeOverTimeSchema = z.enum([
  'none',
  'match_inflation',
  'increase_yearly',
  'decrease_yearly',
])

export const tangibleAssetStatusSchema = z.enum(['fully_owned', 'financed'])

export const planStartTypeSchema = z.enum(['now', 'at_specific_date'])

export const planEndTypeSchema = z.enum(['when_age_is', 'at_specific_date'])

// --- Domain schemas ---

export type Json = string | number | boolean | { [key: string]: Json | undefined } | Json[]

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), jsonSchema.optional()),
    z.array(jsonSchema),
  ]),
)

// --- Cash flow refinement ---

const cashFlowTemporalRefinement = (
  obj: {
    start: string
    start_year?: number
    start_month?: number
    start_age?: number
    end: string
    end_year?: number
    end_month?: number
    end_age?: number
  },
  ctx: z.RefinementCtx,
) => {
  if (obj.start === 'at_specific_date') {
    if (obj.start_year === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['start_year'],
        message: get(_)('validation.required_when_start_at_specific_date'),
      })
    if (obj.start_month === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['start_month'],
        message: get(_)('validation.required_when_start_at_specific_date'),
      })
  }
  if (obj.start === 'when_age_is' && obj.start_age === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_age'],
      message: get(_)('validation.required_when_start_when_age_is'),
    })
  }
  if (obj.end === 'at_specific_date') {
    if (obj.end_year === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_year'],
        message: get(_)('validation.required_when_end_at_specific_date'),
      })
    if (obj.end_month === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_month'],
        message: get(_)('validation.required_when_end_at_specific_date'),
      })
  }
  if (obj.end === 'when_age_is' && obj.end_age === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_age'],
      message: get(_)('validation.required_when_end_when_age_is'),
    })
  }
}

export const incomeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    amount: z.number(),
    frequency: frequencySchema,
    withhold_taxes: z.boolean(),
    tax_percentage: z.number().optional(),
    start: cashFlowStartSchema,
    start_year: z.number().optional(),
    start_month: z.number().optional(),
    start_age: z.number().optional(),
    end: cashFlowEndSchema,
    end_year: z.number().optional(),
    end_month: z.number().optional(),
    end_age: z.number().optional(),
    change_over_time: changeOverTimeSchema,
    change_percentage: z.number().optional(),
  })
  .superRefine(cashFlowTemporalRefinement)

export const expenseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    amount: z.number(),
    frequency: frequencySchema,
    start: cashFlowStartSchema,
    start_year: z.number().optional(),
    start_month: z.number().optional(),
    start_age: z.number().optional(),
    end: cashFlowEndSchema,
    end_year: z.number().optional(),
    end_month: z.number().optional(),
    end_age: z.number().optional(),
    change_over_time: changeOverTimeSchema,
    change_percentage: z.number().optional(),
  })
  .superRefine(cashFlowTemporalRefinement)

export const profileInvestmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  balance: z.number(),
  apy: z.number(),
})

export const profileTangibleAssetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
    status: tangibleAssetStatusSchema,
    outstanding_balance: z.number().optional(),
    installment_frequency: frequencySchema.optional(),
    annual_rate: z.number().optional(),
    installment_amount: z.number().optional(),
    remaining_term: z.number().optional(),
  })
  .superRefine((obj, ctx) => {
    if (obj.status === 'financed') {
      if (obj.outstanding_balance === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outstanding_balance'],
          message: get(_)('validation.required_when_financed'),
        })
      if (obj.installment_frequency === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installment_frequency'],
          message: get(_)('validation.required_when_financed'),
        })
      if (obj.annual_rate === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annual_rate'],
          message: get(_)('validation.required_when_financed'),
        })
      if (obj.installment_amount === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installment_amount'],
          message: get(_)('validation.required_when_financed'),
        })
      if (obj.remaining_term === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remaining_term'],
          message: get(_)('validation.required_when_financed'),
        })
    }
  })

export const profileLiabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  outstanding_balance: z.number(),
  installment_frequency: frequencySchema,
  annual_rate: z.number(),
  installment_amount: z.number(),
  remaining_term: z.number(),
})

export const profileSchema = z.object({
  name: z.string(),
  email: z.string(),
  birth_date: z.string().optional(),
  location: z.string().optional(),
  currency: z.string().optional(),
  cash_amount: z.number().optional(),
  has_investments: z.boolean().optional(),
  has_tangible_assets: z.boolean().optional(),
  has_liabilities: z.boolean().optional(),
  investments: z.array(profileInvestmentSchema).optional(),
  tangible_assets: z.array(profileTangibleAssetSchema).optional(),
  liabilities: z.array(profileLiabilitySchema).optional(),
  incomes: z.array(incomeSchema).optional(),
  expenses: z.array(expenseSchema).optional(),
  hide_plan_intro: z.boolean().optional(),
})

export const transferScheduleSchema = z.enum(['one_time', 'recurring'])

export const transferSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    from_asset_id: z.string(),
    to_asset_id: z.string(),
    amount: z.number(),
    // When true, ignore `amount` and transfer the source's full available
    // balance at the time of execution.
    transfer_all: z.boolean().optional(),
    schedule: transferScheduleSchema,
    // one-time fields
    transaction_year: z.number().optional(),
    transaction_month: z.number().optional(),
    // recurring fields (mirror income/expense temporal shape)
    frequency: frequencySchema.optional(),
    start: cashFlowStartSchema.optional(),
    start_year: z.number().optional(),
    start_month: z.number().optional(),
    start_age: z.number().optional(),
    end: cashFlowEndSchema.optional(),
    end_year: z.number().optional(),
    end_month: z.number().optional(),
    end_age: z.number().optional(),
    change_over_time: changeOverTimeSchema.optional(),
    change_percentage: z.number().optional(),
  })
  .superRefine((obj, ctx) => {
    if (obj.from_asset_id === obj.to_asset_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_asset_id'],
        message: get(_)('validation.transfer_same_endpoints'),
      })
    }
    if (obj.schedule === 'one_time') {
      if (obj.transaction_year === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transaction_year'],
          message: get(_)('validation.required_for_one_time_transfer'),
        })
      if (obj.transaction_month === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transaction_month'],
          message: get(_)('validation.required_for_one_time_transfer'),
        })
    } else {
      if (obj.frequency === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['frequency'],
          message: get(_)('validation.required_for_recurring_transfer'),
        })
      if (obj.start === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['start'],
          message: get(_)('validation.required_for_recurring_transfer'),
        })
      if (obj.end === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['end'],
          message: get(_)('validation.required_for_recurring_transfer'),
        })
      if (obj.change_over_time === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['change_over_time'],
          message: get(_)('validation.required_for_recurring_transfer'),
        })
      if (obj.start !== undefined && obj.end !== undefined) {
        cashFlowTemporalRefinement(
          {
            start: obj.start,
            start_year: obj.start_year,
            start_month: obj.start_month,
            start_age: obj.start_age,
            end: obj.end,
            end_year: obj.end_year,
            end_month: obj.end_month,
            end_age: obj.end_age,
          },
          ctx,
        )
      }
    }
  })

export const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().optional(),
  currency: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  inflation_rate: z.number(),
  include_cash: z.boolean().optional(),
  included_investment_ids: z.array(z.string()).optional(),
  included_tangible_asset_ids: z.array(z.string()).optional(),
  included_liability_ids: z.array(z.string()).optional(),
  included_income_ids: z.array(z.string()).optional(),
  included_expense_ids: z.array(z.string()).optional(),
  transfers: z.array(transferSchema).optional(),
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

export type ProfileInvestment = z.infer<typeof profileInvestmentSchema>
export type ProfileTangibleAsset = z.infer<typeof profileTangibleAssetSchema>
export type ProfileLiability = z.infer<typeof profileLiabilitySchema>
export type Income = z.infer<typeof incomeSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Profile = z.infer<typeof profileSchema>
export type Portfolio = z.infer<typeof portfolioSchema>
export type Transfer = z.infer<typeof transferSchema>
export type TransferSchedule = z.infer<typeof transferScheduleSchema>
export type Investment = z.infer<typeof investmentSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type InvestmentNested = z.infer<typeof investmentNestedSchema>
export type PortfolioNested = z.infer<typeof portfolioNestedSchema>
export type StoredData = z.infer<typeof storedDataSchema>
export type PeriodicWithdrawalGoalData = z.infer<typeof periodicWithdrawalGoalDataSchema>
export type RetirementGoalData = z.infer<typeof retirementGoalDataSchema>
export type Frequency = z.infer<typeof frequencySchema>
export type CashFlowStart = z.infer<typeof cashFlowStartSchema>
export type CashFlowEnd = z.infer<typeof cashFlowEndSchema>
export type ChangeOverTime = z.infer<typeof changeOverTimeSchema>
export type TangibleAssetStatus = z.infer<typeof tangibleAssetStatusSchema>
export type PlanStartType = z.infer<typeof planStartTypeSchema>
export type PlanEndType = z.infer<typeof planEndTypeSchema>
