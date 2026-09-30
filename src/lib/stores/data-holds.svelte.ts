import { untrack } from 'svelte'

/**
 * Screens that hold their own copy of the data.
 *
 * Some screens copy the data when they open and later save their copy back
 * whole: the financial-data list editors save the entire list 300 ms after
 * any keystroke, the onboarding and plan-settings forms are seeded once, and
 * dialogs edit a draft. Replacing the data underneath them (e.g. a plugin
 * applying a change synced from another computer) would let their next save
 * quietly undo that change. Such screens register a hold while they are open;
 * anything that replaces the data from outside waits while `held` is true.
 */
function withDataHolds() {
  let count = $state(0)

  return {
    /** Whether any screen in this tab holds its own copy of the data. */
    get held(): boolean {
      return count > 0
    },

    /** Registers a hold; call the returned function to release it (once). */
    acquire(): () => void {
      count += 1
      let released = false
      return () => {
        if (released) return
        released = true
        count -= 1
      }
    },
  }
}

export const dataHolds = withDataHolds()

/**
 * Holds the data for as long as the calling component is mounted and
 * `active()` is true. Call it during component initialisation.
 */
export function holdData(active: () => boolean = () => true): void {
  $effect(() => {
    if (!active()) return
    // Acquiring reads the count; the hold must not depend on it.
    return untrack(() => dataHolds.acquire())
  })
}
