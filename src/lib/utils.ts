import { _ } from 'svelte-i18n'
import { get } from 'svelte/store'

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WithElementRef<T, El extends HTMLElement = HTMLElement> = T & { ref?: El | null }

export type WithoutChild<T> = T extends { child?: infer _C } ? Omit<T, 'child'> : T
export type WithoutChildren<T> = T extends { children?: infer _C } ? Omit<T, 'children'> : T
export type WithoutChildrenOrChild<T> = T extends { children?: infer _C; child?: infer _C2 }
  ? Omit<T, 'children' | 'child'>
  : T

/**
 * Filename-safe slug: lowercase, combining accents stripped, and every
 * remaining non-ASCII-alphanumeric run collapsed to a dash. Letters that do
 * not decompose to ASCII (e.g. "Ł", "ß") are dropped rather than transliterated.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const DEFAULT_CURRENCY = 'EUR'

export const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'CZK', label: 'CZK' },
  { value: 'HUF', label: 'HUF' },
  { value: 'USD', label: 'USD' },
] as const

/** Maps profile country codes to BCP 47 locale tags for number/currency formatting. */
const COUNTRY_LOCALE_MAP: Record<string, string> = {
  CZ: 'cs-CZ',
  SK: 'sk-SK',
  HU: 'hu-HU',
  FR: 'fr-FR',
}

/** Must match defaultLocale in locales/index.ts. Hardcoded here so utils stays free of the i18n init() side effect. */
const DEFAULT_FORMATTING_LOCALE = 'en'

/**
 * Resolve the locale for number/currency formatting.
 * Prefers the profile's country, falls back to browser locale, then the app default.
 * Never returns undefined: passing undefined to Intl leaks the OS locale (e.g. hu-HU).
 */
export function getFormattingLocale(
  country: string | undefined,
  browserLocale: string | undefined,
): string {
  if (country) {
    const mapped = COUNTRY_LOCALE_MAP[country]
    if (mapped) return mapped
  }
  return browserLocale ?? DEFAULT_FORMATTING_LOCALE
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

/**
 * Parse a date-only ISO string (`YYYY-MM-DD`) into a local-midnight Date.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight, so reading local components
 * (`getFullYear`, `getMonth`) shifts the date back a day in negative-UTC-offset
 * timezones — this parses the components directly so no conversion happens.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Encode a Date as a date-only ISO string (`YYYY-MM-DD`) from its local
 * components. `toISOString()` converts to UTC first, which shifts the date
 * back a day in positive-UTC-offset timezones.
 */
export function toDateOnlyString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function notImplemented() {
  alert(get(_)('common.notImplemented'))
}

/**
 * Cache of Intl.NumberFormat instances keyed by locale + options.
 * Constructing a formatter is expensive and these run inside hot $derived
 * chains; the key includes locale and currency, so the cache self-invalidates
 * when the profile or browser locale changes.
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>()

function getNumberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale ?? undefined, options)
    numberFormatCache.set(key, formatter)
  }
  return formatter
}

// -0 renders as "-0" in Intl.NumberFormat (e.g. a negated zero liabilities
// total); money displays should show plain 0
const unsignZero = (value: number) => (value === 0 ? 0 : value)

export function formatNumber(value: number, locale?: string): string {
  return getNumberFormat(locale, { maximumFractionDigits: 4 }).format(unsignZero(value))
}

export function formatCurrency(value: number, currency: string, locale?: string): string {
  value = unsignZero(value)
  try {
    return getNumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    // Fallback for unsupported currency codes
    return `${value.toLocaleString(locale ?? undefined)} ${currency}`
  }
}

export function formatCurrencyCode(value: number, currency: string, locale?: string): string {
  value = unsignZero(value)
  try {
    return getNumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    // Fallback for unsupported currency codes
    return `${value.toLocaleString(locale ?? undefined)} ${currency}`
  }
}

export function formatCompactCurrency(value: number, currency: string, locale?: string): string {
  value = unsignZero(value)
  try {
    return getNumberFormat(locale, {
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
): number | undefined {
  if (!birthDate) return undefined
  let age = currentYear - birthDate.getFullYear()
  if (currentMonth < birthDate.getMonth()) age--
  return age
}

/**
 * Format a "last updated" timestamp as a locale-aware date string.
 * Returns undefined when the timestamp is unset (0) so callers can render a
 * real "never updated" state instead of silently showing today's date.
 */
export function formatLastUpdated(ms: number, locale: string | undefined): string | undefined {
  if (ms <= 0) return undefined
  return new Date(ms).toLocaleDateString(locale)
}

/**
 * Format an already-percent-scaled value (e.g. 5.3 → "5.3%" / "5,3 %") with
 * locale-aware decimal separator and percent-sign placement.
 */
export function formatPercent(value: number, digits: number, locale?: string): string {
  return getNumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(unsignZero(value) / 100)
}
