import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DataChange } from '$lib/stores/app.svelte'
import { appStore } from '$lib/stores/app.svelte'

import { pluginHost } from './host'

describe('pluginHost.onDataChange', () => {
  const NOW = new Date(2026, 5, 15, 12, 0, 0)
  let changes: DataChange[]
  let unsubscribe: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key),
      setItem: (key: string, value: string) => {
        backing.set(key, value)
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
    appStore.replaceData(JSON.stringify({ profile: { name: 'Jane', email: '' }, portfolios: [] }))
    changes = []
    unsubscribe = pluginHost.onDataChange((change) => changes.push(change))
  })

  afterEach(() => {
    unsubscribe()
    appStore.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reports the data as it stands when subscribing', () => {
    expect(changes).toEqual([{ lastUpdated: NOW.getTime(), source: 'load' }])
  })

  it('then reports every change', () => {
    vi.setSystemTime(NOW.getTime() + 1000)
    appStore.updateProfile({ name: 'Eva' })
    expect(changes.slice(1)).toEqual([{ lastUpdated: NOW.getTime() + 1000, source: 'edit' }])
  })

  it('stops reporting once unsubscribed', () => {
    unsubscribe()
    appStore.updateProfile({ name: 'Eva' })
    expect(changes.length).toBe(1)
  })
})
