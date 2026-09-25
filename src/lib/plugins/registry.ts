import { addMessages } from 'svelte-i18n'

import { backupFolderPlugin } from './backup-folder'
import { pluginHost } from './host'
import type { KalkulPlugin } from './types'

/**
 * Every plugin the app knows about. Adding a plugin is one line here; the
 * dev page lists them all and turns them on.
 */
export const registeredPlugins: KalkulPlugin[] = [backupFolderPlugin(pluginHost)]

for (const plugin of registeredPlugins) {
  for (const [locale, messages] of Object.entries(plugin.messages)) {
    addMessages(locale, messages)
  }
}
