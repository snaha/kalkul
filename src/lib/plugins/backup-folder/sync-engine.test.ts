import { describe, expect, it } from 'vitest'

import {
  type FileStore,
  KEPT_RECENT,
  KEPT_SAFETY_COPIES,
  appendVersion,
  headsOf,
  listVersions,
  saveSafetyCopy,
} from './backup-log'
import {
  type SyncDeps,
  type SyncState,
  UnreadableBackupError,
  chooseVersion,
  resolveConflict,
  syncOnce,
} from './sync-engine'

const T0 = Date.UTC(2026, 8, 25, 14, 0, 0)

function memoryStore(): FileStore & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    async list() {
      return [...files.keys()].map((name) => ({ id: name, name }))
    },
    async create(name, contents) {
      files.set(name, contents)
      return { id: name, name }
    },
    async read(id) {
      return files.get(id)!
    },
    async remove(id) {
      files.delete(id)
    },
  }
}

/** A shared clock, so versions from different devices get distinct times. */
let clock = T0

/** One device: its local data and its sync state. */
function device(files: FileStore, name: string, initial = '') {
  let data = initial
  let stamp = initial ? 1 : 0
  let saved: SyncState | undefined
  let transfers = 0
  const deps: SyncDeps = {
    files,
    device: name,
    now: () => (clock += 1000),
    local: {
      stamp: () => stamp,
      export: () => data,
      import: (json) => {
        if (json.startsWith('unloadable')) throw new Error('unknown field')
        data = json
        stamp = clock += 1000
      },
    },
    state: {
      load: async () => saved,
      save: async (next) => {
        saved = next
      },
    },
    transferring: () => {
      transfers += 1
    },
  }
  return {
    deps,
    get data() {
      return data
    },
    get state() {
      return saved
    },
    /** How many times a round said it was about to write or download. */
    get transfers() {
      return transfers
    },
    edit(next: string) {
      data = next
      stamp = clock += 1000
    },
  }
}

async function headContents(files: FileStore): Promise<string[]> {
  const heads = headsOf(await listVersions(files))
  return Promise.all(heads.map(async (h) => await files.read(h.id)))
}

function safetyCopies(files: Map<string, string>): string[] {
  return [...files.entries()].filter(([n]) => n.includes('_before-replace_')).map(([, c]) => c)
}

describe('syncOnce: first sync on a device', () => {
  it('uploads local data into an empty folder as the first version', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'mine')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    expect(await headContents(files)).toEqual(['mine'])
    const [version] = await listVersions(files)
    expect(version.parents).toEqual([])
    expect(a.state?.head).toBe(version.hash)
  })

  it('downloads the backup onto a device that never saved anything', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'b', 'theirs').deps)
    const a = device(files, 'a')
    expect((await syncOnce(a.deps)).kind).toBe('pulled')
    expect(a.data).toBe('theirs')
    expect(safetyCopies(files.files)).toEqual([])
  })

  it('asks which side to keep when the device has any saved data, never replacing it', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'b', 'theirs').deps)
    // Saved data counts as data whatever it contains (e.g. no profile name
    // yet): what matters is that something was saved on this device.
    const a = device(files, 'a', '{"profile":{"name":""}}')
    expect((await syncOnce(a.deps)).kind).toBe('conflict')
    expect(a.data).toBe('{"profile":{"name":""}}')
    expect(await headContents(files)).toEqual(['theirs'])
  })

  it('does nothing while neither side has data', async () => {
    expect(await syncOnce(device(memoryStore(), 'a').deps)).toEqual({ kind: 'up-to-date' })
  })
})

