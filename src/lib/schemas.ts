import { _ } from 'svelte-i18n'
import { get } from 'svelte/store'

import { z } from 'zod'

// --- Enum schemas ---

export const frequencySchema = z.enum(['monthly', 'yearly', 'weekly'])

export const cashFlowStartSchema = z.enum(['immediately', 'now', 'at_specific_date', 'when_age_is'])

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
  // A start month after the end month within the same calendar year would
  // silently zero the cash flow in the projection — reject it instead.
  if (
    sameYearMonthsInverted(
      obj.start,
      obj.start_year,
      obj.start_month,
      obj.end,
      obj.end_year,
      obj.end_month,
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_month'],
      message: get(_)('validation.end_month_before_start_month'),
    })
  }
}

// A same-year specific-date range whose start month is after its end month is
// contradictory. Mirrors the check in cashFlowTemporalRefinement above; forms
// use it to constrain the month dropdowns and gate saving before the data
// ever reaches the schema.
export function sameYearMonthsInverted(
  start: string | undefined,
  startYear: number | undefined,
  startMonth: number | undefined,
  end: string | undefined,
  endYear: number | undefined,
  endMonth: number | undefined,
): boolean {
  return (
    start === 'at_specific_date' &&
    end === 'at_specific_date' &&
    startYear !== undefined &&
    startYear === endYear &&
    startMonth !== undefined &&
    endMonth !== undefined &&
    startMonth > endMonth
  )
}

// --- Stored-data repair ---

function isRecord(value: unknown): value is Record<string, unknown> {
  // null check is for raw JSON.parse output, which can legitimately be null.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function repairCashFlowMonths(flow: unknown): void {
  if (!isRecord(flow)) return
  const { start, start_year, start_month, end, end_year, end_month } = flow
  if (
    typeof start === 'string' &&
    typeof end === 'string' &&
    typeof start_year === 'number' &&
    typeof end_year === 'number' &&
    typeof start_month === 'number' &&
    typeof end_month === 'number' &&
    sameYearMonthsInverted(start, start_year, start_month, end, end_year, end_month)
  ) {
    flow.start_month = end_month
    flow.end_month = start_month
    console.warn(
      `Cash flow "${String(flow.name ?? flow.id ?? 'unknown')}" had its start month after its end month in ${start_year}; swapped the months so the stored data stays valid`,
    )
  }
}

/**
 * Data persisted before the same-year month-order rule existed may contain a
 * cash flow whose start month is after its end month. storedDataSchema now
 * rejects that, and a rejected blob would make loadData() fall back to the
 * empty default profile — wiping the user's entire dataset on the next
 * persist. Run this on raw parsed JSON before schema validation: it swaps the
 * two months in place, so both user-entered values survive and the flow spans
 * the range the user visibly intended instead of silently contributing
 * nothing. Covers profile incomes/expenses and portfolio transfers — every
 * place cashFlowTemporalRefinement applies.
 */
export function repairStoredCashFlowMonths(data: unknown): unknown {
  if (!isRecord(data)) return data
  if (isRecord(data.profile)) {
    for (const key of ['incomes', 'expenses']) {
      const flows = data.profile[key]
      if (Array.isArray(flows)) for (const flow of flows) repairCashFlowMonths(flow)
    }
  }
  if (Array.isArray(data.portfolios)) {
    for (const portfolio of data.portfolios) {
      if (isRecord(portfolio) && Array.isArray(portfolio.transfers)) {
        for (const transfer of portfolio.transfers) repairCashFlowMonths(transfer)
      }
    }
  }
  return data
}

