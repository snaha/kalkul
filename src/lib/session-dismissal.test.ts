import { describe, expect, it } from 'vitest'

import { dismiss, isDismissed } from './session-dismissal'

function fakeStorage() {
  const backing = new Map<string, string>()
  return {
    // Storage.getItem answers null for a missing key.
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
  }
}

describe('session dismissal', () => {
  it('is not dismissed until closed', () => {
    expect(isDismissed('bar:plan-1', 'data-a', fakeStorage())).toBe(false)
  })

  it('stays dismissed for the state it was closed in', () => {
    const storage = fakeStorage()
    dismiss('bar:plan-1', 'data-a', storage)
    expect(isDismissed('bar:plan-1', 'data-a', storage)).toBe(true)
  })

  it('returns once the state moves on', () => {
    const storage = fakeStorage()
    dismiss('alert', '2026-09-01', storage)
    expect(isDismissed('alert', '2026-10-01', storage)).toBe(false)
  })

  it('is kept per key', () => {
    const storage = fakeStorage()
    dismiss('bar:plan-1', 'data-a', storage)
    expect(isDismissed('bar:plan-2', 'data-a', storage)).toBe(false)
  })
})
