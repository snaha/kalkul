import type { SyncOutcome } from './sync-engine'

/** What the settings page shows about the backup folder. */
export type CloudBackupStatus =
  | { kind: 'disconnected' }
  | { kind: 'syncing' }
  | { kind: 'synced' }
  /** Another computer's edit waits until no editor is open. */
  | { kind: 'held'; remoteTime: number; remoteDevice: string }
  /** The folder was moved, renamed or deleted. */
  | { kind: 'folder-missing' }
  /** The browser needs the user's OK to use the folder again (a click). */
  | { kind: 'needs-permission' }
  | { kind: 'conflict'; remoteTime: number; remoteDevice: string }
  | { kind: 'error' }

export function statusForOutcome(outcome: SyncOutcome): CloudBackupStatus {
  if (outcome.kind === 'conflict' || outcome.kind === 'held') {
    return {
      kind: outcome.kind,
      remoteTime: outcome.remote.time,
      remoteDevice: outcome.remote.device,
    }
  }
  return { kind: 'synced' }
}

export function statusForError(error: unknown): CloudBackupStatus {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { kind: 'needs-permission' }
  }
  return { kind: 'error' }
}

/**
 * Whether a background trigger (an edit, the tab regaining focus, the timer)
 * should start a round. States that only the user can clear are left alone
 * until they act.
 */
export function shouldAutoSync(status: CloudBackupStatus): boolean {
  return (
    status.kind !== 'disconnected' &&
    status.kind !== 'needs-permission' &&
    status.kind !== 'folder-missing'
  )
}
