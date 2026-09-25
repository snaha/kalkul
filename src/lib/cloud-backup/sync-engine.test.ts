import { describe, expect, it } from 'vitest'

import { type FileStore, KEPT_RECENT, appendVersion, headsOf, listVersions } from './backup-log'
import { type SyncDeps, type SyncState, resolveConflict, syncOnce } from './sync-engine'

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
  let editing = false
  const deps: SyncDeps = {
    files,
    device: name,
    now: () => (clock += 1000),
    local: {
      stamp: () => stamp,
      canReplace: () => !editing,
      export: () => data,
      import: (json) => {
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
  }
  return {
    deps,
    get data() {
      return data
    },
    get state() {
      return saved
    },
    edit(next: string) {
      data = next
      stamp = clock += 1000
    },
    /** An editor or dialog holding its own copy of the data is open. */
    set editing(value: boolean) {
      editing = value
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

describe('downloads wait while an editor is open', () => {
  async function aheadOnB() {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    const b = device(files, 'b')
    await syncOnce(a.deps)
    await syncOnce(b.deps)
    a.edit('from a')
    await syncOnce(a.deps)
    return { files, a, b }
  }

  it("holds another computer's edit instead of replacing data under an open editor", async () => {
    const { b } = await aheadOnB()
    b.editing = true
    const outcome = await syncOnce(b.deps)
    expect(outcome.kind).toBe('held')
    if (outcome.kind === 'held') expect(outcome.remote.device).toBe('a')
    expect(b.data).toBe('v1')
  })

  it('applies it once the editor closes', async () => {
    const { b } = await aheadOnB()
    b.editing = true
    await syncOnce(b.deps)
    b.editing = false
    expect(await syncOnce(b.deps)).toMatchObject({ kind: 'pulled', device: 'a' })
    expect(b.data).toBe('from a')
  })

  it('turns an edit made while held into a question, not a silent overwrite', async () => {
    const { b } = await aheadOnB()
    b.editing = true
    await syncOnce(b.deps)
    b.edit('from b, typed into the stale editor')
    b.editing = false
    expect((await syncOnce(b.deps)).kind).toBe('conflict')
  })

  it('still uploads local edits while held', async () => {
    const files = memoryStore()
    const a = device(files, 'a', 'v1')
    await syncOnce(a.deps)
    a.editing = true
    a.edit('v2')
    expect((await syncOnce(a.deps)).kind).toBe('pushed')
  })

  it('lets an explicit choice through even while held', async () => {
    const files = memoryStore()
    await syncOnce(device(files, 'b', 'theirs').deps)
    const a = device(files, 'a', 'mine')
    await syncOnce(a.deps)
    a.editing = true
    expect((await resolveConflict(a.deps, 'remote')).kind).toBe('pulled')
    expect(a.data).toBe('theirs')
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
