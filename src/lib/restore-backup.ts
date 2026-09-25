import { goto } from '$app/navigation'
import { resolve } from '$app/paths'

import { EVENTS, track } from '$lib/analytics'
import routes from '$lib/routes'
import { appStore } from '$lib/stores/app.svelte'

/**
 * Restores a backup the user picked or dropped, replacing all current data,
 * then shows it. Throws when the file is not a valid Kalkul backup; the caller
 * reports that to the user.
 */
export default async function restoreBackup(file: File): Promise<void> {
  const text = await file.text()
  appStore.importBackup(text)
  // The landing demo and the dev presets import too; only a restore from
  // the user's own file counts as a backup import.
  track(EVENTS.BACKUP_IMPORTED)
  // The restored data lives on the dashboard, not on the page the import
  // started from (onboarding profile, settings, wherever the file was dropped).
  await goto(resolve(routes.HOME))
}
