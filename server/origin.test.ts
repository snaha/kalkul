import { describe, expect, it } from 'vitest'

import { isAllowedOrigin } from './origin'

describe('isAllowedOrigin', () => {
  it('allows localhost and 127.0.0.1 on any port', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:4173')).toBe(true)
    expect(isAllowedOrigin('http://localhost')).toBe(true)
  })

  it('allows the production site', () => {
    expect(isAllowedOrigin('https://kalkul.app')).toBe(true)
  })

  it('allows extra origins from KALKUL_ORIGINS', () => {
    expect(
      isAllowedOrigin('https://snaha.github.io', 'https://snaha.github.io, https://x.test'),
    ).toBe(true)
    expect(isAllowedOrigin('https://x.test', 'https://snaha.github.io, https://x.test')).toBe(true)
  })

  it('rejects everything else, including a missing header', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
    expect(isAllowedOrigin('https://kalkul.app.evil.example')).toBe(false)
    expect(isAllowedOrigin('http://localhost.evil.example')).toBe(false)
    expect(isAllowedOrigin(undefined)).toBe(false)
  })
})
