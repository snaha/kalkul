import { describe, expect, it } from 'vitest'

import {
  type FileStore,
  KEPT_RECENT,
  KEPT_SAFETY_COPIES,
  type Version,
  appendVersion,
  checksum,
  headsOf,
  listVersions,
  safetyCopyFileName,
  saveSafetyCopy,
  versionFileName,
  versionsToKeep,
} from './backup-log'

const T0 = Date.UTC(2026, 8, 25, 14, 30, 12)

/** In-memory stand-in for the backup folder; a file's id is its name. */
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
      const contents = files.get(id)
      if (contents === undefined) throw new Error('missing')
      return contents
    },
    async remove(id) {
      files.delete(id)
    },
  }
}

function append(
  store: FileStore,
  parents: string[],
  contents: string,
  { device = 'a', time = T0 }: { device?: string; time?: number } = {},
): Promise<Version> {
  return appendVersion(store, { parents, device, time, contents })
}

describe('checksum', () => {
  it('is the first 12 hex digits of the SHA-256 of the contents', async () => {
    expect(await checksum('abc')).toBe('ba7816bf8f01')
  })
})

describe('file names', () => {
  it('read: time, checksum, parent, device', () => {
    expect(
      versionFileName({
        hash: '3f9a1c2b7d4e',
        parents: ['a81c09e2f3b1'],
        device: 'mac-3f2a',
        time: T0,
      }),
    ).toBe('2026-09-25-143012_3f9a1c2b7d4e_a81c09e2f3b1_mac-3f2a.kalkul.json')
  })

  it('mark the first version as a root, and list both parents of a merge', () => {
    expect(versionFileName({ hash: 'aaaaaaaaaaaa', parents: [], device: 'a', time: T0 })).toBe(
      '2026-09-25-143012_aaaaaaaaaaaa_root_a.kalkul.json',
    )
    expect(
      versionFileName({
        hash: 'cccccccccccc',
        parents: ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'],
        device: 'a',
        time: T0,
      }),
    ).toBe('2026-09-25-143012_cccccccccccc_aaaaaaaaaaaa+bbbbbbbbbbbb_a.kalkul.json')
  })

  it('mark safety copies so they are never mistaken for a version', () => {
    expect(safetyCopyFileName({ device: 'mac-3f2a', time: T0 })).toBe(
      '2026-09-25-143012_before-replace_mac-3f2a.kalkul.json',
    )
  })
})

describe('listVersions', () => {
  it('reads checksum, parents, device and time back from the names', async () => {
    const store = memoryStore()
    const root = await append(store, [], 'one')
    const child = await append(store, [root.hash], 'two', { device: 'b', time: T0 + 1000 })
    const versions = await listVersions(store)
    expect(versions.find((v) => v.hash === child.hash)).toMatchObject({
      parents: [root.hash],
      device: 'b',
      time: T0 + 1000,
    })
  })

  it('ignores other files, including safety copies', async () => {
    const store = memoryStore()
    await store.create('notes.txt', 'x')
    await store.create(safetyCopyFileName({ device: 'a', time: T0 }), 'x')
    expect(await listVersions(store)).toEqual([])
  })

  it('names each version after a checksum of its parents, device, time and contents', async () => {
    const store = memoryStore()
    const version = await append(store, [], 'contents')
    expect(version.hash).toBe(await checksum(`\na\n${T0}\ncontents`))
  })

  it('gives the same data saved twice two different versions', async () => {
    const store = memoryStore()
    const first = await append(store, [], 'same')
    const second = await append(store, [first.hash], 'same', { time: T0 + 1000 })
    expect(second.hash).not.toBe(first.hash)
    expect(headsOf(await listVersions(store)).map((v) => v.hash)).toEqual([second.hash])
  })

  it('keeps a merge that carries one parent’s exact data a proper single head', async () => {
    const store = memoryStore()
    const root = await append(store, [], 'root')
    const a = await append(store, [root.hash], 'from a', { time: T0 + 1000 })
    const b = await append(store, [root.hash], 'from b', { device: 'b', time: T0 + 2000 })
    const merge = await append(store, [a.hash, b.hash], 'from b', { time: T0 + 3000 })
    expect(headsOf(await listVersions(store)).map((v) => v.hash)).toEqual([merge.hash])
  })
})

