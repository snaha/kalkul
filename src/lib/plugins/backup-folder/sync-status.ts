import { type SyncOutcome, UnreadableBackupError } from './sync-engine'

/** What the settings page shows about the backup folder. */
export type BackupFolderStatus =
  | { kind: 'disconnected' }
  /** The first round after loading, before anything is known. */
  | { kind: 'checking' }
  /** Writing to or reading from the folder, not just looking. */
  | { kind: 'syncing' }
  | { kind: 'synced' }
  /** Another computer's edit waits until no editor is open. */
  | { kind: 'held'; remoteTime: number; remoteDevice: string }
  /** The folder was moved, renamed or deleted. */
  | { kind: 'folder-missing' }
  /** The browser needs the user's OK to use the folder again (a click). */
  | { kind: 'needs-permission' }
  | { kind: 'conflict'; remoteTime: number; remoteDevice: string }
  /** The folder's history is branched and this computer has nothing of its own yet. */
  | { kind: 'fork'; versions: { hash: string; time: number; device: string }[] }
  /** Another computer saved data this version of the app cannot load. */
  | { kind: 'unreadable'; remoteTime: number; remoteDevice: string }
  | { kind: 'error' }

export function statusForOutcome(outcome: SyncOutcome): BackupFolderStatus {
  if (outcome.kind === 'conflict' || outcome.kind === 'held') {
    return {
      kind: outcome.kind,
      remoteTime: outcome.remote.time,
      remoteDevice: outcome.remote.device,
    }
  }
  if (outcome.kind === 'fork') {
    return {
      kind: 'fork',
      versions: outcome.heads
        .map(({ hash, time, device }) => ({ hash, time, device }))
        .sort((a, b) => b.time - a.time),
    }
  }
  return { kind: 'synced' }
}

export function statusForError(error: unknown): BackupFolderStatus {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { kind: 'needs-permission' }
  }
  if (error instanceof UnreadableBackupError) {
    return {
      kind: 'unreadable',
      remoteTime: error.version.time,
      remoteDevice: error.version.device,
    }
  }
  return { kind: 'error' }
}

/**
 * Whether a background trigger (an edit, the tab regaining focus, the timer)
 * should start a round. States that only the user can clear are left alone
 * until they act.
 */
export function shouldAutoSync(status: BackupFolderStatus): boolean {
  return (
    status.kind !== 'disconnected' &&
    status.kind !== 'needs-permission' &&
    status.kind !== 'folder-missing'
  )
}

/**
 * Whether the status is a question waiting for the user, which background
 * rounds re-check without taking it off the screen.
 */
export function awaitsChoice(status: BackupFolderStatus): boolean {
  return status.kind === 'conflict' || status.kind === 'fork'
}
