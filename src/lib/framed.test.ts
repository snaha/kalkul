import { describe, expect, it } from 'vitest'

import { isFramed } from './framed'

describe('isFramed', () => {
  it('is false for a top-level window, which is its own top', () => {
    const top = {}
    expect(isFramed({ top, self: top })).toBe(false)
  })

  it('is true for a window whose top is another window', () => {
    expect(isFramed({ top: {}, self: {} })).toBe(true)
  })

  it('is true for a detached frame, whose top is null', () => {
    // The DOM reports a detached frame's top as null.
    expect(isFramed({ top: null, self: {} })).toBe(true)
  })
})
