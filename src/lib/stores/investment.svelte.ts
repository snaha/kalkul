import type { SvelteSet } from 'svelte/reactivity'

import type { Investment, InvestmentNested, Transaction } from '$lib/types'

import type { TransactionStore } from './transaction.svelte'
import { withTransactionStore } from './transaction.svelte'

type PortfolioParent = {
  persist(): void
  removeChild(id: string): void
  duplicateChild(newInv: InvestmentNested): string | undefined
  hiddenIds: SvelteSet<string>
  getSiblingsOf(id: string): InvestmentStore[]
}

export type InvestmentStore = Omit<InvestmentNested, 'transactions'> & {
  transactions: TransactionStore[]
  update(updates: Partial<Omit<Investment, 'id'>>): void
  delete(): void
  duplicate(): string | undefined
  addTransaction(data: Omit<Transaction, 'id'>): string
  hidden: boolean
  toggleHide(): void
  toggleFocus(): void
  focused: boolean
  deleteTransaction(txId: string): void
  duplicateTransaction(newTx: Transaction): string
  persist(): void
  toJSON(): InvestmentNested
}

export function withInvestmentStore(
  inv: InvestmentNested,
  portfolio: PortfolioParent,
): InvestmentStore {
  let id = $state(inv.id)
  let name = $state(inv.name)
  let apy = $state(inv.apy)
  let type = $state(inv.type)
  let advanced_fees = $state(inv.advanced_fees)
  let entry_fee = $state(inv.entry_fee)
  let entry_fee_type = $state(inv.entry_fee_type)
  let exit_fee = $state(inv.exit_fee)
  let exit_fee_type = $state(inv.exit_fee_type)
  let management_fee = $state(inv.management_fee)
  let management_fee_type = $state(inv.management_fee_type)
  let success_fee = $state(inv.success_fee)
  let ter = $state(inv.ter)
  let goal_data = $state(inv.goal_data)
  let transactions = $state<TransactionStore[]>([])

  const store: InvestmentStore = {
    get id() {
      return id
    },
    set id(v) {
      id = v
    },
    get name() {
      return name
    },
    set name(v) {
      name = v
    },
    get apy() {
      return apy
    },
    set apy(v) {
      apy = v
    },
    get type() {
      return type
    },
    set type(v) {
      type = v
    },
    get advanced_fees() {
      return advanced_fees
    },
    set advanced_fees(v) {
      advanced_fees = v
    },
    get entry_fee() {
      return entry_fee
    },
    set entry_fee(v) {
      entry_fee = v
    },
    get entry_fee_type() {
      return entry_fee_type
    },
    set entry_fee_type(v) {
      entry_fee_type = v
    },
    get exit_fee() {
      return exit_fee
    },
    set exit_fee(v) {
      exit_fee = v
    },
    get exit_fee_type() {
      return exit_fee_type
    },
    set exit_fee_type(v) {
      exit_fee_type = v
    },
    get management_fee() {
      return management_fee
    },
    set management_fee(v) {
      management_fee = v
    },
    get management_fee_type() {
      return management_fee_type
    },
    set management_fee_type(v) {
      management_fee_type = v
    },
    get success_fee() {
      return success_fee
    },
    set success_fee(v) {
      success_fee = v
    },
    get ter() {
      return ter
    },
    set ter(v) {
      ter = v
    },
    get goal_data() {
      return goal_data
    },
    set goal_data(v) {
      goal_data = v
    },
    get transactions() {
      return transactions
    },
    set transactions(v) {
      transactions = v
    },

    get hidden() {
      return portfolio.hiddenIds.has(id)
    },

    get focused() {
      const siblings = portfolio.getSiblingsOf(id)
      if (siblings.length <= 1) return false
      return (
        siblings.every((s) => s.id === id || portfolio.hiddenIds.has(s.id)) &&
        !portfolio.hiddenIds.has(id)
      )
    },

    update(updates: Partial<Omit<Investment, 'id'>>) {
      Object.assign(this, updates)
      portfolio.persist()
    },

    delete() {
      portfolio.removeChild(id)
    },

    duplicate(): string | undefined {
      const newInvestmentId = crypto.randomUUID()
      const { transactions: txs, ...rest } = this.toJSON()
      const newInvestment: InvestmentNested = {
        ...rest,
        id: newInvestmentId,
        transactions: txs.map((t) => ({ ...t, id: crypto.randomUUID() })),
      }
      return portfolio.duplicateChild(newInvestment)
    },

    addTransaction(data: Omit<Transaction, 'id'>) {
      const txId = crypto.randomUUID()
      const newTx: Transaction = { ...data, id: txId }
      const enrichedTx = withTransactionStore(newTx, this)
      transactions.push(enrichedTx)
      portfolio.persist()
      return txId
    },

    deleteTransaction(txId: string) {
      const idx = transactions.findIndex((t) => t.id === txId)
      if (idx === -1) return
      transactions.splice(idx, 1)
      portfolio.persist()
    },

    duplicateTransaction(newTx: Transaction): string {
      const enrichedTx = withTransactionStore(newTx, this)
      transactions.push(enrichedTx)
      portfolio.persist()
      return newTx.id
    },

    persist() {
      portfolio.persist()
    },

    toggleHide() {
      if (portfolio.hiddenIds.has(id)) {
        portfolio.hiddenIds.delete(id)
      } else {
        portfolio.hiddenIds.add(id)
      }
    },

    toggleFocus() {
      const siblings = portfolio.getSiblingsOf(id)
      const othersHidden = siblings.every((s) => s.id === id || portfolio.hiddenIds.has(s.id))
      if (othersHidden && !portfolio.hiddenIds.has(id)) {
        for (const s of siblings) {
          portfolio.hiddenIds.delete(s.id)
        }
      } else {
        for (const s of siblings) {
          if (s.id !== id) {
            portfolio.hiddenIds.add(s.id)
          } else {
            portfolio.hiddenIds.delete(s.id)
          }
        }
      }
    },

    toJSON(): InvestmentNested {
      return {
        id,
        name,
        apy,
        type,
        advanced_fees,
        entry_fee,
        entry_fee_type,
        exit_fee,
        exit_fee_type,
        management_fee,
        management_fee_type,
        success_fee,
        ter,
        goal_data,
        transactions: transactions.map((t) => t.toJSON()),
      }
    },
  }

  // Enrich child transactions
  transactions = inv.transactions.map((tx) => withTransactionStore(tx, store))

  return store
}
