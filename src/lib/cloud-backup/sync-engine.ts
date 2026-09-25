import {
  type FileStore,
  type Version,
  appendVersion,
  headsOf,
  listVersions,
  saveSafetyCopy,
} from './backup-log'

/**
 * Decides what one sync round does: upload, download, nothing, or stop and
 * ask. It keeps no state of its own between calls — everything it needs is
 * re-read through `SyncDeps` — so any tab can run a round, and running the
 * same round twice does no harm.
 *
 * It never lets local data disappear: data that was never uploaded is never
 * replaced without the user choosing to, and whenever local data is replaced
 * and cannot be found in the folder, it is saved there as a safety copy first.
 */

/** What the device knew the last time it synced successfully. */
export interface SyncState {
  /** Checksum of the version this device's data matches. */
  head: string
  /** The local data's `lastUpdated` at that moment. */
  localStamp: number
  /** Wall-clock time of that sync, for display. */
  syncedAt: number
}

export interface SyncDeps {
  files: FileStore
  /** This device's name, part of every file it writes. */
  device: string
  now: () => number
  local: {
    /**
     * The store's `lastUpdated`: 0 until anything was ever saved on this
     * device, and moving with every change after that.
     */
    stamp: () => number
    /**
     * False while something on screen holds its own copy of the data (an
     * editor, a dialog): replacing the data under it would let its next save
     * write the old copy back as an edit. Downloads wait; uploads do not.
     */
    canReplace: () => boolean
    export: () => string
    /** Replaces the local data; the stamp moves as with any other change. */
    import: (json: string) => void
  }
  state: {
    load: () => Promise<SyncState | undefined>
    save: (state: SyncState) => Promise<void>
  }
}

export type SyncOutcome =
  | { kind: 'up-to-date' }
  | { kind: 'pushed'; hash: string }
  | { kind: 'pulled'; hash: string; device: string }
  /** Another computer's version is waiting for `canReplace`. */
  | { kind: 'held'; remote: Version }
  /** Both sides changed, or the history branched; `resolveConflict` settles it. */
  | { kind: 'conflict'; remote: Version }

async function push(deps: SyncDeps, parents: string[]): Promise<SyncOutcome> {
  const stamp = deps.local.stamp()
  const version = await appendVersion(deps.files, {
    parents,
    device: deps.device,
    time: deps.now(),
    contents: deps.local.export(),
  })
  await deps.state.save({ head: version.hash, localStamp: stamp, syncedAt: deps.now() })
  return { kind: 'pushed', hash: version.hash }
}

/**
 * Whether replacing local data now would lose it: something was saved here,
 * and it is not unchanged from a version still in the folder.
 */
function wouldLoseLocal(
  deps: SyncDeps,
  synced: SyncState | undefined,
  versions: Version[],
): boolean {
  const stamp = deps.local.stamp()
  if (stamp === 0) return false
  if (!synced || stamp > synced.localStamp) return true
  return !versions.some((v) => v.hash === synced.head)
}

/**
 * Replaces local data with `json`, saving the local data aside first when
 * that is the only copy of it. If saving aside fails, nothing is replaced.
 */
async function replaceLocal(
  deps: SyncDeps,
  json: string,
  synced: SyncState | undefined,
  versions: Version[],
): Promise<void> {
  if (wouldLoseLocal(deps, synced, versions)) {
    await saveSafetyCopy(deps.files, {
      device: deps.device,
      time: deps.now(),
      contents: deps.local.export(),
    })
  }
  deps.local.import(json)
}

async function pull(
  deps: SyncDeps,
  version: Version,
  synced: SyncState | undefined,
  versions: Version[],
): Promise<SyncOutcome> {
  // Read first: a backup that cannot be read must not cost anything local.
  const json = await deps.files.read(version.id)
  await replaceLocal(deps, json, synced, versions)
  await deps.state.save({
    head: version.hash,
    localStamp: deps.local.stamp(),
    syncedAt: deps.now(),
  })
  return { kind: 'pulled', hash: version.hash, device: version.device }
}

