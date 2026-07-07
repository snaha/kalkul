import { describe, expect, it } from 'vitest'

import {
  formatCompactCurrency,
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
