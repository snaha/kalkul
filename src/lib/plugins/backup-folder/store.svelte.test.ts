// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PluginHost } from '../types'
import { type FileStore, appendVersion, headsOf, listVersions } from './backup-log'
import { backupFolderStore } from './store.svelte'

/**
 * Everything the store reaches outside itself, faked in memory: the folder,
 * the IndexedDB records, the app (through the plugin host) and the Web
 * Locks API.
 */
const env = vi.hoisted(() => {
  const env = {
    records: new Map<string, unknown>(),
    /** Makes every persistence read throw, like a broken IndexedDB. */
    failLoad: false,
    folder: new Map<string, string>(),
    folderGone: false,
    /** While set, listing (or creating) folder files waits for it. */
    listGate: undefined as Promise<void> | undefined,
    createGate: undefined as Promise<void> | undefined,
    local: { data: '', stamp: 0 },
    directory: undefined as unknown as FileSystemDirectoryHandle,
  }
  env.directory = {
    name: 'Kalkul backup',
    kind: 'directory',
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    values: () => ({
      next: async () => {
        if (env.folderGone) throw new DOMException('gone', 'NotFoundError')
        return { done: true, value: undefined }
      },
    }),
  } as unknown as FileSystemDirectoryHandle
  // Read when the store module loads: this browser can use a folder.
  window.showDirectoryPicker = async () => env.directory
  return env
})

vi.mock('$app/environment', () => ({ browser: true }))

vi.mock('./persistence', () => ({
  load: async (key: string) => {
    if (env.failLoad) throw new Error('IndexedDB is broken')
    return env.records.get(key)
  },
  save: async (key: string, value: unknown) => {
    env.records.set(key, value)
  },
  remove: async (key: string) => {
    env.records.delete(key)
  },
  clearAll: async () => {
    env.records.clear()
  },
}))

vi.mock('./folder-files', async (importOriginal) => {
  const original = await importOriginal<typeof import('./folder-files')>()
  const files: FileStore = {
    async list() {
      await env.listGate
      if (env.folderGone) throw new DOMException('gone', 'NotFoundError')
      return [...env.folder.keys()].map((name) => ({ id: name, name }))
    },
    async create(name, contents) {
      await env.createGate
      env.folder.set(name, contents)
      return { id: name, name }
    },
    async read(id) {
      return env.folder.get(id)!
    },
    async remove(id) {
      env.folder.delete(id)
    },
  }
  return { ...original, folderFiles: () => files }
})

const host: PluginHost = {
  get lastUpdated() {
    return env.local.stamp
  },
  exportData: () => env.local.data,
  validateData: (json) => {
    if (json.startsWith('unloadable')) throw new Error('unknown field')
  },
  replaceData: (json) => {
    env.local.data = json
    env.local.stamp = Date.now()
  },
  formatDateTime: (ms) => new Date(ms).toISOString(),
}
backupFolderStore.attach(host)

/** Web Locks, as the store uses them: requests for the same name run one at a time. */
function fakeLocks() {
  const tails = new Map<string, Promise<void>>()
  return {
    async request(name: string, callback: () => Promise<unknown>): Promise<unknown> {
      const previous = tails.get(name) ?? Promise.resolve()
      let done!: () => void
      const tail = new Promise<void>((resolve) => (done = resolve))
      tails.set(
        name,
        previous.then(() => tail),
      )
      await previous
      try {
        return await callback()
      } finally {
        done()
      }
    },
  }
}

function gate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void
  const promise = new Promise<void>((resolve) => (open = resolve))
  return { promise, open }
}

/** Lets pending promise callbacks run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

function edit(data: string): void {
  env.local.data = data
  env.local.stamp = Date.now() + env.local.stamp + 1
}

async function connect(): Promise<void> {
  expect(await backupFolderStore.beginConnect()).toBe(true)
  await backupFolderStore.finishConnect('mac')
}

/** Another computer saves `contents` on top of the folder's newest version. */
async function saveFromOtherComputer(contents: string): Promise<void> {
  const files = {
    list: async () => [...env.folder.keys()].map((name) => ({ id: name, name })),
    create: async (name: string, text: string) => {
      env.folder.set(name, text)
      return { id: name, name }
    },
    read: async (id: string) => env.folder.get(id)!,
    remove: async (id: string) => void env.folder.delete(id),
  }
  const heads = headsOf(await listVersions(files))
  await appendVersion(files, {
    parents: heads.map((h) => h.hash),
    device: 'windows-9c1e',
    time: Date.now() + 60_000,
    contents,
  })
}

function safetyCopies(): string[] {
  return [...env.folder.keys()].filter((name) => name.includes('_before-replace_'))
}

