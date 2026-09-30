// Decides what a drag-and-drop onto the app carries, so the drop zone in the
// root layout stays a thin wrapper around browser events.

/**
 * The file extension a backup must have, for both the file picker and a drop.
 * Exports are named `*.kalkul.json`, but browsers rename duplicate downloads
 * (`backup.kalkul (1).json`), so any `.json` is accepted and the import itself
 * decides whether the contents are a valid backup.
 */
export const BACKUP_FILE_EXTENSION = '.json'

type DroppedBackup =
  | { kind: 'none' }
  | { kind: 'too-many' }
  | { kind: 'wrong-type'; name: string }
  | { kind: 'file'; file: File }

/**
 * Whether a drag carries files (as opposed to selected text or a link dragged
 * inside the page), judged from `dataTransfer.types`. During dragenter/dragover
 * the files themselves are not readable yet, only this list is.
 */
export function carriesFiles(types: readonly string[] | undefined): boolean {
  return types?.includes('Files') ?? false
}

/**
 * Picks the backup to import from the dropped files. Exactly one file is
 * accepted — with several we never guess which one the user meant. Only the
 * extension is checked here, see `BACKUP_FILE_EXTENSION`.
 */
export function pickDroppedBackup(files: readonly File[]): DroppedBackup {
  if (files.length === 0) return { kind: 'none' }
  if (files.length > 1) return { kind: 'too-many' }
  const file = files[0]
  if (!file.name.toLowerCase().endsWith(BACKUP_FILE_EXTENSION))
    return { kind: 'wrong-type', name: file.name }
  return { kind: 'file', file }
}
