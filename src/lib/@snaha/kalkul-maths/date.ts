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
export function daysBetween(from: string, to: string): number {
  const utcMidnight = (dateOnly: string) => {
    const [year, month, day] = dateOnly.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return (utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY
}
