import { untrack } from 'svelte'

import { browser } from '$app/environment'

import type { PluginHost } from '../types'
import { deviceName, folderFiles } from './folder-files'
import * as persistence from './persistence'
import { createSaveScheduler } from './save-scheduler'
import {
  type SyncDeps,
  type SyncOutcome,
  chooseVersion,
  resolveConflict,
  syncOnce,
} from './sync-engine'
import {
  type BackupFolderStatus,
  awaitsChoice,
  shouldAutoSync,
  statusForError,
  statusForOutcome,
} from './sync-status'

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

/** Editing files on disk is Chromium-only (Chrome, Edge, Brave, Arc, Opera). */
const supported = browser && typeof window.showDirectoryPicker === 'function'

function withBackupFolderStore() {
  /** The app, lent by `attach` when the plugin is built. */
  let host: PluginHost | undefined
  let status = $state<BackupFolderStatus>({ kind: 'disconnected' })
  let lastSyncedAt = $state<number | undefined>(undefined)
  /** When this tab last finished a round, whether or not it moved any data. */
  let lastCheckedAt = $state<number | undefined>(undefined)
  let connection = $state<persistence.Connection | undefined>(undefined)
  /** An edit is waiting out the debounce before it is written. */
  let pending = $state(false)
  /** The last download from another computer, for the "Updated from…" notice. */
  let lastPull = $state<{ device: string; at: number } | undefined>(undefined)
  /** lastUpdated right after a download: that change is not an edit to save. */
  let pulledStamp = 0
  // Between choosing a folder and naming this computer for a new connection.
  let pendingDirectory: FileSystemDirectoryHandle | undefined
  /** The dialog naming this computer is open. */
  let naming = $state(false)
  let channel: BroadcastChannel | undefined

  function app(): PluginHost {
    if (!host) throw new Error('The backup folder plugin has no host')
    return host
  }

  function deps(device: string, directory: FileSystemDirectoryHandle): SyncDeps {
    return {
      files: folderFiles(directory),
      device,
      now: () => Date.now(),
      local: {
        stamp: () => app().lastUpdated,
        export: () => app().exportData(),
        validate: (json) => app().validateData(json),
        import: (json) => {
          app().replaceData(json)
          // Set in the same tick as the change, before the lastUpdated effect
          // runs, so the download is not scheduled for upload as an edit.
          pulledStamp = app().lastUpdated
        },
      },
      state: {
        load: () => persistence.load('sync'),
        save: (next) => persistence.save('sync', next),
      },
      // Only a round that writes or downloads shows as busy: most rounds
      // just look, and should not flash "Saving…" every 30 seconds. A
      // question stays on screen so the user's half-made choice is not
      // swept away.
      transferring: () => {
        if (!awaitsChoice(status)) status = { kind: 'syncing' }
      },
    }
  }

  /**
   * Runs one round under the cross-tab lock, reading all state fresh. Never
   * rejects: background callers fire and forget, so every failure ends up
   * in `status` instead of leaving it on "syncing".
   */
  async function run(round: (deps: SyncDeps) => Promise<SyncOutcome>): Promise<void> {
    try {
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
        // Leaving a state the round is about to replace; any other status
        // (synced, a question…) stays up while the round only looks.
        if (!shouldAutoSync(status)) status = { kind: 'checking' }
        try {
          const outcome = await round(deps(connection.device, directory))
          if (outcome.kind === 'pulled') lastPull = { device: outcome.device, at: Date.now() }
          status = statusForOutcome(outcome)
          lastCheckedAt = Date.now()
        } catch (error) {
          console.error('Backup folder sync failed', error)
          status =
            isNotFound(error) && !(await folderReachable(directory))
              ? { kind: 'folder-missing' }
              : statusForError(error)
        }
        lastSyncedAt = (await persistence.load('sync'))?.syncedAt
      })
    } catch (error) {
      console.error('Backup folder sync failed', error)
      status = statusForError(error)
    }
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

  const store = {
    /** Lends the store the app. Called once, when the plugin is built. */
    attach(next: PluginHost): void {
      host = next
    },
    formatDateTime(ms: number): string {
      return app().formatDateTime(ms)
    },
    /** Whether this browser can use a backup folder. */
    get supported() {
      return supported
    },
    get status() {
      return status
    },
    /** When data last moved between this computer and the folder. */
    get lastSyncedAt() {
      return lastSyncedAt
    },
    get lastCheckedAt() {
      return lastCheckedAt
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
    /** A folder drop can connect: nothing connected yet, or the folder went missing. */
    get connectable(): boolean {
      return supported && (status.kind === 'disconnected' || status.kind === 'folder-missing')
    },
    /** Whether the dialog naming this computer is open. */
    get naming(): boolean {
      return naming
    },
    set naming(open: boolean) {
      naming = open
    },

    /** Wires the background triggers. Returns the cleanup. */
    start(): () => void {
      if (!supported) return () => {}

      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = () => void refresh()

      let first = true
      const stopEffects = $effect.root(() => {
        $effect(() => {
          // Every persisted change moves lastUpdated, in this tab or (through
          // the storage event) in another one.
          const stamp = app().lastUpdated
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
     * names this computer after `computerLabel` and starts from scratch;
     * choosing the folder again (it went missing) keeps the name and what
     * this computer last synced, so edits made meanwhile upload as edits
     * rather than turning into a conflict.
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
      naming = false
      const device = computerLabel !== undefined ? deviceName(computerLabel) : connection?.device
      await persistence.save('directory', directory)
      if (computerLabel !== undefined || !connection) await persistence.remove('sync')
      await persistence.save('connection', {
        device: device ?? deviceName(''),
        folder: directory.name,
      })
      announce()
      await syncNow()
    },

    /**
     * Connects a folder dropped onto the page, asking for this computer's
     * name when it is a new connection.
     */
    async connectDropped(directory: FileSystemDirectoryHandle): Promise<void> {
      await store.beginConnectDropped(directory)
      // The folder went missing and this is it again: keep this computer's name.
      if (connection) await store.finishConnect(undefined)
      else naming = true
    },

    /** After the folder picker: connects, or asks for the name first. */
    async connectChosen(): Promise<void> {
      if (connection) await store.finishConnect(undefined)
      else naming = true
    },

    cancelConnect(): void {
      pendingDirectory = undefined
      naming = false
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

    /** Settles a fork by using the version `hash` from the folder. */
    choose(hash: string): Promise<void> {
      return run((deps) => chooseVersion(deps, hash))
    },

    /**
     * Stops backing up from this browser. The folder and its files stay.
     * Waits for a round in flight, which would otherwise write its result
     * back over the disconnect.
     */
    async disconnect(): Promise<void> {
      saves.cancel()
      pending = false
      await navigator.locks.request(LOCK, async () => {
        await persistence.clearAll()
        status = { kind: 'disconnected' }
        connection = undefined
        lastSyncedAt = undefined
        lastCheckedAt = undefined
        lastPull = undefined
      })
      announce()
    },
  }
  return store
}

export const backupFolderStore = withBackupFolderStore()
