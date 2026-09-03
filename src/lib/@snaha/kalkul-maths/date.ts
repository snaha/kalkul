import {
  addDays as dfnsAddDays,
  formatDate as dfnsFormatDate,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns'

export function formatDate(date: Date): string {
  return dfnsFormatDate(date, 'yyyy-MM-dd')
}

/**
 * Whole days between two date-only ISO strings (`YYYY-MM-DD`).
 *
 * Counted in calendar days, not 24-hour spans: local-midnight timestamps either
 * side of a daylight-saving change differ by a whole number of days minus an
 * hour, which truncates to one day short.
 */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

/**
 * `days` after a date-only ISO string, as another date-only string. Calendar
 * arithmetic for the same reason `daysBetween` uses it.
 */
export function addDays(dateOnly: string, days: number): string {
  return formatDate(dfnsAddDays(parseISO(dateOnly), days))
}
