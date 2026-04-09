/**
 * Central registry of external URLs used across the app.
 *
 * Always add new outbound links here instead of hard-coding URLs in
 * components. This keeps URLs in one place so they can be updated
 * consistently when things move (e.g. changing the GitHub org, switching
 * Discord server) and makes them easy to mock or override in tests.
 *
 * Usage:
 *   import externalLinks from '$lib/external-links'
 *   <Button href={externalLinks.GITHUB} target="_blank" rel="noopener noreferrer">…</Button>
 *
 * Note: the `svelte/no-navigation-without-resolve` ESLint rule flags raw
 * anchor `href` attributes because it expects `resolve()` for internal routes.
 * The `Button` component is not flagged. When linking from a bare `<a>` tag,
 * suppress the rule on the href line with an inline eslint-disable-line
 * comment for `svelte/no-navigation-without-resolve`.
 */
export default {
  GITHUB: 'https://github.com/snaha-org/kalkul-next',
  DISCORD: 'https://discord.gg/kalkul',
  AGPL_LICENSE: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
} as const
