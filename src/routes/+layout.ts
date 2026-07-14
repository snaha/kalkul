// Import to initialize. Important :)
import { waitLocale } from 'svelte-i18n'

import { browser } from '$app/environment'

import '$lib/locales'
import { appStore } from '$lib/stores/app.svelte'

import type { LayoutLoad } from './$types'

// The app ships as a pure client-rendered SPA (adapter-static with an
// index.html fallback and no prerendered routes), so production never runs
// server-side. Dev SSR would, though — and it executes browser-only code on
// Node (localStorage in the stores, the editors' onDestroy save flush, which
// is the one lifecycle hook Svelte also runs during SSR). Declaring the app
// client-only keeps dev behavior identical to production.
export const ssr = false

export const load: LayoutLoad = async () => {
  // Read localStorage synchronously here (before any component renders) so the
  // store is populated when route components evaluate their $state initializers.
  // This avoids the "store not loaded yet" race where defaults leak in.
  if (browser) appStore.load()
  await waitLocale()
}
