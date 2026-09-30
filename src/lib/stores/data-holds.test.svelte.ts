// @vitest-environment happy-dom
import { flushSync } from 'svelte'

import { describe, expect, it } from 'vitest'

import { dataHolds, holdData } from './data-holds.svelte'

describe('dataHolds', () => {
  it('is held while any hold is registered', () => {
    const first = dataHolds.acquire()
    const second = dataHolds.acquire()
    expect(dataHolds.held).toBe(true)
    first()
    expect(dataHolds.held).toBe(true)
    second()
    expect(dataHolds.held).toBe(false)
  })

  it('releases each hold only once', () => {
    const other = dataHolds.acquire()
    const release = dataHolds.acquire()
    release()
    release()
    expect(dataHolds.held).toBe(true)
    other()
    expect(dataHolds.held).toBe(false)
  })
})

describe('holdData', () => {
  it('holds while its owner is mounted and the condition is true', () => {
    let open = $state(false)
    const unmount = $effect.root(() => {
      holdData(() => open)
    })
    flushSync()
    expect(dataHolds.held).toBe(false)
    open = true
    flushSync()
    expect(dataHolds.held).toBe(true)
    open = false
    flushSync()
    expect(dataHolds.held).toBe(false)
    open = true
    flushSync()
    unmount()
    expect(dataHolds.held).toBe(false)
  })
})
