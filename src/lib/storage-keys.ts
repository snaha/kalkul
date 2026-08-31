/**
 * Central registry of localStorage/sessionStorage keys used across the app.
 *
 * Always add new storage keys here instead of hard-coding string literals
 * at the call site. This keeps keys in one place so they stay consistent
 * across readers and writers (e.g. the dev page reset clearing the same
 * key the app store persists to) and makes them easy to change or mock.
 *
 * Usage:
 *   import storageKeys from '$lib/storage-keys'
 *   localStorage.getItem(storageKeys.DATA)
 */
export default {
  /** localStorage — persisted app data (profile, portfolios, plans). */
  DATA: 'kalkul-data',
  /** localStorage — selected color theme ('light' | 'dark' | 'system'). */
  THEME: 'theme',
  /** localStorage — selected UI language override. */
  LOCALE: 'locale',
} as const
