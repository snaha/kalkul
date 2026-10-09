import claire from '$examples/claire-moreau-fr-41yo.kalkul.json'

import { storedDataSchema } from '$lib/schemas'
import {
  DEFAULT_CURRENCY,
  formatCompactCurrency,
  formatCurrency,
  getFormattingLocale,
  parseDateOnly,
} from '$lib/utils'

/**
 * The example household the landing page's chart and comparison are drawn
 * from — the same `examples/` file users can import as a backup, so the
 * marketing figures are the ones the engine really produces.
 *
 * Parsed rather than cast, like the dev presets: TypeScript widens JSON
 * literals to `string`, and a schema change the sample missed should fail here
 * rather than halfway through a projection.
 */
export const SAMPLE = storedDataSchema.pick({ profile: true, portfolios: true }).parse(claire)

/** Birth year of the example household, for the age-based figures. */
export const SAMPLE_BIRTH_YEAR = SAMPLE.profile.birth_date
  ? parseDateOnly(SAMPLE.profile.birth_date).getFullYear()
  : new Date().getFullYear()

export interface SampleFormatters {
  formatCurrency: (value: number) => string
  formatCompactCurrency: (value: number) => string
}

/**
 * Currency formatters for the example household.
 *
 * `appStore.formatCurrency` cannot be used here: the landing only renders when
 * no profile is loaded, so the store would format Claire's euros with the
 * default currency and the visitor's locale. These closures resolve the same
 * way the store does — the sample's country, falling back to the browser
 * locale — but against the sample's own currency. Components still receive a
 * formatter function rather than a locale string, as the rest of the app does.
 */
export function sampleFormatters(browserLocale: string | undefined): SampleFormatters {
  const locale = getFormattingLocale(SAMPLE.profile.location, browserLocale)
  const currency = SAMPLE.profile.currency ?? DEFAULT_CURRENCY

  return {
    formatCurrency: (value: number) => formatCurrency(value, currency, locale),
    formatCompactCurrency: (value: number) => formatCompactCurrency(value, currency, locale),
  }
}
