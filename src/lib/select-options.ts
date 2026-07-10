import type { SelectFieldItem } from '$lib/components/select-field.svelte'
import {
  type Frequency,
  type TangibleAssetStatus,
  frequencySchema,
  tangibleAssetStatusSchema,
} from '$lib/schemas'

// Translator function compatible with svelte-i18n's `$_`. Call sites pass `$_`
// and wrap the helper in `$derived` so labels stay reactive to language switches.
type Translator = (id: string) => string

// Options are derived from the Zod enums so a newly added enum member fails the
// typecheck here (via the `satisfies Record<...>`) instead of silently missing
// from dropdowns.

export function getFrequencyItems($_: Translator): SelectFieldItem[] {
  const labels = {
    monthly: $_('page.setup.common.monthly'),
    yearly: $_('page.setup.common.yearly'),
    weekly: $_('page.setup.common.weekly'),
  } satisfies Record<Frequency, string>
  return frequencySchema.options.map((value) => ({ value, label: labels[value] }))
}

export function getFrequencyShortLabel($_: Translator, frequency: Frequency): string {
  if (frequency === 'monthly') return $_('page.financialData.frequency.short.monthly')
  if (frequency === 'weekly') return $_('page.financialData.frequency.short.weekly')
  return $_('page.financialData.frequency.short.yearly')
}

export function getTangibleAssetStatusItems($_: Translator): SelectFieldItem[] {
  const labels = {
    fully_owned: $_('page.setup.tangibleAssets.fullyOwned'),
    financed: $_('page.setup.tangibleAssets.financed'),
  } satisfies Record<TangibleAssetStatus, string>
  return tangibleAssetStatusSchema.options.map((value) => ({ value, label: labels[value] }))
}
