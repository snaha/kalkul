import { EVENTS, track } from '$lib/analytics'
import { appStore } from '$lib/stores/app.svelte'
import { slugify } from '$lib/utils'

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
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

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Export the whole dataset and hand it to the browser as a download. Shared
 * by the navbar menu, the import dialog and the dev page, which all offer the
 * same "export" action.
 */
export default function downloadBackup(): void {
  // Tracked here rather than in the store: the MCP tools read the same export
  // on every state request, and only the user's download is worth counting.
  track(EVENTS.BACKUP_EXPORTED)
  const nameSlug = slugify(appStore.profile.name)
  downloadJson(
    appStore.exportBackup(),
    `kalkul-backup-${nameSlug ? `${nameSlug}-` : ''}${today()}.kalkul.json`,
  )
}

/** Downloads the unreadable data as stored and marks it kept. */
export function downloadUnreadableData(): void {
  const unreadable = appStore.unreadableData
  if (!unreadable) return
  downloadJson(unreadable.raw, `kalkul-unreadable-${today()}.json`)
  appStore.markUnreadableDataDownloaded()
}
