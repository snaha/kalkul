/**
 * Only pages from these origins may open the relay's WebSocket. Without this,
 * any website open in the browser could connect to ws://localhost:3001 while
 * the relay runs and impersonate the Kalkul tab. Localhost is trusted on any
 * port (dev/preview servers); extra origins come from KALKUL_ORIGINS.
 */
const DEFAULT_ORIGINS = ['https://kalkul.app']
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export function isAllowedOrigin(origin: string | undefined, extra = ''): boolean {
  if (!origin) return false
  if (LOOPBACK.test(origin)) return true
  const allowed = [...DEFAULT_ORIGINS, ...extra.split(',').map((s) => s.trim())]
  return allowed.includes(origin)
}
