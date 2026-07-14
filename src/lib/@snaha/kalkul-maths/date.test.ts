import { describe, expect, it } from 'vitest'

import { formatDate } from './date'

describe('#formatDate', () => {
  it('formats a date to yyyy-MM-dd', () => {
    const date = new Date(2025, 2, 17)
    expect(formatDate(date)).toBe('2025-03-17')
  })
})
