import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WithElementRef<T, El extends HTMLElement = HTMLElement> = T & { ref?: El | null }

export type WithoutChild<T> = T extends { child?: infer _C } ? Omit<T, 'child'> : T
export type WithoutChildrenOrChild<T> = T extends { children?: infer _C; child?: infer _C2 }
  ? Omit<T, 'children' | 'child'>
  : T

export const DEFAULT_CURRENCY = 'EUR'

/** Maps profile country codes to BCP 47 locale tags for number/currency formatting. */
const COUNTRY_LOCALE_MAP: Record<string, string> = {
  CZ: 'cs-CZ',
  SK: 'sk-SK',
  HU: 'hu-HU',
  FR: 'fr-FR',
}

/**
 * Resolve the locale for number/currency formatting.
 * Prefers the profile's country, falls back to browser locale.
 */
export function getFormattingLocale(
  country: string | undefined,
  browserLocale: string | undefined,
): string | undefined {
  if (country) {
    const mapped = COUNTRY_LOCALE_MAP[country]
    if (mapped) return mapped
  }
  return browserLocale ?? undefined
}

export function getYearOptions(count = 50): string[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => String(currentYear + i))
}

export function getBirthYearOptions(earliestYear = 1930): string[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - earliestYear + 1 }, (_, i) => String(currentYear - i))
}

export function getMonthOptions(locale?: string): { value: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2000, i).toLocaleString(locale ?? undefined, { month: 'long' }),
  }))
}

export function notImplemented() {
  alert('Not implemented yet')
}

export function formatCurrency(value: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    // Fallback for unsupported currency codes
    return `${value.toLocaleString(locale ?? undefined)} ${currency}`
  }
}

export function formatCompactCurrency(value: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return `${value.toLocaleString(locale ?? undefined)} ${currency}`
  }
}

export function calculateAge(
  birthDate: Date | undefined,
  currentYear: number,
  currentMonth: number,
): string {
  if (!birthDate) return ''
  let age = currentYear - birthDate.getFullYear()
  if (currentMonth < birthDate.getMonth()) age--
  return String(age)
}
