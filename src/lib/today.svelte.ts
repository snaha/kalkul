/* eslint-disable svelte/prefer-svelte-reactivity -- every Date here is read
   and replaced, never mutated; reactivity comes from the $state holding it. */
import { msUntilNextMidnight, toDateOnlyString } from '$lib/utils'

/**
 * One clock for a whole page: every figure on it has to agree on "today", and
 * re-reading the clock mid-render could straddle midnight. It is state rather
 * than a constant because a page is left open for days — frozen at its mount
 * date it would stop projecting, never raise the staleness banner, and record
 * yesterday's projected values on Confirm.
 *
 * Call from a component's script: the rollover timer lives in an effect tied
 * to the component's lifetime.
 */
export function trackToday(): { readonly today: Date } {
  let today = $state(new Date())

  $effect(() => {
    // `today` is only read from the callbacks, never while the effect runs, so
    // this subscribes once instead of re-arming on every replacement.
    let timer: ReturnType<typeof setTimeout>

    function refresh(): void {
      const now = new Date()
      // Only a new calendar day changes anything, so everything downstream is
      // left alone until the date itself rolls over.
      if (toDateOnlyString(now) !== toDateOnlyString(today)) today = now
    }

    // One timer aimed at the next midnight, rather than a poll running all day
    // to catch a single rollover. Re-armed after each one so a page left open
    // for a week keeps following the calendar.
    function armForMidnight(): void {
      timer = setTimeout(() => {
        refresh()
        armForMidnight()
      }, msUntilNextMidnight(new Date()))
    }
    armForMidnight()

    // A backgrounded tab throttles its timers, so the midnight one can fire
    // late; coming back to the tab must not show yesterday's page while it is
    // still pending.
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  })

  return {
    get today() {
      return today
    },
  }
}
