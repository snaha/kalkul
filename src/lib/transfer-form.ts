import type {
  CashFlowEnd,
  CashFlowStart,
  ChangeOverTime,
  Frequency,
  Transfer,
  TransferSchedule,
} from '$lib/schemas'

/**
 * Editable shape of a transfer shared by the plan dialog and the setup card.
 * Every optional stored field is present so the forms can bind to it; the
 * mapping back to `Transfer` drops whatever the chosen schedule/timing does
 * not use.
 */
export interface TransferFields {
  id: string
  name: string
  from_asset_id: string
  to_asset_id: string
  amount: number | undefined
  transfer_all: boolean
  inflation_adjusted: boolean
  schedule: TransferSchedule
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

export function blankTransferFields(id: string, name: string): TransferFields {
  const now = new Date()
  return {
    id,
    name,
    from_asset_id: '',
    to_asset_id: '',
    amount: undefined,
    transfer_all: false,
    // Default ON — mirrors the income/expense default so new transfers keep
    // their real value over time without the user having to flip it.
    inflation_adjusted: true,
    schedule: 'one_time',
    transaction_year: now.getFullYear(),
    transaction_month: now.getMonth() + 1,
    frequency: 'monthly',
    start: 'now',
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

/** Stored transfer → editable fields, folding the legacy match_inflation value into the toggle. */
export function transferToFields(src: Transfer): TransferFields {
  const f = blankTransferFields(src.id, src.name)
  f.from_asset_id = src.from_asset_id
  f.to_asset_id = src.to_asset_id
  f.amount = src.amount > 0 ? src.amount : undefined
  f.transfer_all = src.transfer_all ?? false
  f.schedule = src.schedule
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

/** Editable fields → stored transfer, keeping only what the schedule and timing choices use. */
export function transferFromFields(f: TransferFields): Transfer {
  const common = {
    id: f.id,
    name: f.name,
    from_asset_id: f.from_asset_id,
    to_asset_id: f.to_asset_id,
    amount: f.transfer_all ? 0 : (f.amount ?? 0),
    ...(f.transfer_all ? { transfer_all: true } : {}),
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
