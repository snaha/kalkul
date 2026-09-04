// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import storageKeys from '$lib/storage-keys'

import { themeStore } from './theme.svelte'

describe('themeStore', () => {
  let backing: Map<string, string>
  let systemDark: boolean

  beforeEach(() => {
    backing = new Map<string, string>()
    systemDark = false
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value)
      },
    })
    window.matchMedia = () =>
      ({
        matches: systemDark,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies a stored dark theme on init', () => {
    backing.set(storageKeys.THEME, 'dark')
    themeStore.init()
    expect(themeStore.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to system for an unknown stored value and follows the OS', () => {
    backing.set(storageKeys.THEME, 'sepia')
    systemDark = true
    themeStore.init()
    expect(themeStore.theme).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('set() persists the choice and toggles the class', () => {
    themeStore.set('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    themeStore.set('light')
    expect(backing.get(storageKeys.THEME)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
