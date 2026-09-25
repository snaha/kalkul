import { untrack } from 'svelte'

import { browser } from '$app/environment'
import { page } from '$app/state'

import { downloadsHeld } from '$lib/cloud-backup/download-hold'
import { deviceName, folderFiles } from '$lib/cloud-backup/folder-files'
import * as persistence from '$lib/cloud-backup/persistence'
import { createSaveScheduler } from '$lib/cloud-backup/save-scheduler'
import {
  type SyncDeps,
  type SyncOutcome,
  resolveConflict,
  syncOnce,
} from '$lib/cloud-backup/sync-engine'
import {
  type CloudBackupStatus,
  shouldAutoSync,
  statusForError,
  statusForOutcome,
} from '$lib/cloud-backup/sync-status'

import { appStore } from './app.svelte'

/** Serialises sync rounds across every tab of the origin. */
const LOCK = 'kalkul-backup-folder'
/** Tells the other tabs to re-read the shared state (connect, access…). */
const CHANNEL = 'kalkul-backup-folder'
/** Edits are written once they pause this long… */
const SAVE_IDLE_MS = 10 * 1000
/** …or at the latest this long after the first unsaved one. */
const SAVE_MAX_WAIT_MS = 60 * 1000
/** How often an open, visible tab looks for other computers' changes. */
const POLL_MS = 30 * 1000
const READWRITE = { mode: 'readwrite' } as const

/**
 * Whether a bits-ui dialog (they all render role="dialog") is open — other
 * than the backup's own naming dialog, which holds no copy of the data.
 */
function dialogOpen(): boolean {
  return (
    document.querySelector('[role="dialog"][data-state="open"]:not([data-backup-dialog])') !== null
  )
}

