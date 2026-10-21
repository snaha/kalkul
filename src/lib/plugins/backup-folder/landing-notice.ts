import type { BackupFolderStatus } from './sync-status'

/**
 * What the landing page says about the backup folder. The landing page only
 * shows while there is no data, so a connection that loaded something has
 * already moved on to the app; everything else must be said here, since the
 * landing page has no navbar status.
 */
export type LandingNotice =
  /** Not connected: suggest dropping the folder. */
  | 'drop'
  | 'connecting'
  /** Connected to a folder with nothing to load (an empty folder). */
  | 'empty'
  /** Connected, but a choice or action is waiting in settings. */
  | 'attention'

export function landingNotice(status: BackupFolderStatus): LandingNotice {
  switch (status.kind) {
    case 'disconnected':
    case 'folder-missing':
      return 'drop'
    case 'checking':
    case 'syncing':
      return 'connecting'
    case 'synced':
      return 'empty'
    default:
      return 'attention'
  }
}
