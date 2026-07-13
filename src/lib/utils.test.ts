import { describe, expect, it } from 'vitest'

import {
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyCode,
  formatNumber,
  getFormattingLocale,
  parseDateOnly,
  toDateOnlyString,
} from './utils'

describe('getFormattingLocale', () => {
  it('maps a known country to its locale', () => {
    expect(getFormattingLocale('CZ', undefined)).toBe('cs-CZ')
  })

  it('falls back to the browser locale when country is unset', () => {
    expect(getFormattingLocale(undefined, 'cs')).toBe('cs')
  })

  it('falls back to the app default instead of undefined (no OS-locale leak, issue #41)', () => {
    expect(getFormattingLocale(undefined, undefined)).toBe('en')
    expect(getFormattingLocale('XX', undefined)).toBe('en')
  })
})

describe('formatCompactCurrency', () => {
  it('does not emit Hungarian compact format for an explicit locale (issue #41)', () => {
    expect(formatCompactCurrency(150200, 'EUR', 'en')).not.toContain('E EUR')
  })
})

describe('cached formatters', () => {
  it('returns stable results on repeated calls', () => {
    expect(formatCurrency(1234567, 'USD', 'en-US')).toBe('$1,234,567')
    expect(formatCurrency(1234567, 'USD', 'en-US')).toBe('$1,234,567')
    expect(formatNumber(1234.5678, 'en-US')).toBe('1,234.5678')
    expect(formatNumber(1234.5678, 'en-US')).toBe('1,234.5678')
  })

  it('does not mix up formatters with the same locale and currency but different options', () => {
    expect(formatCurrency(1000, 'USD', 'en-US')).toBe('$1,000')
    expect(formatCurrencyCode(1000, 'USD', 'en-US')).toBe('USD\u00a01,000')
    expect(formatCompactCurrency(1500, 'USD', 'en-US')).toBe('$1.5K')
    expect(formatCurrency(1000, 'USD', 'en-US')).toBe('$1,000')
  })

  it('distinguishes locales and currencies in the cache', () => {
    expect(formatCurrency(1000, 'CZK', 'cs-CZ')).toBe('1\u00a0000\u00a0Kč')
    expect(formatCurrency(1000, 'EUR', 'cs-CZ')).toBe('1\u00a0000\u00a0€')
    expect(formatCurrency(1000, 'CZK', 'en-US')).toBe('CZK\u00a01,000')
  })

  it('falls back for unsupported currency codes', () => {
    expect(formatCurrency(1000, 'NOTACURRENCY', 'en-US')).toBe('1,000 NOTACURRENCY')
  })

  it('renders negative zero as plain 0 (e.g. a negated zero liabilities total)', () => {
    expect(formatNumber(-0, 'en-US')).toBe('0')
    expect(formatCurrency(-0, 'USD', 'en-US')).toBe('$0')
    expect(formatCurrencyCode(-0, 'USD', 'en-US')).toBe('USD 0')
    expect(formatCompactCurrency(-0, 'USD', 'en-US')).toBe('$0.0')
  })

  it('keeps the minus sign for real negative values', () => {
    expect(formatCurrencyCode(-5000, 'USD', 'en-US')).toBe('-USD 5,000')
  })
})

// These pass in every timezone; `new Date('YYYY-MM-DD')` (UTC parse) and
// `toISOString()` (UTC encode) would fail them in non-UTC timezones.
describe('parseDateOnly', () => {
  it('parses into local components without a UTC shift', () => {
    const date = parseDateOnly('1985-03-01')
    expect(date.getFullYear()).toBe(1985)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(1)
  })
})

describe('toDateOnlyString', () => {
  it('encodes local components without a UTC shift', () => {
    expect(toDateOnlyString(new Date(1985, 2, 1))).toBe('1985-03-01')
  })

  it('zero-pads month and day', () => {
    expect(toDateOnlyString(new Date(2000, 10, 9))).toBe('2000-11-09')
  })

  it('round-trips with parseDateOnly (no drift on repeated save/load)', () => {
    expect(toDateOnlyString(parseDateOnly('1985-03-01'))).toBe('1985-03-01')
    expect(toDateOnlyString(parseDateOnly('1990-01-01'))).toBe('1990-01-01')
  })
})
