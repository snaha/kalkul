/**
 * The backup history in a shared folder, as a graph of versions like git's.
 *
 * The folder is typically synced between computers by iCloud, Dropbox or
 * similar, which merge folders but cannot merge two edits of one file. So no
 * file is ever edited. Every save is a new file whose name carries its own
 * checksum and the checksum of the version it was built on:
 *
 *   2026-09-25-143012_3f9a1c2b7d4e_a81c09e2f3b1_mac-3f2a.kalkul.json
 *   time (UTC)        this version  its parent   computer
 *
 * The current version is the one nothing builds on (a "head"). Two heads mean
 * two computers built on the same version — a branch the user settles, which
 * is recorded as a merge naming both parents (`aaa…+bbb…`). The first version
 * has `root` for a parent. Everything needed to draw the history is in the
 * names. A version's checksum covers its parents, device and time as well as
 * its contents, so it is unique even when the data repeats. Each file is a
 * plain Kalkul backup that Import can open.
 *
 * Safety copies — a computer's data saved just before something replaced it —
 * sit beside the history:
 *
 *   2026-09-25-150104_before-replace_mac-3f2a.kalkul.json
 *
 * Both kinds keep the extension Import accepts. Old versions are thinned out
 * as new ones arrive (`versionsToKeep`).
 */

/** A file in the folder, as the provider lists it. */
export interface RemoteFile {
  id: string
  name: string
}

/** The four operations the history needs from a provider. */
export interface FileStore {
  list(): Promise<RemoteFile[]>
  create(name: string, contents: string): Promise<RemoteFile>
  read(id: string): Promise<string>
  remove(id: string): Promise<void>
}

export interface Version {
  /** Checksum of the file's contents. */
  hash: string
  /** The versions it was built on: none for the first, two or more for a merge. */
  parents: string[]
  device: string
  /** Save time (epoch ms), from the name; for display and pruning only. */
  time: number
  /** The provider's id for the file. */
  id: string
}

/** The newest versions kept whatever their age (see `versionsToKeep`). */
export const KEPT_RECENT = 5
/** Safety copies are pruned separately, and never by new versions. */
export const KEPT_SAFETY_COPIES = 10

const EXTENSION = '.kalkul.json'
const HASH_LENGTH = 12
const TIME = String.raw`(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})`
const HASH = `[0-9a-f]{${HASH_LENGTH}}`
const DEVICE = '([a-z0-9-]+)'
const VERSION_PATTERN = new RegExp(
  `^${TIME}_(${HASH})_(root|${HASH}(?:\\+${HASH})*)_${DEVICE}\\.kalkul\\.json$`,
)
const SAFETY_PATTERN = new RegExp(`^${TIME}_before-replace_${DEVICE}\\.kalkul\\.json$`)

/** The first 12 hex digits of the contents' SHA-256. */
export async function checksum(contents: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contents))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, HASH_LENGTH)
}

function formatTime(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  )
}

function parseTime(match: RegExpExecArray): number {
  const [year, month, day, hours, minutes, seconds] = match.slice(1, 7).map(Number)
  return Date.UTC(year, month - 1, day, hours, minutes, seconds)
}

export function versionFileName({ hash, parents, device, time }: Omit<Version, 'id'>): string {
  const parentPart = parents.length ? parents.join('+') : 'root'
  return `${formatTime(time)}_${hash}_${parentPart}_${device}${EXTENSION}`
}

export function safetyCopyFileName({ device, time }: { device: string; time: number }): string {
  return `${formatTime(time)}_before-replace_${device}${EXTENSION}`
}

function toVersion(file: RemoteFile): Version | undefined {
  const match = VERSION_PATTERN.exec(file.name)
  if (!match) return undefined
  return {
    hash: match[7],
    parents: match[8] === 'root' ? [] : match[8].split('+'),
    device: match[9],
    time: parseTime(match),
    id: file.id,
  }
}

function newestFirst(a: { time: number; id: string }, b: { time: number; id: string }): number {
  if (a.time !== b.time) return b.time - a.time
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Every version in the folder, newest first. */
export async function listVersions(store: FileStore): Promise<Version[]> {
  return (await store.list())
    .map(toVersion)
    .filter((v): v is Version => v !== undefined)
    .sort(newestFirst)
}

/** The versions nothing builds on, newest first. More than one is a branch. */
export function headsOf(versions: Version[]): Version[] {
  const built = new Set(versions.flatMap((v) => v.parents))
  return versions.filter((v) => !built.has(v.hash))
}

/**
 * Saves `contents` as a new version built on `parents`, then prunes old
 * versions. It never refuses: a version saved on an outdated parent simply
 * becomes a branch, which the next sync round reports.
 */
export async function appendVersion(
  store: FileStore,
  {
    parents,
    device,
    time,
    contents,
  }: { parents: string[]; device: string; time: number; contents: string },
): Promise<Version> {
  // Not the contents alone: the same data can be saved twice (an edit
  // undone, a merge keeping one side), and two versions must never share a
  // name or the history would loop back on itself.
  const hash = await checksum(`${parents.join('+')}\n${device}\n${time}\n${contents}`)
  const file = await store.create(versionFileName({ hash, parents, device, time }), contents)
  const version = toVersion(file)
  if (!version) throw new Error('Created an unrecognisable version file')

  const versions = await listVersions(store)
  const keep = versionsToKeep(versions, time)
  await Promise.all(versions.filter((v) => !keep.has(v.id)).map((v) => store.remove(v.id)))
  return version
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * Which versions survive pruning (by id): the newest `KEPT_RECENT`, then the
 * newest one of each hour over the last day and of each day over the last 30
 * days — so a burst of saves collapses into one version while the history
 * still reaches back a month — plus every head, however old, since a head is
 * someone's unsettled work. Safety copies are not versions and are not
 * touched. Times come from the names, so a computer with a wrong clock only
 * affects which of its own versions look old.
 */
export function versionsToKeep(versions: Version[], now: number): Set<string> {
  const newestFirst = [...versions].sort((a, b) => b.time - a.time)
  const keep = new Set(newestFirst.slice(0, KEPT_RECENT).map((v) => v.id))
  for (const version of headsOf(versions)) keep.add(version.id)

  const newestPerBucket = (window: number, bucket: number) => {
    const seen = new Set<number>()
    for (const version of newestFirst) {
      if (now - version.time > window) break
      const key = Math.floor(version.time / bucket)
      if (seen.has(key)) continue
      seen.add(key)
      keep.add(version.id)
    }
  }
  newestPerBucket(DAY, HOUR)
  newestPerBucket(30 * DAY, DAY)
  return keep
}

/** Saves a computer's data aside before something replaces it. */
export async function saveSafetyCopy(
  store: FileStore,
  { device, time, contents }: { device: string; time: number; contents: string },
): Promise<void> {
  await store.create(safetyCopyFileName({ device, time }), contents)
  const copies = (await store.list())
    .filter((file) => SAFETY_PATTERN.test(file.name))
    // The name starts with the time, so name order is time order.
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
  await Promise.all(copies.slice(KEPT_SAFETY_COPIES).map((file) => store.remove(file.id)))
}
