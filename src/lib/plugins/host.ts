import { appStore } from '$lib/stores/app.svelte'
import { dataHolds } from '$lib/stores/data-holds.svelte'

import type { PluginHost } from './types'

/** The app's side of the plugin contract. */
export const pluginHost: PluginHost = {
  data: {
    get stamp() {
      return appStore.lastUpdated
    },
    export: () => appStore.exportBackup(),
    validate: (json) => appStore.validateData(json),
    replace: (json) => appStore.replaceData(json),
  },
  get dataHeld() {
    return dataHolds.held
  },
  formatDateTime: (ms) => appStore.formatDateTime(ms),
}
