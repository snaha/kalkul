import type { Transaction } from '$lib/types'

import type { InvestmentStore } from './investment.svelte'

export type TransactionStore = Transaction & {
  readonly investment: InvestmentStore
  update(updates: Partial<Omit<Transaction, 'id'>>): void
  delete(): void
  duplicate(): string
  toJSON(): Transaction
}

export function withTransactionStore(
  tx: Transaction,
  investment: InvestmentStore,
): TransactionStore {
  let id = $state(tx.id)
  let amount = $state(tx.amount)
  let label = $state(tx.label)
  let date = $state(tx.date)
  let end_date = $state(tx.end_date)
  let type = $state(tx.type)
  let inflation_adjusted = $state(tx.inflation_adjusted)
  let repeat = $state(tx.repeat)
  let repeat_unit = $state(tx.repeat_unit)

  return {
    get id() {
      return id
    },
    set id(v) {
      id = v
    },
    get amount() {
      return amount
    },
    set amount(v) {
      amount = v
    },
    get label() {
      return label
    },
    set label(v) {
      label = v
    },
    get date() {
      return date
    },
    set date(v) {
      date = v
    },
    get end_date() {
      return end_date
    },
    set end_date(v) {
      end_date = v
    },
    get type() {
      return type
    },
    set type(v) {
      type = v
    },
    get inflation_adjusted() {
      return inflation_adjusted
    },
    set inflation_adjusted(v) {
      inflation_adjusted = v
    },
    get repeat() {
      return repeat
    },
    set repeat(v) {
      repeat = v
    },
    get repeat_unit() {
      return repeat_unit
    },
    set repeat_unit(v) {
      repeat_unit = v
    },

    investment,

    update(updates: Partial<Omit<Transaction, 'id'>>) {
      Object.assign(this, updates)
      investment.persist()
    },

    delete() {
      investment.deleteTransaction(id)
    },

    duplicate(): string {
      const newId = crypto.randomUUID()
      const newTx: Transaction = {
        ...this.toJSON(),
        id: newId,
      }
      return investment.duplicateTransaction(newTx)
    },

    toJSON(): Transaction {
      return {
        id,
        amount,
        date,
        end_date,
        type,
        inflation_adjusted,
        label,
        repeat,
        repeat_unit,
      }
    },
  }
}
