import { slugify } from '$lib/utils'

import type { FileStore, RemoteFile } from './backup-log'

/**
 * The backup log's four file operations on a folder the user picked, through
 * the File System Access API (Chromium browsers). The folder usually lives in
 * iCloud Drive, Dropbox or another synced location; Kalkul only ever reads
 * and writes local files, and the sync client moves them between computers.
 */

const EXTENSION = '.kalkul.json'

/**
 * iCloud's "Optimise Mac Storage" can leave a synced file as a hidden
 * placeholder, `.name.icloud`, until it is downloaded. It is listed under its
 * real name — its version exists, so nobody may write another with the same
 * number — but it cannot be read yet.
 */
const ICLOUD_PLACEHOLDER = /^\.(.+)\.icloud$/

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

export function folderFiles(directory: FileSystemDirectoryHandle): FileStore {
  return {
    async list(): Promise<RemoteFile[]> {
      const files: RemoteFile[] = []
      for await (const entry of directory.values()) {
        if (entry.kind !== 'file') continue
        const name = ICLOUD_PLACEHOLDER.exec(entry.name)?.[1] ?? entry.name
        if (name.endsWith(EXTENSION)) files.push({ id: entry.name, name })
      }
      return files
    },

    async create(name, contents): Promise<RemoteFile> {
      const handle = await directory.getFileHandle(name, { create: true })
      // Written to a temporary file and moved into place on close, so a sync
      // client never picks up half a file.
      const writable = await handle.createWritable()
      await writable.write(contents)
      await writable.close()
      return { id: name, name }
    },

    async read(id): Promise<string> {
      if (ICLOUD_PLACEHOLDER.test(id)) {
        throw new Error(`${id} is not downloaded to this computer yet`)
      }
      return (await (await directory.getFileHandle(id)).getFile()).text()
    },

    async remove(id): Promise<void> {
      try {
        await directory.removeEntry(id)
      } catch (error) {
        // Already gone is as good as removed.
        if (!isNotFound(error)) throw error
      }
    },
  }
}

/**
 * The name this computer writes into every file name: the user's label plus
 * a random suffix, so two computers both called "macbook" never collide.
 */
export function deviceName(
  label: string,
  suffix: () => string = () => crypto.randomUUID().slice(0, 4),
): string {
  const slug = slugify(label).slice(0, 24).replace(/-+$/, '')
  return `${slug || 'computer'}-${suffix()}`
}

/** A starting label for the name field, from the operating system. */
export function defaultComputerLabel(userAgent: string): string {
  if (/CrOS/.test(userAgent)) return 'chromebook'
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'mac'
  if (/Windows/.test(userAgent)) return 'windows'
  if (/Linux/.test(userAgent)) return 'linux'
  return 'computer'
}
