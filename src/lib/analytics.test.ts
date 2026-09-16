import { afterEach, describe, expect, it, vi } from 'vitest'

import { EVENTS, identify, track, trackerLoaded } from './analytics'
import storageKeys from './storage-keys'

const umami = { track: vi.fn(), identify: vi.fn() }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('track', () => {
  it('forwards to the tracker once it is loaded', () => {
    vi.stubGlobal('umami', umami)
    track(EVENTS.PLAN_CREATED)
    expect(umami.track).toHaveBeenCalledWith('plan-created', undefined)
  })

  it('holds events sent before the tracker script has run', () => {
    track(EVENTS.APP_OPEN, { plans: 2 })
    vi.stubGlobal('umami', umami)
    expect(umami.track).not.toHaveBeenCalled()
    trackerLoaded()
    expect(umami.track).toHaveBeenCalledWith('app-open', { plans: 2 })
  })
})

describe('identify', () => {
  it('mints one random id per browser and reuses it', () => {
    const backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key),
      setItem: (key: string, value: string) => backing.set(key, value),
    })
    vi.stubGlobal('umami', umami)

    identify()
    identify()

    const id = backing.get(storageKeys.ANALYTICS_ID)
    expect(id).toHaveLength(36)
    expect(umami.identify).toHaveBeenCalledTimes(2)
    expect(umami.identify).toHaveBeenNthCalledWith(1, id)
    expect(umami.identify).toHaveBeenNthCalledWith(2, id)
  })
})