describe('syncOnce: after the first sync', () => {
  it('is up to date when nothing changed', async () => {
    const a = device(memoryStore(), 'a', 'v1')
    await syncOnce(a.deps)
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
  })

  it('uploads a local edit on top of the version it last synced', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    await syncOnce(a.deps)
    const first = a.state!.head
    a.edit('v2')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    expect(await headContents(files)).toEqual(['v2'])
    expect(headsOf(await listVersions(files))[0].parents).toEqual([first])
  })

  it('writes nothing for an edit that leaves the data as it was', async () => {
    const files = memoryStore()
    const a = device(files, 'a', '{"cash":1,"name":"Jana"}')
    await syncOnce(a.deps)
    // A value retyped as it was: the store records a change, the data is the same.
    a.edit('{"name":"Jana","cash":1}')
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
    expect(files.files.size).toBe(1)
    // And the next real edit builds on the same version as before.
    a.edit('{"cash":2,"name":"Jana"}')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    expect(files.files.size).toBe(2)
  })

  it('does not write back what it just downloaded from another computer', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('from a')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    expect(files.files.size).toBe(2)
    expect(await syncOnce(b.deps)).toEqual({ kind: 'up-to-date' })
    expect(files.files.size).toBe(2)
  })

  it("downloads another device's edits, even several at once, without a safety copy", async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    b.edit('b1')
    await syncOnce(b.deps)
    b.edit('b2')
    await syncOnce(b.deps)
    expect((await syncOnce(a.deps)).kind).toBe('pulled')
    expect(a.data).toBe('b2')
    expect(safetyCopies(files.files)).toEqual([])
    // Applying the download is not a local edit to upload again.
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
  })

  it('saves a safety copy first when the version its data came from was pruned', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'only on a')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    for (let i = 0; i < KEPT_RECENT + 1; i++) {
      b.edit(`b${i}`)
      await syncOnce(b.deps)
    }
    expect((await syncOnce(a.deps)).kind).toBe('pulled')
    expect(safetyCopies(files.files)).toEqual(['only on a'])
  })

  it('reports a conflict when both devices edited since their last sync', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('from a')
    b.edit('from b')
    await syncOnce(b.deps)
    const outcome = await syncOnce(a.deps)
    expect(outcome.kind).toBe('conflict')
    if (outcome.kind === 'conflict') expect(outcome.remote.device).toBe('b')
    expect(a.data).toBe('from a')
  })

  it('turns two devices saving on the same version at once into a branch both of them see', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('from a')
    b.edit('from b')
    // "b" does not see "a"'s new file before writing (a slow sync client).
    const before = new Set(files.files.keys())
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    const late = [...files.files.keys()].filter((name) => !before.has(name))
    const bView: FileStore = {
      ...files,
      list: async () => (await files.list()).filter((f) => !late.includes(f.name)),
    }
    expect((await syncOnce({ ...b.deps, files: bView })).kind).toBe('pushed')
    // Once both files are visible, neither device silently takes the other's.
    expect(headsOf(await listVersions(files)).length).toBe(2)
    expect((await syncOnce(a.deps)).kind).toBe('conflict')
    expect((await syncOnce(b.deps)).kind).toBe('conflict')
    expect(a.data).toBe('from a')
    expect(b.data).toBe('from b')
  })

  it('ignores a local stamp older than the last sync (a tab that has not caught up)', async () => {
    const a = device(memoryStore(), 'a', 'v1')
    await syncOnce(a.deps)
    const stale = { ...a.deps, local: { ...a.deps.local, stamp: () => 0 } }
    expect(await syncOnce(stale)).toEqual({ kind: 'up-to-date' })
  })

  it('starts the history again when the folder was emptied', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    await syncOnce(a.deps)
    files.files.clear()
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    expect(await headContents(files)).toEqual(['v1'])
  })

  it('names its files with its device name', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'mac-3f2a', 'v1').deps)
    expect([...files.files.keys()][0]).toMatch(/_root_mac-3f2a\.kalkul\.json$/)
  })
})

describe('resolveConflict', () => {
  async function conflicted() {
    const files = memoryStore()
    const b = device(files, 'b', 'theirs')
    await syncOnce(b.deps)
    const a = device(files, 'a', 'mine')
    await syncOnce(a.deps)
    return { files, a, b }
  }

  it("keeps this device's data as a merge of every branch, which the others then download", async () => {
    const { files, a, b } = await conflicted()
    expect((await resolveConflict(a.deps, 'local')).kind).toBe('pushed')
    expect(headsOf(await listVersions(files)).length).toBe(1)
    expect(await headContents(files)).toEqual(['mine'])
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
    expect((await syncOnce(b.deps)).kind).toBe('pulled')
    expect(b.data).toBe('mine')
  })

  it("takes the folder's data, saving this device's data as a safety copy first", async () => {
    const { files, a } = await conflicted()
    expect((await resolveConflict(a.deps, 'remote')).kind).toBe('pulled')
    expect(a.data).toBe('theirs')
    expect(safetyCopies(files.files)).toEqual(['mine'])
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
  })

  it('joins a branch of two devices back into one history', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    const base = a.state!.head
    a.edit('from a')
    await syncOnce(a.deps)
    await appendVersion(files, {
      parents: [base],
      device: 'b',
      time: (clock += 1000),
      contents: 'from b',
    })
    expect((await syncOnce(a.deps)).kind).toBe('conflict')
    await resolveConflict(a.deps, 'remote')
    const heads = headsOf(await listVersions(files))
    expect(heads.length).toBe(1)
    expect(heads[0].parents.length).toBe(2)
    expect(a.data).toBe('from b')
  })

  it('does not replace local data when the safety copy cannot be written', async () => {
    const { files, a } = await conflicted()
    const failing = {
      ...a.deps,
      files: {
        ...files,
        create: async (name: string, contents: string) => {
          if (name.includes('_before-replace_')) throw new Error('disk full')
          return files.create(name, contents)
        },
      },
    }
    await expect(resolveConflict(failing, 'remote')).rejects.toThrow('disk full')
    expect(a.data).toBe('mine')
  })
})

