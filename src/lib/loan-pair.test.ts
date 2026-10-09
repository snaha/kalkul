import { describe, expect, it } from 'vitest'

import { type LoanPairFields, rederiveLoanPair } from '$lib/loan-pair'

// The financed remainder from #319: 345 000 bought with 70 000 down, at 4.5 %
// over 20 years of monthly installments.
const loan: LoanPairFields = {
  outstanding_balance: 275_000,
  installment_frequency: 'monthly',
  annual_rate: 4.5,
  installment_amount: undefined,
  remaining_term: 20,
  remaining_term_unit: 'years',
}

describe('rederiveLoanPair', () => {
  it('derives the installment from the term', () => {
    const l = { ...loan }
    rederiveLoanPair(l, 'term')
    expect(l.installment_amount).toBe(1739.79)
  })

  it('reads and writes the term in months when that is the unit', () => {
    const l: LoanPairFields = { ...loan, remaining_term: 240, remaining_term_unit: 'months' }
    rederiveLoanPair(l, 'term')
    expect(l.installment_amount).toBe(1739.79)

    const back: LoanPairFields = { ...l, remaining_term: undefined }
    rederiveLoanPair(back, 'amount')
    expect(back.remaining_term).toBe(240)
  })

  it('derives the term from the installment', () => {
    const l: LoanPairFields = { ...loan, remaining_term: undefined, installment_amount: 1739.79 }
    rederiveLoanPair(l, 'amount')
    expect(l.remaining_term).toBe(20)
  })

  it('leaves both sides alone while the anchor cannot describe a loan', () => {
    const empty: LoanPairFields = { ...loan, remaining_term: undefined }
    rederiveLoanPair(empty, 'term')
    expect(empty.installment_amount).toBeUndefined()

    const tooSmall: LoanPairFields = { ...loan, remaining_term: 7, installment_amount: 100 }
    rederiveLoanPair(tooSmall, 'amount')
    expect(tooSmall.remaining_term).toBe(7)
  })
})
