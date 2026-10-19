import { describe, expect, it } from 'vitest'

import { changedFields } from './changed-fields'

describe('changedFields', () => {
  it('keeps only the fields whose value changed', () => {
    expect(
      changedFields({ name: 'Jane', currency: 'CZK' }, { name: 'Eva', currency: 'CZK' }),
    ).toEqual({ name: 'Eva' })
  })

  it('is empty when nothing changed', () => {
    expect(changedFields({ name: 'Jane', amount: 5 }, { name: 'Jane', amount: 5 })).toEqual({})
  })

  it('keeps a field that was cleared, so the clearing is saved', () => {
    const changed = changedFields<{ location?: string }>(
      { location: 'CZ' },
      { location: undefined },
    )
    expect(changed).toEqual({ location: undefined })
    expect('location' in changed).toBe(true)
  })

  it('keeps a field that was set for the first time', () => {
    expect(changedFields<{ location?: string }>({}, { location: 'CZ' })).toEqual({ location: 'CZ' })
  })

  it('compares nested values by content, not by reference', () => {
    const seed = { schedule: { every: 1, unit: 'month' }, tags: ['a'] }
    expect(changedFields(seed, { schedule: { every: 1, unit: 'month' }, tags: ['a'] })).toEqual({})
    expect(changedFields(seed, { schedule: { every: 2, unit: 'month' }, tags: ['a'] })).toEqual({
      schedule: { every: 2, unit: 'month' },
    })
  })

  it('ignores the key order of nested values', () => {
    expect(changedFields({ range: { from: 1, to: 2 } }, { range: { to: 2, from: 1 } })).toEqual({})
  })
})
