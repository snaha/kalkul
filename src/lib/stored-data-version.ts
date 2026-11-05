import record from './stored-data-version.json'

/** Version of the stored data's shape, written with every save and backup. */
export const STORED_DATA_VERSION = record.version

/** Thrown when a backup comes from a newer version of the app. */
export class NewerBackupError extends Error {}

/** Whether parsed stored data or a parsed backup is newer than this code. */
export function isNewerData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || !('version' in data)) return false
  return typeof data.version === 'number' && data.version > STORED_DATA_VERSION
}
