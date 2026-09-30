import { appStore } from '$lib/stores/app.svelte'

import type { PluginHost } from './types'

/** The app's side of the plugin contract. */
export const pluginHost: PluginHost = {
  exportData: () => appStore.exportBackup(),
  replaceData: (json) => appStore.replaceData(json),
  onDataChange: (listener) => appStore.onDataChange(listener),
}