describe('headsOf', () => {
  it('is the version nothing builds on', async () => {
    const store = memoryStore()
    const root = await append(store, [], 'one')
    const child = await append(store, [root.hash], 'two')
    expect(headsOf(await listVersions(store)).map((v) => v.hash)).toEqual([child.hash])
  })

  it('shows a branch as two heads, newest first', async () => {
    const store = memoryStore()
    const root = await append(store, [], 'one')
    const a = await append(store, [root.hash], 'from a', { time: T0 + 1000 })
    const b = await append(store, [root.hash], 'from b', { device: 'b', time: T0 + 2000 })
    expect(headsOf(await listVersions(store)).map((v) => v.hash)).toEqual([b.hash, a.hash])
  })

  it('joins a branch back up with a merge', async () => {
    const store = memoryStore()
    const root = await append(store, [], 'one')
    const a = await append(store, [root.hash], 'from a')
    const b = await append(store, [root.hash], 'from b')
    const merge = await append(store, [a.hash, b.hash], 'merged')
    expect(headsOf(await listVersions(store)).map((v) => v.hash)).toEqual([merge.hash])
  })
})

describe('versionsToKeep', () => {
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR
  const NOW = Date.UTC(2026, 8, 25, 12, 0, 0)

  /** A straight line of versions at the given ages (ms before NOW), oldest first. */
  function line(ages: number[]): Version[] {
    return ages.map((age, i) => ({
      hash: `h${String(i).padStart(11, '0')}`,
      parents: i === 0 ? [] : [`h${String(i - 1).padStart(11, '0')}`],
      device: 'a',
      time: NOW - age,
      id: `f${i}`,
    }))
  }

  function kept(versions: Version[]): number[] {
    const keep = versionsToKeep(versions, NOW)
    return versions.flatMap((v, i) => (keep.has(v.id) ? [i] : []))
  }

  it(`keeps the newest ${KEPT_RECENT} whatever their age`, () => {
    const ages = Array.from({ length: KEPT_RECENT + 3 }, (_, i) => (KEPT_RECENT + 2 - i) * 1000)
    expect(kept(line(ages))).toEqual([3, 4, 5, 6, 7])
  })

  it('thins the last day to the newest version in each hour', () => {
    // Twelve saves in one hour three hours ago, then five recent ones.
    const burst = Array.from({ length: 12 }, (_, i) => 3 * HOUR - i * 60_000)
    const recent = [40_000, 30_000, 20_000, 10_000, 0]
    const versions = line([...burst, ...recent])
    // Only the burst's last save survives, plus the five recent ones.
    expect(kept(versions)).toEqual([11, 12, 13, 14, 15, 16])
  })

  it('thins the last month to the newest version in each day', () => {
    const ages = [10 * DAY + 2 * HOUR, 10 * DAY + HOUR, 3 * DAY, 4000, 3000, 2000, 1000, 0]
    expect(kept(line(ages))).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('lets go of versions older than a month', () => {
    const ages = [45 * DAY, 4000, 3000, 2000, 1000, 0]
    expect(kept(line(ages))).toEqual([1, 2, 3, 4, 5])
  })

  it('never lets go of a head, however old: it is a branch someone has to settle', () => {
    const versions = line([45 * DAY, 4000, 3000, 2000, 1000, 0])
    const side: Version = {
      hash: 'side00000000',
      parents: [versions[0].hash],
      device: 'b',
      time: NOW - 40 * DAY,
      id: 'side',
    }
    expect(versionsToKeep([...versions, side], NOW).has('side')).toBe(true)
  })
})

describe('appendVersion pruning', () => {
  it('prunes by the rule above as it saves', async () => {
    const store = memoryStore()
    let parent: string[] = []
    for (let i = 0; i < KEPT_RECENT + 3; i++) {
      parent = [(await append(store, parent, `v${i}`, { time: T0 + i * 1000 })).hash]
    }
    const versions = await listVersions(store)
    expect(versions.length).toBe(KEPT_RECENT)
    expect(headsOf(versions).map((v) => v.hash)).toEqual(parent)
  })

  it('never prunes safety copies', async () => {
    const store = memoryStore()
    await saveSafetyCopy(store, { device: 'a', time: T0 - 1000, contents: 'precious' })
    let parent: string[] = []
    for (let i = 0; i < KEPT_RECENT + 3; i++) {
      parent = [(await append(store, parent, `v${i}`, { time: T0 + i * 1000 })).hash]
    }
    expect(store.files.get(safetyCopyFileName({ device: 'a', time: T0 - 1000 }))).toBe('precious')
  })
})

describe('saveSafetyCopy', () => {
  it(`keeps the newest ${KEPT_SAFETY_COPIES} safety copies`, async () => {
    const store = memoryStore()
    for (let i = 0; i < KEPT_SAFETY_COPIES + 2; i++) {
      await saveSafetyCopy(store, { device: 'a', time: T0 + i * 1000, contents: `c${i}` })
    }
    const names = [...store.files.keys()]
    expect(names.length).toBe(KEPT_SAFETY_COPIES)
    expect(names).not.toContain(safetyCopyFileName({ device: 'a', time: T0 }))
  })
})
