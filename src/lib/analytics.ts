import storageKeys from '$lib/storage-keys'

/**
 * Umami Cloud analytics (issue #299). The tracker script is loaded by the root
 * layout on kalkul.app only; everywhere else `window.umami` stays undefined
 * and every call here is a no-op. Page views are tracked by the script itself;
 * these are the custom events that make the growth funnel readable:
 * visitor → profile created → finances entered → plan created → keeps coming back.
 *
 * Nothing personal is sent: event names, a few small counts, and a random
 * per-browser id so returning visitors are counted once across days.
 */
export const EVENTS = {
  /** The app opened with a profile present, once per page load. */
  APP_OPEN: 'app-open',
  /** Onboarding finished the profile step — the closest thing to a signup. */
  PROFILE_CREATED: 'profile-created',
  /** The first financial data was saved. */
  FINANCES_SAVED: 'finances-saved',
  PLAN_CREATED: 'plan-created',
  /**
   * Fired next to PLAN_CREATED when the new plan is the only one, so a funnel
   * can end on a user's first plan without counting later ones. Funnel steps
   * match on the event name only, so this cannot be a property of PLAN_CREATED.
   */
  FIRST_PLAN_CREATED: 'first-plan-created',
  /** Quick update confirmed today's balances. */
  BALANCES_CONFIRMED: 'balances-confirmed',
  BACKUP_EXPORTED: 'backup-exported',
  BACKUP_IMPORTED: 'backup-imported',
  LANDING_START_PLANNING: 'landing-start-planning',
  LANDING_TRY_DEMO: 'landing-try-demo',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

interface Umami {
  track(event: string, data?: Record<string, string | number | boolean>): void
  identify(id: string): void
}

// `window.umami` in the browser; read off globalThis so the unit suite, which
// runs in Node, can stub it the same way.
const host = globalThis as { umami?: Umami }

// The tracker is a deferred script the layout inserts at hydration, so it can
// finish loading after the first calls are made; those wait here until
// `trackerLoaded` runs from the script's load event.
const pending: (() => void)[] = []

function whenReady(fn: (umami: Umami) => void): void {
  if (host.umami) fn(host.umami)
  else pending.push(() => host.umami && fn(host.umami))
}

export function trackerLoaded(): void {
  for (const fn of pending.splice(0)) fn()
}

export function track(event: EventName, data?: Record<string, string | number | boolean>): void {
  whenReady((umami) => umami.track(event, data))
}

/** Tie this browser's sessions together under a random, stable id. */
export function identify(): void {
  whenReady((umami) => {
    let id = localStorage.getItem(storageKeys.ANALYTICS_ID)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(storageKeys.ANALYTICS_ID, id)
    }
    umami.identify(id)
  })
}