/** An automatic download, which waits while the data is being edited. */
function autoPull(
  deps: SyncDeps,
  version: Version,
  synced: SyncState | undefined,
  versions: Version[],
): Promise<SyncOutcome> {
  if (!deps.local.canReplace()) return Promise.resolve({ kind: 'held', remote: version })
  return pull(deps, version, synced, versions)
}

/** Key order and whitespace do not make data different. */
function canonical(json: string): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, inner]) => [key, sortKeys(inner)]),
      )
    }
    return value
  }
  try {
    return JSON.stringify(sortKeys(JSON.parse(json)))
  } catch {
    return json
  }
}

/**
 * Stops what would be a conflict when both sides hold the same data anyway —
 * a computer reconnecting, or two computers making the same edit — by
 * recording that this device is in sync with `version`.
 */
async function adoptIfSame(deps: SyncDeps, version: Version): Promise<boolean> {
  const remote = await deps.files.read(version.id)
  if (canonical(remote) !== canonical(deps.local.export())) return false
  await deps.state.save({
    head: version.hash,
    localStamp: deps.local.stamp(),
    syncedAt: deps.now(),
  })
  return true
}

async function conflictUnlessSame(
  deps: SyncDeps,
  remote: Version,
  heads: Version[],
): Promise<SyncOutcome> {
  if (heads.length === 1 && (await adoptIfSame(deps, remote))) return { kind: 'up-to-date' }
  return { kind: 'conflict', remote }
}

export async function syncOnce(deps: SyncDeps): Promise<SyncOutcome> {
  const synced = await deps.state.load()
  const versions = await listVersions(deps.files)
  const heads = headsOf(versions)
  const hasLocal = deps.local.stamp() > 0

  if (!synced) {
    if (!heads.length) return hasLocal ? push(deps, []) : { kind: 'up-to-date' }
    if (!hasLocal) return autoPull(deps, heads[0], synced, versions)
    return conflictUnlessSame(deps, heads[0], heads)
  }

  // Strictly newer: a tab whose copy of the data lags behind the one that
  // last synced must not upload its older copy as an edit.
  const localChanged = deps.local.stamp() > synced.localStamp

  // An emptied folder is nobody's data: start the history again.
  if (!heads.length) return hasLocal ? push(deps, []) : { kind: 'up-to-date' }

  if (heads.length === 1 && heads[0].hash === synced.head) {
    if (!localChanged) return { kind: 'up-to-date' }
    // A change that left the data as it was (a value retyped as it stood)
    // is not worth a new version: every computer would download it for nothing.
    if (await adoptIfSame(deps, heads[0])) return { kind: 'up-to-date' }
    return push(deps, [synced.head])
  }
  // One line of history moved on and this device changed nothing: take it.
  if (heads.length === 1 && !localChanged) return autoPull(deps, heads[0], synced, versions)

  const other = heads.find((h) => h.hash !== synced.head) ?? heads[0]
  return conflictUnlessSame(deps, other, heads)
}

/**
 * Settles a conflict by keeping this device's data or the folder's, and joins
 * every branch into one line with a merge.
 */
export async function resolveConflict(
  deps: SyncDeps,
  keep: 'local' | 'remote',
): Promise<SyncOutcome> {
  const synced = await deps.state.load()
  const versions = await listVersions(deps.files)
  const heads = headsOf(versions)
  const parents = heads.map((h) => h.hash)
  if (keep === 'local' || !heads.length) return push(deps, parents)

  const chosen = heads.find((h) => h.hash !== synced?.head) ?? heads[0]
  if (heads.length === 1) return pull(deps, chosen, synced, versions)

  const json = await deps.files.read(chosen.id)
  await replaceLocal(deps, json, synced, versions)
  return push(deps, parents)
}
