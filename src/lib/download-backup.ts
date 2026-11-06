import { EVENTS, track } from '$lib/analytics'
import { appStore } from '$lib/stores/app.svelte'
import { slugify } from '$lib/utils'

// The File System Access API's save dialog (Chromium only; lib.dom has no
// typing for it yet). Lets the user pick the file name and place, and
// overwrite, instead of the browser's automatic "-1" suffix.
interface SaveFilePicker {
  showSaveFilePicker(options: {
    suggestedName: string
    types: { description: string; accept: Record<string, string[]> }[]
  }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>
  }>
}

function backupFileName(): string {
  const nameSlug = slugify(appStore.profile.name)
  return `kalkul-backup-${nameSlug ? `${nameSlug}-` : ''}${new Date().toISOString().slice(0, 10)}.kalkul.json`
}

/**
 * Export the whole dataset and hand it to the browser as a download. Shared
 * by the navbar menu, the import dialog and the dev page, which all offer the
 * same "export" action. A Ctrl- or Cmd-click opens the browser's "Save as"
 * dialog instead, where that dialog exists, so the user names the file.
 */
export default async function downloadBackup(event?: MouseEvent): Promise<void> {
  const json = appStore.exportBackup()
  const blob = new Blob([json], { type: 'application/json' })
  const picker = (event?.ctrlKey || event?.metaKey) && 'showSaveFilePicker' in window
  if (picker) {
    try {
      const handle = await (window as unknown as SaveFilePicker).showSaveFilePicker({
        suggestedName: backupFileName(),
        types: [{ description: 'Kalkul backup', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      // Cancelling the dialog is not an export.
      if (error instanceof DOMException && error.name === 'AbortError') return
      throw error
    }
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Delay revoke so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  // Tracked here rather than in the store: the MCP tools read the same export
  // on every state request, and only the user's download is worth counting.
  track(EVENTS.BACKUP_EXPORTED)
}
