import Decimal from 'decimal.js'

import type {
  CompoundingFrequency,
  Frequency,
  InterestType,
  ProfileTangibleAsset,
  RemainingTermUnit,
  TangibleAssetStatus,
  ValueOverTime,
} from '$lib/schemas'

const atLeastZero = (a: number, b: number): number =>
  Decimal.max(new Decimal(a).minus(b), 0).toNumber()

/** The loan a projection takes on for `price` after `downPayment` in cash, never below 0. */
export function financedAmount(price: number | undefined, downPayment: number | undefined): number {
  return atLeastZero(price ?? 0, downPayment ?? 0)
}

/**
 * The down payment the plan dialog opens an asset at. An asset imported from
 * financial data has none: it is already owned, and the dialog edits its
 * balance owed directly. One the dialog has saved carries its own. One written
 * by an MCP tool has only a balance owed, and the price less that is what has
 * been paid. Owing more than the price reads as nothing paid.
 */
export function seededDownPayment(
  asset: Pick<ProfileTangibleAsset, 'value' | 'status' | 'outstanding_balance' | 'down_payment'>,
  imported = false,
): number | undefined {
  if (imported) return undefined
  if (asset.down_payment !== undefined) return asset.down_payment
  if (asset.status !== 'financed' || asset.outstanding_balance === undefined) return undefined
  return atLeastZero(asset.value, asset.outstanding_balance)
}

/** Editable shape of a tangible asset on the financial-data card. */
export interface TangibleAssetUI {
  id: string
  name: string
  value: number | undefined
  status: TangibleAssetStatus
  outstanding_balance: number | undefined
  installment_frequency: Frequency
  annual_rate: number | undefined
  installment_amount: number | undefined
  remaining_term: number | undefined
  remaining_term_unit: RemainingTermUnit
  // Read-only here (set in the plan dialog), carried so the Installment
  // amount ⇄ Term derivation compounds the way the engine will.
  interest_type?: InterestType
  compounding_frequency?: CompoundingFrequency
  // Value over time and property tax are attributes of the asset itself, not
  // of the financing, so they show for any status. Planned purchase/sale
  // belong to the plan dialog; the loan's interest type round-trips via prev.
  value_over_time: ValueOverTime
  value_rate: number | undefined
  property_tax_rate: number | undefined
  // UI-only: whether the value/tax options are revealed, toggled from the
  // card menu.
  showAdvanced: boolean
  editing: boolean
  // UI-only: which of Installment amount / Term the user last edited, so the
  // financed amount, rate and frequency re-derive its counterpart.
  derivedFrom: 'amount' | 'term'
}

// Spread the stored asset first so the plan-dialog-only fields — planned
// purchase/sale and the loan's interest type/compounding — survive an edit
// here. Only the rendered fields (and what follows the loan) override it.
export function toStoredTangibleAsset(
  a: TangibleAssetUI,
  prev: ProfileTangibleAsset | undefined,
): ProfileTangibleAsset {
  return {
    ...prev,
    id: a.id,
    name: a.name,
    value: a.value ?? 0,
    status: a.status,
    outstanding_balance: a.status === 'financed' ? (a.outstanding_balance ?? 0) : undefined,
    installment_frequency: a.status === 'financed' ? a.installment_frequency : undefined,
    annual_rate: a.status === 'financed' ? (a.annual_rate ?? 0) : undefined,
    installment_amount: a.status === 'financed' ? (a.installment_amount ?? 0) : undefined,
    remaining_term: a.status === 'financed' ? (a.remaining_term ?? 0) : undefined,
    remaining_term_unit: a.remaining_term_unit,
    // Interest settings live in the plan dialog; drop them with the loan so
    // both writers agree on what a non-financed asset stores.
    interest_type: a.status === 'financed' ? prev?.interest_type : undefined,
    compounding_frequency: a.status === 'financed' ? prev?.compounding_frequency : undefined,
    // The mode only means something with a rate; without one leave it unset so
    // the asset keeps tracking inflation (mirrors the plan dialog).
    value_over_time: a.value_rate ? a.value_over_time : undefined,
    value_rate: a.value_rate,
    property_tax_rate: a.property_tax_rate,
  }
}
