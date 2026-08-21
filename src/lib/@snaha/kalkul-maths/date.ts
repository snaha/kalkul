import { formatDate as dfnsFormatDate } from 'date-fns'

export function formatDate(date: Date): string {
  return dfnsFormatDate(date, 'yyyy-MM-dd')
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole days between two date-only ISO strings (`YYYY-MM-DD`). Both are read as
 * UTC midnight so a daylight-saving change between them can't shave an hour off
 * the count — local-midnight timestamps across a spring shift differ by a whole
 * number of days minus one hour, which truncates to one day short.
 */
function utcMidnight(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function daysBetween(from: string, to: string): number {
  return (utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY
}

/**
 * `days` after a date-only ISO string, as another date-only string. Arithmetic
 * stays in UTC for the same reason `daysBetween` does: adding 24-hour steps to a
 * local-midnight date drifts by an hour across a daylight-saving change, which
 * is enough to land on the wrong calendar day.
 */
export function addDays(dateOnly: string, days: number): string {
  const shifted = new Date(utcMidnight(dateOnly) + days * MS_PER_DAY)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${month}-${day}`
}