function held(): boolean {
  return downloadsHeld(page.route.id ?? undefined, dialogOpen())
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

/** Whether the folder itself is still there (not just one file in it). */
async function folderReachable(directory: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await directory.values().next()
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

/**
 * PR previews (hash router) run on kalkul.app's own origin, so they must
 * never reach the user's real backup folder.
 */
const enabled = import.meta.env.VITE_ROUTER !== 'hash'
/** Editing files on disk is Chromium-only (Chrome, Edge, Brave, Arc, Opera). */
const supported = browser && typeof window.showDirectoryPicker === 'function'
const available = enabled && supported

function withCloudBackupStore() {
  let status = $state<CloudBackupStatus>({ kind: 'disconnected' })
  let lastSyncedAt = $state<number | undefined>(undefined)
  let connection = $state<persistence.Connection | undefined>(undefined)
  /** An edit is waiting out the debounce before it is written. */
  let pending = $state(false)
  /** The last download from another computer, for the "Updated from…" notice. */
  let lastPull = $state<{ device: string; at: number } | undefined>(undefined)
  /** lastUpdated right after a download: that change is not an edit to save. */
  let pulledStamp = 0
  // Between choosing a folder and naming this computer for a new connection.
  let pendingDirectory: FileSystemDirectoryHandle | undefined
  let channel: BroadcastChannel | undefined

  function deps(device: string, directory: FileSystemDirectoryHandle): SyncDeps {
    return {
      files: folderFiles(directory),
      device,
      now: () => Date.now(),
      local: {
        stamp: () => appStore.lastUpdated,
        canReplace: () => !held(),
        export: () => appStore.exportBackup(),
        import: (json) => {
          appStore.replaceData(json)
          // Set in the same tick as the change, before the lastUpdated effect
          // runs, so the download is not scheduled for upload as an edit.
          pulledStamp = appStore.lastUpdated
        },
      },
      state: {
        load: () => persistence.load('sync'),
        save: (next) => persistence.save('sync', next),
      },
    }
  }

  /** Runs one round under the cross-tab lock, reading all state fresh. */
  async function run(round: (deps: SyncDeps) => Promise<SyncOutcome>): Promise<void> {
    await navigator.locks.request(LOCK, async () => {
      connection = await persistence.load('connection')
      const directory = await persistence.load('directory')
      if (!connection || !directory) {
        status = { kind: 'disconnected' }
        return
      }
      if ((await directory.queryPermission(READWRITE)) !== 'granted') {
        status = { kind: 'needs-permission' }
        return
      }
      // A conflict stays on screen while background rounds re-check it, so
      // the user's half-made choice is not swept away every 30 seconds.
      if (status.kind !== 'conflict') status = { kind: 'syncing' }
      try {
        const outcome = await round(deps(connection.device, directory))
        if (outcome.kind === 'pulled') lastPull = { device: outcome.device, at: Date.now() }
        status = statusForOutcome(outcome)
      } catch (error) {
        console.error('Backup folder sync failed', error)
        status =
          isNotFound(error) && !(await folderReachable(directory))
            ? { kind: 'folder-missing' }
            : statusForError(error)
      }
      lastSyncedAt = (await persistence.load('sync'))?.syncedAt
    })
  }

  function syncNow(): Promise<void> {
    // Any round writes the waiting edits too.
    saves.cancel()
    pending = false
    return run(syncOnce)
  }

  const saves = createSaveScheduler(() => void syncNow(), {
    idleMs: SAVE_IDLE_MS,
    maxWaitMs: SAVE_MAX_WAIT_MS,
  })

  function announce(): void {
    channel?.postMessage('changed')
  }

  async function refresh(): Promise<void> {
    connection = await persistence.load('connection')
    if (!connection) {
      status = { kind: 'disconnected' }
      lastSyncedAt = undefined
      return
    }
    await syncNow()
  }

  return {
    /** Whether the feature shows at all (off on PR previews). */
    get enabled() {
      return enabled
    },
    /** Whether this browser can use a backup folder. */
    get supported() {
      return supported
    },
    get status() {
      return status
    },
    get lastSyncedAt() {
      return lastSyncedAt
    },
    get pending() {
      return pending
    },
    get lastPull() {
      return lastPull
    },
    /** The folder and this computer's name, while connected. */
    get connection() {
      return connection
    },

    /** Wires the background triggers. Returns the cleanup. */
    init(): () => void {
      if (!available) return () => {}

      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = () => void refresh()

      let first = true
      const stopEffects = $effect.root(() => {
        $effect(() => {
          // Every persisted change moves lastUpdated, in this tab or (through
          // the storage event) in another one.
          const stamp = appStore.lastUpdated
          untrack(() => {
            if (first) {
              first = false
              return
            }
            if (stamp === pulledStamp || !shouldAutoSync(status)) return
            pending = true
            saves.changed()
          })
        })
      })

      // A held download is applied as soon as nothing holds it any more
      // (the dialog closed, the editing page was left), not at the next poll.
      const release = setInterval(() => {
        if (status.kind === 'held' && !held()) void syncNow()
      }, 1000)

      const onVisible = () => {
        if (document.visibilityState === 'visible' && shouldAutoSync(status)) void syncNow()
      }
      // Leaving the tab (or closing it) writes waiting edits straight away.
      const onHidden = () => {
        if (document.visibilityState === 'hidden') saves.flush()
      }
      const onPageHide = () => saves.flush()
      document.addEventListener('visibilitychange', onVisible)
      document.addEventListener('visibilitychange', onHidden)
      window.addEventListener('pagehide', onPageHide)
      const poll = setInterval(onVisible, POLL_MS)

      void refresh()

      return () => {
        stopEffects()
        clearInterval(release)
        saves.cancel()
        clearInterval(poll)
        document.removeEventListener('visibilitychange', onVisible)
        document.removeEventListener('visibilitychange', onHidden)
        window.removeEventListener('pagehide', onPageHide)
        channel?.close()
        channel = undefined
      }
    },

    /**
     * First half of connecting: the folder picker. Must be called straight
     * from a click. Resolves false when the user closes the picker.
     */
    async beginConnect(): Promise<boolean> {
      try {
        pendingDirectory = await window.showDirectoryPicker!({ id: 'kalkul-backup', ...READWRITE })
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return false
        throw error
      }
    },

    /**
     * The same, for a folder dragged onto the page. Asks for write access
     * while the drop still counts as a user gesture; `finishConnect` asks
     * again from its click if the browser wanted a separate one.
     */
    async beginConnectDropped(directory: FileSystemDirectoryHandle): Promise<void> {
      try {
        await directory.requestPermission(READWRITE)
      } catch {
        // No gesture left; the naming dialog's click asks instead.
      }
      pendingDirectory = directory
    },

    /**
     * Second half: starts backing up to the chosen folder. A new connection
     * names this computer after `computerLabel`; choosing the folder again
     * (it went missing) keeps the existing name.
     */
    async finishConnect(computerLabel: string | undefined): Promise<void> {
      const directory = pendingDirectory
      if (!directory) throw new Error('Connect was not started')
      if ((await directory.queryPermission(READWRITE)) !== 'granted') {
        if ((await directory.requestPermission(READWRITE)) !== 'granted') {
          throw new DOMException('Folder access was not granted', 'NotAllowedError')
        }
      }
      pendingDirectory = undefined
      const device = computerLabel !== undefined ? deviceName(computerLabel) : connection?.device
      await persistence.save('directory', directory)
      await persistence.remove('sync')
      await persistence.save('connection', {
        device: device ?? deviceName(''),
        folder: directory.name,
      })
      announce()
      await syncNow()
    },

    cancelConnect(): void {
      pendingDirectory = undefined
    },

    /** Asks the browser for the folder again, e.g. after a restart. Call from a click. */
    async allowAccess(): Promise<void> {
      const directory = await persistence.load('directory')
      if (!directory) return
      if ((await directory.requestPermission(READWRITE)) !== 'granted') return
      announce()
      await syncNow()
    },

    syncNow,

    resolve(keep: 'local' | 'remote'): Promise<void> {
      return run((deps) => resolveConflict(deps, keep))
    },

    /** Stops backing up from this browser. The folder and its files stay. */
    async disconnect(): Promise<void> {
      saves.cancel()
      pending = false
      await persistence.clearAll()
      status = { kind: 'disconnected' }
      connection = undefined
      lastSyncedAt = undefined
      lastPull = undefined
      announce()
    },
  }
}

export const cloudBackupStore = withCloudBackupStore()
