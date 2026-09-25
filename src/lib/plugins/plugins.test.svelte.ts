// @vitest-environment happy-dom
import { flushSync } from 'svelte'

import { beforeEach, describe, expect, it } from 'vitest'

import storageKeys from '$lib/storage-keys'

import { createPluginStore } from './plugins.svelte'
import type { KalkulPlugin } from './types'

function plugin(id: string, extra: Partial<KalkulPlugin> = {}): KalkulPlugin {
  return { id, name: id, description: '', messages: {}, ...extra }
}

/** A plugin whose background work records when it runs. */
function running(id: string, log: string[]): KalkulPlugin {
  return plugin(id, {
    start: () => {
      log.push(`start ${id}`)
      return () => log.push(`stop ${id}`)
    },
  })
}

describe('createPluginStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with every plugin off', () => {
    const store = createPluginStore([plugin('a'), plugin('b')])
    expect(store.active).toEqual([])
    expect(store.all.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('turns plugins on and off, remembering the choice', () => {
    const store = createPluginStore([plugin('a'), plugin('b')])
    store.setEnabled('b', true)
    store.setEnabled('b', true)
    expect(store.active.map((p) => p.id)).toEqual(['b'])
    expect(createPluginStore([plugin('a'), plugin('b')]).isEnabled('b')).toBe(true)
    store.setEnabled('b', false)
    expect(store.active).toEqual([])
    expect(localStorage.getItem(storageKeys.PLUGINS)).toBe('[]')
  })

  it('keeps registration order, whatever order they were turned on in', () => {
    const store = createPluginStore([plugin('a'), plugin('b')])
    store.setEnabled('b', true)
    store.setEnabled('a', true)
    expect(store.active.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('leaves out a plugin that cannot run here, even when turned on', () => {
    const store = createPluginStore([plugin('a', { unavailableReason: 'not here' })])
    store.setEnabled('a', true)
    expect(store.isEnabled('a')).toBe(true)
    expect(store.active).toEqual([])
  })

  it('ignores a stored value that is not a list of ids', () => {
    localStorage.setItem(storageKeys.PLUGINS, '{"a":true}')
    expect(createPluginStore([plugin('a')]).active).toEqual([])
    localStorage.setItem(storageKeys.PLUGINS, 'not json')
    expect(createPluginStore([plugin('a')]).active).toEqual([])
  })

  it("runs an active plugin's background work, and stops it when turned off", () => {
    const log: string[] = []
    const store = createPluginStore([running('a', log), running('b', log)])
    store.setEnabled('a', true)
    const stop = store.start()
    flushSync()
    expect(log).toEqual(['start a'])
    store.setEnabled('b', true)
    flushSync()
    store.setEnabled('a', false)
    flushSync()
    expect(log).toEqual(['start a', 'start b', 'stop a'])
    stop()
    expect(log).toEqual(['start a', 'start b', 'stop a', 'stop b'])
  })

  it('follows a change made in another tab', () => {
    const log: string[] = []
    const store = createPluginStore([running('a', log)])
    const stop = store.start()
    localStorage.setItem(storageKeys.PLUGINS, '["a"]')
    window.dispatchEvent(new StorageEvent('storage', { key: storageKeys.PLUGINS }))
    flushSync()
    expect(store.active.map((p) => p.id)).toEqual(['a'])
    expect(log).toEqual(['start a'])
    stop()
  })
})
