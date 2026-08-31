import type { SelectFieldItem } from '$lib/components/select-field.svelte'
import {
  type CompoundingFrequency,
  type EntryFeeType,
  type ExitFeeType,
  type Frequency,
  type InterestType,
  type RemainingTermUnit,
  type TangibleAssetStatus,
  type ValueOverTime,
  compoundingFrequencySchema,
  entryFeeTypeSchema,
  exitFeeTypeSchema,
  frequencySchema,
  interestTypeSchema,
  remainingTermUnitSchema,
  tangibleAssetStatusSchema,
  valueOverTimeSchema,
} from '$lib/schemas'

// Translator function compatible with svelte-i18n's `$_`. Call sites pass `$_`
// and wrap the helper in `$derived` so labels stay reactive to language switches.
type Translator = (id: string) => string

// Options are derived from the Zod enums so a newly added enum member fails the
// typecheck here (via the `satisfies Record<...>`) instead of silently missing
// from dropdowns.

export function getFrequencyItems($_: Translator): SelectFieldItem<Frequency>[] {
  const labels = {
    monthly: $_('page.setup.common.monthly'),
    yearly: $_('page.setup.common.yearly'),
    weekly: $_('page.setup.common.weekly'),
  } satisfies Record<Frequency, string>
  return frequencySchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getRemainingTermUnitItems($_: Translator): SelectFieldItem<RemainingTermUnit>[] {
  const labels = {
    years: $_('page.setup.common.years'),
    months: $_('page.setup.common.months'),
  } satisfies Record<RemainingTermUnit, string>
  return remainingTermUnitSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getFrequencyShortLabel($_: Translator, frequency: Frequency): string {
  if (frequency === 'monthly') return $_('page.financialData.frequency.short.monthly')
  if (frequency === 'weekly') return $_('page.financialData.frequency.short.weekly')
  return $_('page.financialData.frequency.short.yearly')
}

export function getEntryFeeTypeItems($_: Translator): SelectFieldItem<EntryFeeType>[] {
  const labels = {
    ongoing: $_('page.plan.entryFeeOngoing'),
    upfront: $_('page.plan.entryFeeUpfront'),
    'forty-sixty': $_('page.plan.entryFeeFortySixty'),
  } satisfies Record<EntryFeeType, string>
  return entryFeeTypeSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getExitFeeTypeItems($_: Translator): SelectFieldItem<ExitFeeType>[] {
  const labels = {
    percentage: $_('page.plan.exitFeePercentage'),
    fixed: $_('page.plan.exitFeeFixed'),
  } satisfies Record<ExitFeeType, string>
  return exitFeeTypeSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getInterestTypeItems($_: Translator): SelectFieldItem<InterestType>[] {
  const labels = {
    compound: $_('page.plan.interestCompound'),
    simple: $_('page.plan.interestSimple'),
  } satisfies Record<InterestType, string>
  return interestTypeSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getCompoundingFrequencyItems(
  $_: Translator,
): SelectFieldItem<CompoundingFrequency>[] {
  const labels = {
    daily: $_('page.plan.compoundingDaily'),
    monthly: $_('page.setup.common.monthly'),
    yearly: $_('page.setup.common.yearly'),
  } satisfies Record<CompoundingFrequency, string>
  return compoundingFrequencySchema.options.map((value) => ({ value, label: labels[value] }))
}

// The plan dialog frames it as how the asset is paid for rather than what its
// current status is, so the same enum gets Upfront / Financed labels there.
export function getPaymentMethodItems($_: Translator): SelectFieldItem<TangibleAssetStatus>[] {
  const labels = {
    fully_owned: $_('page.plan.paymentUpfront'),
    financed: $_('page.plan.paymentFinanced'),
  } satisfies Record<TangibleAssetStatus, string>
  return tangibleAssetStatusSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getValueOverTimeItems($_: Translator): SelectFieldItem<ValueOverTime>[] {
  const labels = {
    appreciate: $_('page.plan.valueAppreciate'),
    depreciate: $_('page.plan.valueDepreciate'),
  } satisfies Record<ValueOverTime, string>
  return valueOverTimeSchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getTangibleAssetStatusItems(
  $_: Translator,
): SelectFieldItem<TangibleAssetStatus>[] {
  const labels = {
    fully_owned: $_('page.setup.tangibleAssets.fullyOwned'),
    financed: $_('page.setup.tangibleAssets.financed'),
  } satisfies Record<TangibleAssetStatus, string>
  return tangibleAssetStatusSchema.options.map((value) => ({ value, label: labels[value] }))
}
