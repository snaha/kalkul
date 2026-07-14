import { appStore } from '$lib/stores/app.svelte'

/**
 * Serialize the current data via `appStore.exportBackup()` and trigger a
 * browser download of the backup file. Shared by the navbar's export action
 * and the storage-error banner.
 */
export function downloadBackup(): void {
  const json = appStore.exportBackup()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kalkul-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Delay revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
