import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSaveScheduler } from './save-scheduler'

const IDLE = 10_000
const MAX_WAIT = 60_000

describe('createSaveScheduler', () => {
  let save: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    save = vi.fn<() => void>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function scheduler() {
    return createSaveScheduler(save, { idleMs: IDLE, maxWaitMs: MAX_WAIT })
  }

  it('saves once, after the edits stop for the idle time', () => {
    const s = scheduler()
    s.changed()
    vi.advanceTimersByTime(4000)
    s.changed()
    vi.advanceTimersByTime(IDLE - 1)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves at least once per max wait while edits keep coming', () => {
    const s = scheduler()
    for (let elapsed = 0; elapsed < 150_000; elapsed += 5000) {
      s.changed()
      vi.advanceTimersByTime(5000)
    }
    // Edits every 5 s never leave a 10 s gap; the max wait still saves at
    // 60 s and 120 s.
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('saves right away on flush, and only when something is waiting', () => {
    const s = scheduler()
    s.flush()
    expect(save).not.toHaveBeenCalled()
    s.changed()
    s.flush()
    expect(save).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(IDLE)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reports whether a save is waiting', () => {
    const s = scheduler()
    expect(s.pending).toBe(false)
    s.changed()
    expect(s.pending).toBe(true)
    vi.advanceTimersByTime(IDLE)
    expect(s.pending).toBe(false)
  })

  it('drops a waiting save on cancel', () => {
    const s = scheduler()
    s.changed()
    s.cancel()
    vi.advanceTimersByTime(MAX_WAIT)
    expect(save).not.toHaveBeenCalled()
    expect(s.pending).toBe(false)
  })
})
