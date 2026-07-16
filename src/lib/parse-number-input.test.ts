import { describe, expect, it } from 'vitest'

import { decimalSeparatorOf, formatNumberInput, parseNumberInput } from './parse-number-input'
import { formatNumber } from './utils'

const enFormat = (n: number) => formatNumber(n, 'en')
const csFormat = (n: number) => formatNumber(n, 'cs-CZ')

describe('decimalSeparatorOf', () => {
  it('derives the separator from the formatter', () => {
    expect(decimalSeparatorOf(enFormat)).toBe('.')
    expect(decimalSeparatorOf(csFormat)).toBe(',')
  })
})

describe('parseNumberInput (en: "." decimal, "," grouping)', () => {
  const parse = (raw: string) => parseNumberInput(raw, '.')

  it('parses plain integers and decimals', () => {
    expect(parse('1234')).toBe(1234)
    expect(parse('1234.56')).toBe(1234.56)
    expect(parse('-42')).toBe(-42)
    expect(parse('0.5')).toBe(0.5)
  })

  it('round-trips the formatter output with thousands separators', () => {
    // The unfocused field displays exactly this for 1234 — pasting or
    // retyping it must not become 1.234.
    expect(parse('1,234')).toBe(1234)
    expect(parse('1,234,567')).toBe(1234567)
    expect(parse(enFormat(1234567.89))).toBe(1234567.89)
  })

  it('strips spaces used as group separators', () => {
    expect(parse('1 234')).toBe(1234)
    expect(parse('1 234 567')).toBe(1234567)
  })

  it('treats a comma outside grouping position as a decimal', () => {
    expect(parse('1,5')).toBe(1.5)
    expect(parse('0,5')).toBe(0.5)
    expect(parse('12,34')).toBe(12.34)
  })

  it('uses the last separator as decimal when both kinds are present', () => {
    expect(parse('1.234,56')).toBe(1234.56)
    expect(parse('1,234.56')).toBe(1234.56)
    expect(parse('1.234.567,8')).toBe(1234567.8)
  })

  it('returns undefined for empty or unparseable drafts', () => {
    expect(parse('')).toBeUndefined()
    expect(parse('-')).toBeUndefined()
    expect(parse('..')).toBeUndefined()
    expect(parse('abc')).toBeUndefined()
  })

  it('salvages a messy mixed draft by honoring the last separator', () => {
    // Mid-typing noise: better to keep tracking a plausible value than to
    // clear the field.
    expect(parse('1.2.3,4')).toBe(123.4)
  })
})

describe('parseNumberInput (cs: "," decimal, spaces grouping)', () => {
  const parse = (raw: string) => parseNumberInput(raw, ',')

  it('keeps Czech decimal entry working', () => {
    // A cs-locale comma is always a decimal separator, even in what an
    // en-locale would read as grouping position.
    expect(parse('1,234')).toBe(1.234)
    expect(parse('1,5')).toBe(1.5)
  })

  it('round-trips the cs formatter output', () => {
    expect(parse(csFormat(1234567.89))).toBe(1234567.89)
    expect(parse('1 234 567')).toBe(1234567)
  })

  it('treats a repeated comma as grouping, not a decimal', () => {
    expect(parse('1,234,567')).toBe(1234567)
  })

  it('treats a dot as grouping in grouping position and decimal otherwise', () => {
    expect(parse('1.234')).toBe(1234)
    expect(parse('1.5')).toBe(1.5)
  })

  it('uses the last separator as decimal when both kinds are present', () => {
    expect(parse('1.234,56')).toBe(1234.56)
    expect(parse('1,234.56')).toBe(1234.56)
  })
})

describe('formatNumberInput', () => {
  it('formats through the provided formatter', () => {
    expect(formatNumberInput(1234.56, enFormat)).toBe('1,234.56')
    expect(formatNumberInput(undefined, enFormat)).toBe('')
    expect(formatNumberInput(Number.NaN, enFormat)).toBe('')
  })
})
