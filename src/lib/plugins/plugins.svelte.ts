import { untrack } from 'svelte'

import { browser } from '$app/environment'

import storageKeys from '$lib/storage-keys'

import { registeredPlugins } from './registry'
import type { KalkulPlugin } from './types'

/**
 * Which plugins are on. Every plugin starts off; the dev page turns them on
 * per browser (localStorage), and the choice follows to other open tabs.
 */
export function createPluginStore(plugins: KalkulPlugin[]) {
  function readEnabled(): string[] {
    if (!browser) return []
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKeys.PLUGINS) ?? '[]')
      return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  }

  let enabled = $state<string[]>(readEnabled())

  function isActive(plugin: KalkulPlugin): boolean {
    return enabled.includes(plugin.id) && plugin.unavailableReason === undefined
  }

  return {
    /** Every registered plugin, on or off. */
    get all(): KalkulPlugin[] {
      return plugins
    },

    /** The plugins that are on and can run here, in registration order. */
    get active(): KalkulPlugin[] {
      return plugins.filter(isActive)
    },

    isEnabled(id: string): boolean {
      return enabled.includes(id)
    },

    setEnabled(id: string, on: boolean): void {
      const others = enabled.filter((other) => other !== id)
      enabled = on ? [...others, id] : others
      localStorage.setItem(storageKeys.PLUGINS, JSON.stringify(enabled))
    },

    /**
     * Runs each active plugin's background work, starting and stopping it as
     * plugins are turned on and off. Returns the cleanup.
     */
    start(): () => void {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKeys.PLUGINS) enabled = readEnabled()
      }
      window.addEventListener('storage', onStorage)
      const stop = $effect.root(() => {
        for (const plugin of plugins) {
          const start = plugin.start
          if (!start) continue
          // Its own flag, so turning another plugin on or off leaves it running.
          const on = $derived(isActive(plugin))
          $effect(() => {
            if (!on) return
            return untrack(start)
          })
        }
      })
      return () => {
        stop()
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}

export const pluginStore = createPluginStore(registeredPlugins)
