import { describe, expect, it } from 'vitest'

import { defaultComputerLabel, deviceName, folderFiles } from './folder-files'

/** Just enough of FileSystemDirectoryHandle for the store. */
function fakeDirectory(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const handle = {
    async *values() {
      for (const name of files.keys()) yield { kind: 'file' as const, name }
      yield { kind: 'directory' as const, name: 'sub.kalkul.json' }
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name) && !options?.create) {
        throw new DOMException('missing', 'NotFoundError')
      }
      return {
        async getFile() {
          return new File([files.get(name) ?? ''], name)
        },
        async createWritable() {
          let buffer = ''
          return {
            async write(data: string) {
              buffer += data
            },
            async close() {
              files.set(name, buffer)
            },
          }
        },
      }
    },
    async removeEntry(name: string) {
      if (!files.delete(name)) throw new DOMException('missing', 'NotFoundError')
    },
  }
  return { files, handle: handle as unknown as FileSystemDirectoryHandle }
}

const NAME = '2026-09-25-143012_v000001_mac-3f2a.kalkul.json'

describe('folderFiles', () => {
  it('lists Kalkul files only, not other files or folders', async () => {
    const { handle } = fakeDirectory({ [NAME]: 'x', 'notes.txt': 'y' })
    expect(await folderFiles(handle).list()).toEqual([{ id: NAME, name: NAME }])
  })

  it('writes, reads and removes files', async () => {
    const { files, handle } = fakeDirectory()
    const store = folderFiles(handle)
    await store.create(NAME, 'contents')
    expect(files.get(NAME)).toBe('contents')
    expect(await store.read(NAME)).toBe('contents')
    await store.remove(NAME)
    expect(files.has(NAME)).toBe(false)
  })

  it('treats removing a file that is already gone as success', async () => {
    const { handle } = fakeDirectory()
    await expect(folderFiles(handle).remove(NAME)).resolves.toBeUndefined()
  })

  it('lists a file iCloud has not downloaded yet under its real name, so no one writes over its version', async () => {
    const { handle } = fakeDirectory({ [`.${NAME}.icloud`]: '' })
    expect(await folderFiles(handle).list()).toEqual([{ id: `.${NAME}.icloud`, name: NAME }])
  })

  it('refuses to read such a placeholder instead of returning empty data', async () => {
    const { handle } = fakeDirectory({ [`.${NAME}.icloud`]: '' })
    await expect(folderFiles(handle).read(`.${NAME}.icloud`)).rejects.toThrow('not downloaded')
  })
})

describe('deviceName', () => {
  it('slugs the label and adds a random suffix so two "macbook"s never share names', () => {
    expect(deviceName('Vojtěch’s MacBook', () => '3f2a')).toBe('vojtech-s-macbook-3f2a')
  })

  it('falls back to "computer" for a label with nothing usable', () => {
    expect(deviceName('  ', () => '3f2a')).toBe('computer-3f2a')
  })

  it('keeps names short', () => {
    expect(deviceName('a'.repeat(80), () => '3f2a')).toBe(`${'a'.repeat(24)}-3f2a`)
  })
})

describe('defaultComputerLabel', () => {
  it('names the computer after its operating system', () => {
    expect(defaultComputerLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac')
    expect(defaultComputerLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(defaultComputerLabel('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
    expect(defaultComputerLabel('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)')).toBe('chromebook')
    expect(defaultComputerLabel('Something else')).toBe('computer')
  })
})
