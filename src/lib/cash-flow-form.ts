import type {
  CashFlowEnd,
  CashFlowSchedule,
  CashFlowStart,
  ChangeOverTime,
  Expense,
  Frequency,
  Income,
} from '$lib/schemas'

/**
 * Editable shape of an income/expense shared by the plan dialog. Every
 * optional stored field is present so the form can bind to it; the mapping
 * back to `Income`/`Expense` drops whatever the chosen schedule/timing does
 * not use. Mirrors `transfer-form.ts`, which models the same one-time vs
 * recurring duality for transfers.
 */
export interface CashFlowFields {
  id: string
  name: string
  amount: number | undefined
  schedule: CashFlowSchedule
  inflation_adjusted: boolean
  // one-time
  transaction_year: number | undefined
  transaction_month: number | undefined
  // recurring
  frequency: Frequency
  start: CashFlowStart
  start_year: number | undefined
  start_month: number | undefined
  start_age: number | undefined
  end: CashFlowEnd
  end_year: number | undefined
  end_month: number | undefined
  end_age: number | undefined
  change_over_time: ChangeOverTime
  change_percentage: number | undefined
}

export function blankCashFlowFields(id: string, name: string): CashFlowFields {
  const now = new Date()
  return {
    id,
    name,
    amount: undefined,
    // Most items repeat (rent, a salary), so Recurring stays the default and
    // new items keep behaving like they did before schedules existed. The
    // transaction date is seeded with "now" (like transfers) so switching the
    // type to One-time yields a valid Create immediately.
    schedule: 'recurring',
    transaction_year: now.getFullYear(),
    transaction_month: now.getMonth() + 1,
    // Default ON — most income/expense streams track inflation in real
    // terms, so this matches user intent for the common case.
    inflation_adjusted: true,
    frequency: 'monthly',
    start: 'immediately',
    // Timing fields start empty so 'at_specific_date'/'when_age_is' force an
    // explicit choice instead of silently defaulting to "now" (= plan year 1).
    start_year: undefined,
    start_month: undefined,
    start_age: undefined,
    end: 'never',
    end_year: undefined,
    end_month: undefined,
    end_age: undefined,
    change_over_time: 'none',
    change_percentage: undefined,
  }
}

/** Stored cash flow → editable fields, folding the legacy match_inflation value into the toggle. */
export function cashFlowToFields(src: Income | Expense): CashFlowFields {
  const f = blankCashFlowFields(src.id, src.name)
  f.amount = src.amount > 0 ? src.amount : undefined
  // An absent schedule means recurring, matching the schema's default for
  // data stored before schedules existed.
  f.schedule = src.schedule ?? 'recurring'
  f.transaction_year = src.transaction_year ?? f.transaction_year
  f.transaction_month = src.transaction_month ?? f.transaction_month
  f.frequency = src.frequency ?? 'monthly'
  f.start = src.start ?? 'immediately'
  f.start_year = src.start_year
  f.start_month = src.start_month
  f.start_age = src.start_age
  f.end = src.end ?? 'never'
  f.end_year = src.end_year
  f.end_month = src.end_month
  f.end_age = src.end_age
  // Legacy migration: old change_over_time='match_inflation' folds into the
  // toggle and the dropdown collapses to 'none'.
  const legacyInflation = src.change_over_time === 'match_inflation'
  f.inflation_adjusted = src.inflation_adjusted === true || legacyInflation
  f.change_over_time = legacyInflation ? 'none' : (src.change_over_time ?? 'none')
  f.change_percentage = src.change_percentage
  return f
}

/** Editable fields → stored cash flow, keeping only what the schedule and timing choices use. */
export function cashFlowFromFields(f: CashFlowFields): Income | Expense {
  const common = {
    id: f.id,
    name: f.name,
    amount: f.amount ?? 0,
    inflation_adjusted: f.inflation_adjusted ? true : undefined,
  }
  if (f.schedule === 'one_time') {
    return {
      ...common,
      schedule: 'one_time',
      transaction_year: f.transaction_year,
      transaction_month: f.transaction_month,
    }
  }
  return {
    ...common,
    schedule: 'recurring',
    frequency: f.frequency,
    start: f.start,
    start_year: f.start === 'at_specific_date' ? f.start_year : undefined,
    start_month: f.start === 'at_specific_date' ? f.start_month : undefined,
    start_age: f.start === 'when_age_is' ? f.start_age : undefined,
    end: f.end,
    end_year: f.end === 'at_specific_date' ? f.end_year : undefined,
    end_month: f.end === 'at_specific_date' ? f.end_month : undefined,
    end_age: f.end === 'when_age_is' ? f.end_age : undefined,
    change_over_time: f.change_over_time,
    change_percentage:
      f.change_over_time === 'increase_yearly' || f.change_over_time === 'decrease_yearly'
        ? (f.change_percentage ?? 0)
        : undefined,
  }
}

/**
 * Same-year ranges can't end before they start: the end-month dropdown
 * disables the months before the start month. Undefined when the range is
 * not pinned to one calendar year.
 */
export function endMinMonth(f: CashFlowFields): number | undefined {
  return f.start === 'at_specific_date' &&
    f.end === 'at_specific_date' &&
    f.start_year !== undefined &&
    f.start_year === f.end_year
    ? f.start_month
    : undefined
}
