import Decimal from 'decimal.js'

import type {
  Frequency,
  ProfileTangibleAsset,
  RemainingTermUnit,
  TangibleAssetStatus,
  ValueOverTime,
} from '$lib/schemas'

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
  // Value over time and property tax are attributes of the asset itself, not
  // of the financing, so they show for any status. Planned purchase/sale and
  // the loan's interest type stay in the plan dialog and round-trip via prev.
  value_over_time: ValueOverTime
  value_rate: number | undefined
  property_tax_rate: number | undefined
  // UI-only: whether the value/tax options are revealed, toggled from the
  // card menu.
  showAdvanced: boolean
  editing: boolean
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

/** What is still owed on `price` after `paid` has been put down, never below zero. */
export function outstandingBalance(price: number | undefined, paid: number | undefined): number {
  return Decimal.max(new Decimal(price ?? 0).minus(paid ?? 0), 0).toNumber()
}

/** The down payment implied by a stored balance; unknown until both figures exist. */
export function downPaymentOf(
  price: number | undefined,
  outstanding: number | undefined,
): number | undefined {
  if (price === undefined || outstanding === undefined) return undefined
  return Decimal.max(new Decimal(price).minus(outstanding), 0).toNumber()
}

/** The financing the plan dialog edits: a down payment against the price, not the balance. */
export interface TangibleAssetFinancing {
  value: number | undefined
  status: TangibleAssetStatus
  down_payment: number | undefined
}

/** The balance to store: the price less the down payment on a financed asset, none otherwise. */
export function outstandingBalanceFor(f: TangibleAssetFinancing): number | undefined {
  return f.status === 'financed' ? outstandingBalance(f.value, f.down_payment) : undefined
}

export function downPaymentExceedsPrice(f: TangibleAssetFinancing): boolean {
  return new Decimal(f.down_payment ?? 0).greaterThan(f.value ?? 0)
}
