// Import to initialize. Important :)
import { waitLocale } from 'svelte-i18n'

import '$lib/locales'

import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async () => {
  await waitLocale()
}
