import { describe, expect, it } from 'vitest'

import { effectiveLanguage } from './profile-options'

describe('effectiveLanguage', () => {
  it('follows the locale when the profile has no language', () => {
    expect(effectiveLanguage(undefined, 'cs')).toBe('cs')
    expect(effectiveLanguage(undefined, 'en')).toBe('en')
  })

  it('prefers the profile language over the locale', () => {
    expect(effectiveLanguage('en', 'cs')).toBe('en')
    expect(effectiveLanguage('cs', 'en')).toBe('cs')
  })

  it('falls back to English when the locale is missing or unsupported', () => {
    expect(effectiveLanguage(undefined, undefined)).toBe('en')
    expect(effectiveLanguage(undefined, 'hu')).toBe('en')
  })
})
