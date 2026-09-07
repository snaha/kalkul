import type { Profile } from '$lib/schemas'

// Named `$_` so `pnpm check-locales` recognises the keys below as used.
type Translate = (key: string) => string

export type Language = NonNullable<Profile['language']>

/**
 * Default currency for each supported location. Apply it only from the
 * location select's `onValueChange` — never from an `$effect`, which also
 * fires on mount and overwrote the saved currency (issue #38).
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  CZ: 'CZK',
  HU: 'HUF',
  SK: 'EUR',
  FR: 'EUR',
  other: 'EUR',
}

export function getCountryItems($_: Translate): { value: string; label: string }[] {
  return [
    { value: 'CZ', label: $_('common.countries.czechRepublic') },
    { value: 'SK', label: $_('common.countries.slovakia') },
    { value: 'HU', label: $_('common.countries.hungary') },
    { value: 'FR', label: $_('common.countries.france') },
    { value: 'other', label: $_('common.countries.other') },
  ]
}

export function getLanguageItems($_: Translate): { value: Language; label: string }[] {
  return [
    { value: 'en', label: $_('page.setup.aboutYou.languageEnglish') },
    { value: 'cs', label: $_('page.setup.aboutYou.languageCzech') },
  ]
}
