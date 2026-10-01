import { EVENTS, track } from '$lib/analytics'
import { appStore } from '$lib/stores/app.svelte'

/**
 * Erases the user's Kalkul data in this browser (Settings → Start fresh): the
 * profile, its finances and history, and every plan. Settings that belong to
 * the browser rather than to the data — theme, UI language, the AI relay —
 * stay. Offer an export first; nothing here can be undone.
 */
export default function eraseData(): void {
  appStore.clear()
  // Tracked here rather than in the store: the dev page's empty preset clears
  // the store too, and only the user's own erase is worth counting.
  track(EVENTS.DATA_ERASED)
}
