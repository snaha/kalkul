import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  formatDate as dfnsFormatDate,
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
} from 'date-fns'

import type { Period } from './types'

export function formatDate(date: Date): string {
  return dfnsFormatDate(date, 'yyyy-MM-dd')
}

export function incrementDate(date: Date, period: Period, count = 1) {
  switch (period) {
    case 'day':
      return addDays(date, count)
    case 'week':
      return addWeeks(date, count)
    case 'month':
      return addMonths(date, count)
    case 'year':
      return addYears(date, count)
  }
}

export function calculatePeriodDifference(endDate: Date, startDate: Date, period: Period): number {
  switch (period) {
    case 'day':
      return differenceInDays(endDate, startDate)
    case 'week':
      return differenceInWeeks(endDate, startDate)
    case 'month':
      return differenceInMonths(endDate, startDate)
    case 'year':
      return differenceInYears(endDate, startDate)
    default:
      throw new Error('invalidTransactionRepeatUnit')
  }
}
