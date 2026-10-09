import { installmentAmountForLoan, termYearsForLoan } from '$lib/plan-projection'
import type { CompoundingFrequency, Frequency, InterestType, RemainingTermUnit } from '$lib/schemas'

/** The loan fields a form holds while the user is still typing. */
export interface LoanPairFields {
  outstanding_balance: number | undefined
  installment_frequency: Frequency
  annual_rate: number | undefined
  installment_amount: number | undefined
  remaining_term: number | undefined
  /** Years when absent. */
  remaining_term_unit?: RemainingTermUnit
  interest_type?: InterestType
  compounding_frequency?: CompoundingFrequency
}

/** Which of Installment amount / Term the user last edited. */
export type LoanPairAnchor = 'amount' | 'term'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Installment amount ⇄ Term (#258, #319). The side the user last edited is the
 * anchor; the other follows from the principal, rate and frequency, so changing
 * any of those re-derives the counterpart instead of leaving it stale. Writes
 * in place, the term in the loan's own unit. Nothing changes while the anchor
 * cannot describe a loan (empty, or a payment that never covers the interest).
 */
export function rederiveLoanPair(loan: LoanPairFields, anchor: LoanPairAnchor): void {
  const terms = {
    outstanding_balance: loan.outstanding_balance ?? 0,
    installment_frequency: loan.installment_frequency,
    annual_rate: loan.annual_rate ?? 0,
    interest_type: loan.interest_type,
    compounding_frequency: loan.compounding_frequency,
  }
  const perYear = loan.remaining_term_unit === 'months' ? 12 : 1
  if (anchor === 'term') {
    const years = (loan.remaining_term ?? 0) / perYear
    if (years <= 0) return
    const amount = installmentAmountForLoan({ ...terms, remaining_term: years })
    if (amount !== undefined) loan.installment_amount = round2(amount)
  } else {
    const amount = loan.installment_amount ?? 0
    if (amount <= 0) return
    const years = termYearsForLoan({ ...terms, remaining_term: 0, installment_amount: amount })
    if (years !== undefined) loan.remaining_term = round2(years * perYear)
  }
}
