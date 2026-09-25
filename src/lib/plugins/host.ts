import { appStore } from '$lib/stores/app.svelte'

import type { PluginHost } from './types'

/** The app's side of the plugin contract. */
export const pluginHost: PluginHost = {
  exportData: () => appStore.exportBackup(),
  replaceData: (json) => appStore.replaceData(json),
  onDataChange: (listener) => {
    const unsubscribe = appStore.onDataChange(listener)
    listener({ lastUpdated: appStore.lastUpdated, source: 'load' })
    return unsubscribe
  },
}
