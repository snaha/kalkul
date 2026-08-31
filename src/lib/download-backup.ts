import { appStore } from '$lib/stores/app.svelte'
import { slugify } from '$lib/utils'

/**
 * Export the whole dataset and hand it to the browser as a download. Shared
 * by the navbar menu, the import dialog and the dev page, which all offer the
 * same "export" action.
 */
export default function downloadBackup(): void {
  const json = appStore.exportBackup()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const nameSlug = slugify(appStore.profile.name)
  a.download = `kalkul-backup-${nameSlug ? `${nameSlug}-` : ''}${new Date().toISOString().slice(0, 10)}.kalkul.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Delay revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
