// Import to initialize. Important :)
import { waitLocale } from 'svelte-i18n'

import { browser } from '$app/environment'

import '$lib/locales'
import { appStore } from '$lib/stores/app.svelte'

import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async () => {
  // Read localStorage synchronously here (before any component renders) so the
  // store is populated when route components evaluate their $state initializers.
  // This avoids the "store not loaded yet" race where defaults leak in.
  if (browser) appStore.load()
  await waitLocale()
}
