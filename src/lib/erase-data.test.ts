import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EVENTS, track } from '$lib/analytics'
import storageKeys from '$lib/storage-keys'
import { appStore } from '$lib/stores/app.svelte'

import eraseData from './erase-data'

vi.mock('$lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/analytics')>()),
  track: vi.fn(),
}))

let backing: Map<string, string>

beforeEach(() => {
  backing = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.get(key),
    setItem: (key: string, value: string) => {
      backing.set(key, value)
    },
    removeItem: (key: string) => {
      backing.delete(key)
    },
  })
  backing.set(storageKeys.THEME, 'dark')
  backing.set(storageKeys.LOCALE, 'cs')
  appStore.importBackup(
    JSON.stringify({
      profile: { name: 'Jane Doe', email: '' },
      portfolios: [],
    }),
  )
  vi.mocked(track).mockClear()
})

afterEach(() => {
  appStore.clear()
  vi.unstubAllGlobals()
})

describe('eraseData', () => {
  it('keeps the theme and language picked in this browser', () => {
    eraseData()

    expect(backing.get(storageKeys.THEME)).toBe('dark')
    expect(backing.get(storageKeys.LOCALE)).toBe('cs')
  })

  it('reports the erase', () => {
    eraseData()

    expect(vi.mocked(track).mock.calls).toEqual([[EVENTS.DATA_ERASED]])
  })
})
