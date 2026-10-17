import { EVENTS, track } from '$lib/analytics'
import { appStore } from '$lib/stores/app.svelte'

/** Erases the stored profile and plans; browser settings stay. */
export default function eraseData(): void {
  appStore.clear()
  // Tracked here rather than in the store: the dev page's empty preset clears
  // the store too, and only the user's own erase is worth counting.
  track(EVENTS.DATA_ERASED)
}
