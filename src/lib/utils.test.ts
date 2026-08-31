import { describe, expect, it } from 'vitest'

import {
  calculateAge,
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyCode,
  formatLastUpdated,
  formatNumber,
  formatPercent,
  getFormattingLocale,
  parseDateOnly,
  slugify,
  toDateOnlyString,
} from './utils'

describe('slugify', () => {
  it('lowercases and strips accents', () => {
    expect(slugify('Martin Kováč')).toBe('martin-kovac')
    expect(slugify('Tereza Svobodová')).toBe('tereza-svobodova')
  })

  it('collapses non-alphanumerics and trims dashes', () => {
    expect(slugify('  Bence Tóth (jr.) & co!  ')).toBe('bence-toth-jr-co')
  })

  it('returns an empty string when nothing survives', () => {
    expect(slugify('  ')).toBe('')
    expect(slugify('***')).toBe('')
  })
})

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
  it('emits the exact compact format for an explicit locale (issue #41)', () => {
    // Exact value instead of a negative substring match — the old
    // `.not.toContain('E EUR')` kept passing for any regression short of
    // the one Hungarian-locale bug it was written against.
    expect(formatCompactCurrency(150200, 'EUR', 'en')).toBe('€150.2K')
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
    expect(formatCurrencyCode(1000, 'NOTACURRENCY', 'en-US')).toBe('1,000 NOTACURRENCY')
    expect(formatCompactCurrency(1000, 'NOTACURRENCY', 'en-US')).toBe('1,000 NOTACURRENCY')
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

describe('calculateAge', () => {
  // Onboarding captures only year + month (day fixed to 1), so age is
  // month-granular by design: it increments at the start of the birth month.
  // Months are 0-based here, matching `Date#getMonth()`: the birth month below
  // and every `currentMonth` argument in this block are 0-based, so 5 is June.
  const birthDate = new Date(1990, 5, 1) // June 1990

  it('counts the age as already incremented during the birth month', () => {
    expect(calculateAge(birthDate, 2026, 5)).toBe(36)
  })

  it('is one lower in the month before the birth month', () => {
    expect(calculateAge(birthDate, 2026, 4)).toBe(35)
  })

  it('stays incremented for the rest of the year', () => {
    expect(calculateAge(birthDate, 2026, 11)).toBe(36)
  })

  it('returns an empty string without a birth date', () => {
    expect(calculateAge(undefined, 2026, 5)).toBe(undefined)
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

describe('formatPercent', () => {
  it('formats already-percent-scaled values with locale separators', () => {
    expect(formatPercent(5.3, 1, 'en-US')).toBe('5.3%')
    expect(formatPercent(5.3, 1, 'cs-CZ')).toBe('5,3 %')
    expect(formatPercent(-2.5, 1, 'en-US')).toBe('-2.5%')
    expect(formatPercent(12, 0, 'en-US')).toBe('12%')
  })

  it('renders negative zero as plain 0', () => {
    expect(formatPercent(-0, 1, 'en-US')).toBe('0.0%')
  })
})

describe('formatLastUpdated', () => {
  // Local-midnight date so the expected string is timezone-independent.
  const savedAt = new Date(2026, 6, 7).getTime()

  it('formats the timestamp with the given locale', () => {
    expect(formatLastUpdated(savedAt, 'en-US')).toBe('7/7/2026')
    expect(formatLastUpdated(savedAt, 'cs-CZ')).toBe('7. 7. 2026')
  })

  it('returns undefined when nothing was saved yet instead of faking today', () => {
    expect(formatLastUpdated(0, 'en-US')).toBeUndefined()
    expect(formatLastUpdated(-1, 'en-US')).toBeUndefined()
  })
})
