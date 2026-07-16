/**
 * Locale-aware parsing for user-typed numbers (SuffixedInput draft values).
 *
 * The display side formats through appStore.formatNumber, so "1,234" is
 * exactly what an en-locale user sees for 1234 — parsing must round-trip
 * that, while a cs-locale user typing "1,234" means one-point-two-three-four.
 * The old last-separator-is-decimal heuristic got both wrong ("1,234" → 1.234
 * in every locale, "1,234,567" → 1234.567).
 */

/**
 * Infer the decimal separator the given formatter produces by probing it with
 * a fractional value. Deriving it from the formatter (instead of threading a
 * locale string through component props) keeps parsing and display consistent
 * by construction.
 */
export function decimalSeparatorOf(formatNumber: (n: number) => string): string {
  const probe = formatNumber(1.1).match(/1(\D)1/)
  return probe?.[1] ?? '.'
}

// Grouping shape: a separator followed by exactly three digits, e.g. the
// ",234" in "1,234" or ".567" in "1.234.567".
const THREE_DIGIT_GROUP = /^\d{3}$/

/**
 * Parse a typed draft into a number, treating `decimalSep` (from
 * decimalSeparatorOf) as the locale's decimal separator.
 *
 * - whitespace (including NBSP group separators) is stripped
 * - both '.' and ',' present: the last-typed one is the decimal separator
 * - one separator, repeated: always grouping ("1,234,567" → 1234567)
 * - one separator, single occurrence: the locale decimal separator parses as
 *   decimal; the other one is grouping only when followed by exactly three
 *   digits ("1,234" → 1234 in en), otherwise the user meant a decimal
 *   ("0,5" → 0.5 even in en)
 *
 * Returns undefined for empty or unparseable drafts.
 */
export function parseNumberInput(raw: string, decimalSep: string): number | undefined {
  if (!raw) return undefined
  // Strip every kind of space (regular, NBSP, narrow NBSP) — they can only
  // be group separators.
  const trimmed = raw.replace(/[\s\u00A0\u202F]/g, '')
  if (!trimmed || trimmed === '-') return undefined

  const separators = [...trimmed].filter((ch) => ch === '.' || ch === ',' || ch === decimalSep)
  const uniqueSeparators = new Set(separators)

  let normalized: string
  if (separators.length === 0) {
    normalized = trimmed
  } else if (uniqueSeparators.size > 1) {
    // Mixed separators: the last one typed is the decimal separator, the
    // rest is grouping ("1.234,56" → 1234.56, "1,234.56" → 1234.56).
    const lastSep = separators[separators.length - 1]
    const lastIdx = trimmed.lastIndexOf(lastSep)
    const intPart = trimmed.slice(0, lastIdx).replace(/[^0-9-]/g, '')
    normalized = `${intPart}.${trimmed.slice(lastIdx + 1)}`
  } else {
    const sep = separators[0]
    const first = trimmed.indexOf(sep)
    const last = trimmed.lastIndexOf(sep)
    const afterLast = trimmed.slice(last + 1)
    if (first !== last) {
      // Same separator repeated can only be grouping.
      normalized = trimmed.replaceAll(sep, '')
    } else if (sep === decimalSep) {
      normalized = `${trimmed.slice(0, last)}.${afterLast}`
    } else if (THREE_DIGIT_GROUP.test(afterLast)) {
      // Non-decimal separator in grouping position: "1,234" typed by an
      // en-locale user is the formatter's own output for 1234.
      normalized = trimmed.replaceAll(sep, '')
    } else {
      // Non-grouping shape ("0,5", "12,34"): the user meant a decimal.
      normalized = `${trimmed.slice(0, last)}.${afterLast}`
    }
  }

  // Number('') and Number('-') would coerce to 0 after separator stripping.
  if (!/\d/.test(normalized)) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Format a value for the unfocused input; empty string when unset. */
export function formatNumberInput(
  value: number | undefined,
  formatNumber: (n: number) => string,
): string {
  if (value === undefined || !Number.isFinite(value)) return ''
  return formatNumber(value)
}
