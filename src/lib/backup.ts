import { appStore } from '$lib/stores/app.svelte'

/** Trigger a browser download of `text` as a JSON file named `filename`. */
export function downloadTextAsFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Delay revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Serialize the current data via `appStore.exportBackup()` and trigger a
 * browser download of the backup file. Shared by the navbar's export action
 * and the storage-error banner.
 */
export function downloadBackup(): void {
  downloadTextAsFile(
    `kalkul-backup-${new Date().toISOString().slice(0, 10)}.json`,
    appStore.exportBackup(),
  )
}
