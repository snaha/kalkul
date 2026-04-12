import { calculateInflationAdjustedAmount } from './calculation-utils'
import { formatDate, incrementDate } from './date'
import type { Transaction, TransactionMap } from './types'

export function createTransactionMap(
  transactions: Omit<Transaction, 'type'>[],
  portfolioStartDate: string,
  inflationRate = 0,
): TransactionMap {
  const map: TransactionMap = new Map()

  transactions.forEach((transaction) => {
    addTransaction(map, transaction, portfolioStartDate, inflationRate)
  })

  return map
}

export function addSingleEvent(
  map: TransactionMap,
  date: string,
  amount: number,
  portfolioStartDate: string,
  inflationRate = 0,
  inflationAdjusted?: boolean,
  transactionId?: string,
): void {
  const dateString = date
  const existingEntry = map.get(dateString) ?? { amount: 0, transactionIds: [] }

  // Apply inflation adjustment if needed
  const adjustedAmount = inflationAdjusted
    ? calculateInflationAdjustedAmount(amount, date, portfolioStartDate, inflationRate)
    : amount

  const newEntry = {
    amount: existingEntry.amount + adjustedAmount,
    transactionIds:
      transactionId !== undefined
        ? [...existingEntry.transactionIds, transactionId]
        : existingEntry.transactionIds,
  }

  map.set(dateString, newEntry)
}

export function addTransaction(
  map: TransactionMap,
  transaction: Omit<Transaction, 'type'>,
  portfolioStartDate: string,
  inflationRate = 0,
): void {
  if (typeof transaction.repeat !== 'number') {
    addSingleEvent(
      map,
      formatDate(new Date(transaction.date)),
      transaction.amount,
      portfolioStartDate,
      inflationRate,
      transaction.inflation_adjusted,
      transaction.id,
    )
  } else if (
    typeof transaction.repeat_unit === 'string' &&
    typeof transaction.repeat === 'number' &&
    typeof transaction.end_date === 'string'
  ) {
    for (
      let date = new Date(transaction.date);
      date <= new Date(transaction.end_date);
      date = incrementDate(date, transaction.repeat_unit, transaction.repeat)
    ) {
      addSingleEvent(
        map,
        formatDate(date),
        transaction.amount,
        portfolioStartDate,
        inflationRate,
        transaction.inflation_adjusted,
        transaction.id,
      )
    }
  }
}