describe('identical data is not a conflict', () => {
  it('connecting a computer whose data already matches the folder asks nothing', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'b', 'same').deps)
    const a = device(files, 'a', 'same')
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
    expect(safetyCopies(files.files)).toEqual([])
    a.edit('next')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
  })

  it('compares the data, not its formatting', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'b', '{"a":1,"b":[1,2]}').deps)
    const a = device(files, 'a', '{ "b": [1, 2], "a": 1 }')
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
  })

  it('two computers making the same edit do not have to choose', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('same edit')
    b.edit('same edit')
    await syncOnce(a.deps)
    expect(await syncOnce(b.deps)).toEqual({ kind: 'up-to-date' })
  })
})

describe('a version this app cannot load', () => {
  it('replaces nothing and saves no safety copy, however often it is retried', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    b.edit('b only')
    a.edit('unloadable, from a newer app')
    await syncOnce(a.deps)
    for (let i = 0; i < 3; i++) {
      const error = await resolveConflict(b.deps, 'remote').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(UnreadableBackupError)
      if (error instanceof UnreadableBackupError) expect(error.version.device).toBe('a')
    }
    expect(b.data).toBe('b only')
    expect(safetyCopies(files.files)).toEqual([])
  })

  it('taking its safety copy back costs no older copy', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    for (let i = 0; i < KEPT_SAFETY_COPIES; i++) {
      await saveSafetyCopy(files, { device: 'b', time: T0 - (i + 1) * 1000, contents: `old ${i}` })
    }
    b.edit('b only')
    a.edit('unloadable')
    await syncOnce(a.deps)
    await expect(resolveConflict(b.deps, 'remote')).rejects.toBeInstanceOf(UnreadableBackupError)
    expect(safetyCopies(files.files).length).toBe(KEPT_SAFETY_COPIES)
  })

  it('fails an automatic download the same way', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('unloadable')
    await syncOnce(a.deps)
    await expect(syncOnce(b.deps)).rejects.toBeInstanceOf(UnreadableBackupError)
    expect(b.data).toBe('v1')
  })
})

describe('a new computer connecting to a branched folder', () => {
  async function forked() {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    await syncOnce(a.deps)
    const base = a.state!.head
    a.edit('from a')
    await syncOnce(a.deps)
    await appendVersion(files, {
      parents: [base],
      device: 'b',
      time: (clock += 1000),
      contents: 'from b',
    })
    return { files, a }
  }

  it('downloads neither branch on its own and asks which one to use', async () => {
    const { files } = await forked()
    const c = device(files, 'c')
    const outcome = await syncOnce(c.deps)
    expect(outcome.kind).toBe('fork')
    if (outcome.kind === 'fork') {
      expect(outcome.heads.map((h) => h.device).sort()).toEqual(['a', 'b'])
    }
    expect(c.data).toBe('')
    expect(c.state).toBe(undefined)
  })

  it('takes the chosen branch and joins the history, which the others then download', async () => {
    const { files, a } = await forked()
    const c = device(files, 'c')
    const outcome = await syncOnce(c.deps)
    if (outcome.kind !== 'fork') throw new Error('expected a fork')
    const fromB = outcome.heads.find((h) => h.device === 'b')!
    expect((await chooseVersion(c.deps, fromB.hash)).kind).toBe('pushed')
    expect(c.data).toBe('from b')
    expect(safetyCopies(files.files)).toEqual([])
    const heads = headsOf(await listVersions(files))
    expect(heads.length).toBe(1)
    expect(heads[0].parents.length).toBe(2)
    expect(await syncOnce(c.deps)).toEqual({ kind: 'up-to-date' })
    expect((await syncOnce(a.deps)).kind).toBe('pulled')
    expect(a.data).toBe('from b')
  })

  it('falls back to an ordinary round when the fork was settled meanwhile', async () => {
    const { files, a } = await forked()
    const c = device(files, 'c')
    const outcome = await syncOnce(c.deps)
    if (outcome.kind !== 'fork') throw new Error('expected a fork')
    await resolveConflict(a.deps, 'local')
    expect((await chooseVersion(c.deps, outcome.heads[0].hash)).kind).toBe('pulled')
    expect(c.data).toBe('from a')
  })
})

describe('telling the caller when a round transfers data', () => {
  it('stays quiet for a round that only looks', async () => {
    const a = device(memoryStore(), 'a', 'v1')
    await syncOnce(a.deps)
    const before = a.transfers
    expect(await syncOnce(a.deps)).toEqual({ kind: 'up-to-date' })
    expect(a.transfers).toBe(before)
  })

  it('speaks up before an upload and before a download', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
    expect(a.transfers).toBe(1)
    expect((await syncOnce(b.deps)).kind).toBe('pulled')
    expect(b.transfers).toBe(1)
  })
})
