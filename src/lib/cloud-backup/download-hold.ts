/**
 * When a download from the backup folder has to wait.
 *
 * Some screens copy the data when they open and later save their copy back
 * whole: the financial-data list editors save the entire list 300 ms after
 * any keystroke, and the onboarding and plan-settings forms are seeded once.
 * Replacing the data under them would let their next save quietly undo the
 * other computer's edit. So downloads wait while such a page, or any dialog,
 * is open; uploads carry on, and an edit made meanwhile surfaces as a
 * conflict rather than an overwrite.
 *
 * Route ids, not URLs, so the check is the same under every base path and on
 * the hash router.
 */
const EDITING_ROUTES = [
  /^\/\(app\)\/financial-data\/.+/,
  /^\/\(onboarding\)\//,
  /^\/\(app\)\/plan\/\[id\]\/settings$/,
]

export function downloadsHeld(routeId: string | undefined, dialogOpen: boolean): boolean {
  if (dialogOpen) return true
  return routeId !== undefined && EDITING_ROUTES.some((pattern) => pattern.test(routeId))
}
