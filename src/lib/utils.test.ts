import { describe, expect, it } from 'vitest'

import { formatCompactCurrency, getFormattingLocale } from './utils'

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
