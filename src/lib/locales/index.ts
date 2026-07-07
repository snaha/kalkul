import { init, register } from 'svelte-i18n'

import { browser } from '$app/environment'

import storageKeys from '$lib/storage-keys'

export const defaultLocale = 'en'
const supportedLocales = ['en', 'cs']

register('en', () => import('$lib/locales/en.json'))
register('cs', () => import('$lib/locales/cs.json'))

function resolveLocale(): string {
  if (!browser) return defaultLocale

  const stored = localStorage.getItem(storageKeys.LOCALE)
  if (stored && supportedLocales.includes(stored)) return stored

  for (const language of navigator.languages) {
    const short = language.slice(0, 2)
    if (supportedLocales.includes(short)) return short
  }

  return defaultLocale
}

init({
  fallbackLocale: defaultLocale,
  initialLocale: resolveLocale(),
})