describe('backupFolderStore', () => {
  beforeEach(async () => {
    Object.defineProperty(navigator, 'locks', { value: fakeLocks(), configurable: true })
    env.failLoad = false
    env.folderGone = false
    env.listGate = undefined
    env.createGate = undefined
    await backupFolderStore.disconnect()
    env.records.clear()
    env.folder.clear()
    env.local = { data: '', stamp: 0 }
  })

  it('connects and uploads the data on this computer', async () => {
    edit('v1')
    await connect()
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
    expect([...env.folder.values()]).toEqual(['v1'])
    expect(backupFolderStore.connection?.folder).toBe('Kalkul backup')
  })

  it('ends on an error instead of "syncing" when reading its own state fails', async () => {
    edit('v1')
    await connect()
    env.failLoad = true
    await expect(backupFolderStore.syncNow()).resolves.toBe(undefined)
    expect(backupFolderStore.status).toEqual({ kind: 'error' })
  })

  it('lets a round in flight finish before disconnecting, so it cannot write itself back', async () => {
    edit('v1')
    await connect()
    const listed = gate()
    env.listGate = listed.promise
    const round = backupFolderStore.syncNow()
    await settle()
    const disconnecting = backupFolderStore.disconnect()
    await settle()
    listed.open()
    await Promise.all([round, disconnecting])
    expect(backupFolderStore.status).toEqual({ kind: 'disconnected' })
    expect(backupFolderStore.connection).toBe(undefined)
    expect(backupFolderStore.lastSyncedAt).toBe(undefined)
    expect(env.records.size).toBe(0)
  })

  it('keeps showing the last status while a round only looks at the folder', async () => {
    edit('v1')
    await connect()
    const listed = gate()
    env.listGate = listed.promise
    const round = backupFolderStore.syncNow()
    await settle()
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
    listed.open()
    await round
  })

  it('shows "syncing" while a round writes', async () => {
    edit('v1')
    await connect()
    const created = gate()
    env.createGate = created.promise
    edit('v2')
    const round = backupFolderStore.syncNow()
    await settle()
    expect(backupFolderStore.status).toEqual({ kind: 'syncing' })
    created.open()
    await round
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
  })

  it('updates "last checked" on a round that moved no data', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.UTC(2026, 8, 25, 10))
      edit('v1')
      await connect()
      const syncedAt = backupFolderStore.lastSyncedAt
      vi.setSystemTime(Date.UTC(2026, 8, 25, 11))
      await backupFolderStore.syncNow()
      expect(backupFolderStore.lastCheckedAt).toBe(Date.UTC(2026, 8, 25, 11))
      expect(backupFolderStore.lastSyncedAt).toBe(syncedAt)
    } finally {
      vi.useRealTimers()
    }
  })

  it("applies another computer's change", async () => {
    edit('v1')
    await connect()
    await saveFromOtherComputer('from windows')
    await backupFolderStore.syncNow()
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
    expect(env.local.data).toBe('from windows')
    expect(backupFolderStore.lastPull?.device).toBe('windows-9c1e')
  })

  it('uploads edits made while the folder was missing once it is chosen again', async () => {
    edit('v1')
    await connect()
    const device = backupFolderStore.connection?.device
    env.folderGone = true
    await backupFolderStore.syncNow()
    expect(backupFolderStore.status).toEqual({ kind: 'folder-missing' })

    edit('v2, made while the folder was missing')
    env.folderGone = false
    expect(await backupFolderStore.beginConnect()).toBe(true)
    await backupFolderStore.finishConnect(undefined)
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
    expect(backupFolderStore.connection?.device).toBe(device)
    expect(env.folder.size).toBe(2)
    expect(safetyCopies()).toEqual([])
  })

  it('says which backup it cannot load, and leaves the data and the folder alone', async () => {
    edit('v1')
    await connect()
    await saveFromOtherComputer('unloadable, from a newer Kalkul')
    const files = env.folder.size
    await backupFolderStore.syncNow()
    await backupFolderStore.syncNow()
    expect(backupFolderStore.status).toMatchObject({
      kind: 'unreadable',
      remoteDevice: 'windows-9c1e',
    })
    expect(env.local.data).toBe('v1')
    expect(env.folder.size).toBe(files)
  })

  it('asks for a name when a folder is dropped on a computer that never connected', async () => {
    edit('v1')
    expect(backupFolderStore.connectable).toBe(true)
    await backupFolderStore.connectDropped(env.directory)
    expect(backupFolderStore.naming).toBe(true)
    expect(backupFolderStore.status).toEqual({ kind: 'disconnected' })
    await backupFolderStore.finishConnect('mac')
    expect(backupFolderStore.naming).toBe(false)
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
    expect(backupFolderStore.connection?.device.startsWith('mac-')).toBe(true)
    expect(backupFolderStore.connectable).toBe(false)
  })

  it('reconnects a dropped folder that went missing without asking again', async () => {
    edit('v1')
    await connect()
    env.folderGone = true
    await backupFolderStore.syncNow()
    expect(backupFolderStore.connectable).toBe(true)
    env.folderGone = false
    await backupFolderStore.connectDropped(env.directory)
    expect(backupFolderStore.naming).toBe(false)
    expect(backupFolderStore.status).toEqual({ kind: 'synced' })
  })
})
