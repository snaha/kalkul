import { _ } from 'svelte-i18n'
import { get } from 'svelte/store'

import type { KalkulPlugin, PluginHost } from '../types'
import ComputerNameDialog from './computer-name-dialog.svelte'
import DropHint from './drop-hint.svelte'
import LandingHint from './landing-hint.svelte'
import cs from './locales/cs.json'
import en from './locales/en.json'
import SettingsLabel from './settings-label.svelte'
import SettingsSection from './settings-section.svelte'
import StatusIndicator from './status-indicator.svelte'
import { backupFolderStore } from './store.svelte'

/**
 * Automatic backup to a folder the user picks — typically one in iCloud
 * Drive or Dropbox, which then keeps every connected computer in sync.
 * Everything it needs lives in this folder; see `sync-engine.ts` for how a
 * round decides what to do and `store.svelte.ts` for when rounds run.
 */
export function backupFolderPlugin(host: PluginHost): KalkulPlugin {
  backupFolderStore.attach(host)
  return {
    id: 'backup-folder',
    name: 'Automatic backup to a folder',
    description:
      'Saves the data to a folder on disk (e.g. in iCloud Drive or Dropbox) and keeps every computer connected to it in sync. Chromium browsers only.',
    // PR previews (hash router) run on kalkul.app's own origin, so they must
    // never reach the user's real backup folder.
    unavailableReason:
      import.meta.env.VITE_ROUTER === 'hash'
        ? "Off on PR previews: they share kalkul.app's origin, and with it the real backup folder."
        : undefined,
    messages: { en, cs },
    start: backupFolderStore.start,
    root: ComputerNameDialog,
    navbar: StatusIndicator,
    settings: { label: SettingsLabel, section: SettingsSection },
    landingHint: LandingHint,
    folderDrop: {
      hint: DropHint,
      async drop(directory) {
        if (!backupFolderStore.supported) {
          alert(get(_)('plugins.backupFolder.drop.unsupported'))
          return
        }
        if (!backupFolderStore.connectable) {
          alert(get(_)('plugins.backupFolder.drop.alreadyConnected'))
          return
        }
        try {
          await backupFolderStore.connectDropped(directory)
        } catch (e) {
          console.error('Could not connect the dropped folder', e)
          alert(get(_)('plugins.backupFolder.settings.error'))
        }
      },
    },
  }
}
