import { appStore } from '$lib/stores/app.svelte'

import type { PluginHost } from './types'

/** The app's side of the plugin contract. */
export const pluginHost: PluginHost = {
  get lastUpdated() {
    return appStore.lastUpdated
  },
  exportData: () => appStore.exportBackup(),
  validateData: (json) => appStore.validateData(json),
  replaceData: (json) => appStore.replaceData(json),
  formatDateTime: (ms) => appStore.formatDateTime(ms),
}
