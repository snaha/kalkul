import { describe, expect, it } from 'vitest'

import { downloadsHeld } from './download-hold'

describe('downloadsHeld', () => {
  it('holds on pages whose editors keep their own copy of the data', () => {
    expect(downloadsHeld('/(app)/financial-data/investments', false)).toBe(true)
    expect(downloadsHeld('/(app)/financial-data/cash', false)).toBe(true)
    expect(downloadsHeld('/(onboarding)/finances/edit/income', false)).toBe(true)
    expect(downloadsHeld('/(onboarding)/profile', false)).toBe(true)
    expect(downloadsHeld('/(app)/plan/[id]/settings', false)).toBe(true)
  })

  it('holds while any dialog is open, wherever it is', () => {
    expect(downloadsHeld('/(app)', true)).toBe(true)
    expect(downloadsHeld('/(app)/plan/[id]', true)).toBe(true)
  })

  it('lets downloads through on pages that only show the data', () => {
    expect(downloadsHeld('/(app)', false)).toBe(false)
    expect(downloadsHeld('/(app)/financial-data', false)).toBe(false)
    expect(downloadsHeld('/(app)/plan/[id]', false)).toBe(false)
    expect(downloadsHeld('/(app)/history', false)).toBe(false)
    // Settings saves each field on its own, on top of the current data.
    expect(downloadsHeld('/(app)/settings', false)).toBe(false)
    expect(downloadsHeld(undefined, false)).toBe(false)
  })
})