// A timing edge ('start' or 'end') is complete only once the mode-specific
// field is filled — otherwise the projection would silently fall back to the
// plan's first year. Mirrors cashFlowTemporalRefinement above; forms use it
// to gate saving before the data ever reaches the schema.
export function timingComplete(
  mode: CashFlowStart | CashFlowEnd,
  year: number | undefined,
  month: number | undefined,
  age: number | undefined,
): boolean {
  if (mode === 'at_specific_date') return year !== undefined && month !== undefined
  if (mode === 'when_age_is') return age !== undefined
  return true
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
    // Independent toggle: grows the nominal amount with the plan's inflation
    // rate each year. Compounds with change_over_time (e.g. a salary that's
    // both inflation-adjusted and gets a 2% real raise).
    inflation_adjusted: z.boolean().optional(),
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
    inflation_adjusted: z.boolean().optional(),
    change_over_time: changeOverTimeSchema,
    change_percentage: z.number().optional(),
  })
  .superRefine(cashFlowTemporalRefinement)

export const entryFeeTypeSchema = z.enum(['ongoing', 'upfront', 'forty-sixty'])
export const exitFeeTypeSchema = z.enum(['percentage', 'fixed'])

export const profileInvestmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  balance: z.number(),
  apy: z.number(),
  // Total expense ratio (annual %): drag on compounding APY.
  ter: z.number().optional(),
  // Entry fee charged when money is transferred INTO this investment. The
  // payment type controls whether the fee is deducted up front from the
  // deposit, spread out over the holding period (ongoing), or split 40/60.
  entry_fee: z.number().optional(),
  entry_fee_type: entryFeeTypeSchema.optional(),
  // Exit fee charged when money is transferred OUT of this investment. Can
  // be a percentage of the withdrawal or a fixed currency amount.
  exit_fee: z.number().optional(),
  exit_fee_type: exitFeeTypeSchema.optional(),
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

export const interestTypeSchema = z.enum(['compound', 'simple'])
export const compoundingFrequencySchema = z.enum(['daily', 'monthly', 'yearly'])

export const profileLiabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  outstanding_balance: z.number(),
  installment_frequency: frequencySchema,
  annual_rate: z.number(),
  installment_amount: z.number(),
  remaining_term: z.number(),
  // Advanced options. Defaults preserve the existing behaviour when omitted:
  // compound interest at the installment frequency.
  interest_type: interestTypeSchema.optional(),
  compounding_frequency: compoundingFrequencySchema.optional(),
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
    // Independent toggle: grows the nominal amount with the plan's inflation
    // rate. For one-time transfers, scales from plan start to the transaction
    // year. For recurring transfers, compounds yearly alongside change_over_time.
    inflation_adjusted: z.boolean().optional(),
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
  included_transfer_ids: z.array(z.string()).optional(),
})

export const storedDataSchema = z.object({
  lastUpdated: z.number(),
  profile: profileSchema,
  portfolios: z.array(portfolioSchema),
})

// --- Derived types ---

export type EntryFeeType = z.infer<typeof entryFeeTypeSchema>
export type ExitFeeType = z.infer<typeof exitFeeTypeSchema>
export type InterestType = z.infer<typeof interestTypeSchema>
export type CompoundingFrequency = z.infer<typeof compoundingFrequencySchema>
export type ProfileInvestment = z.infer<typeof profileInvestmentSchema>
export type ProfileTangibleAsset = z.infer<typeof profileTangibleAssetSchema>
export type ProfileLiability = z.infer<typeof profileLiabilitySchema>
export type Income = z.infer<typeof incomeSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Profile = z.infer<typeof profileSchema>
export type Portfolio = z.infer<typeof portfolioSchema>
export type Transfer = z.infer<typeof transferSchema>
export type TransferSchedule = z.infer<typeof transferScheduleSchema>
export type StoredData = z.infer<typeof storedDataSchema>
export type Frequency = z.infer<typeof frequencySchema>
export type CashFlowStart = z.infer<typeof cashFlowStartSchema>
export type CashFlowEnd = z.infer<typeof cashFlowEndSchema>
export type ChangeOverTime = z.infer<typeof changeOverTimeSchema>
export type TangibleAssetStatus = z.infer<typeof tangibleAssetStatusSchema>
export type PlanStartType = z.infer<typeof planStartTypeSchema>
export type PlanEndType = z.infer<typeof planEndTypeSchema>
