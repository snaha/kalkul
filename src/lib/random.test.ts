import { describe, expect, test } from 'vitest'

import { generateRandomString } from './random'

describe('#generateRandom', () => {
  const randomValues = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  const getRandomValues = () => randomValues
  const length = randomValues.length

  test('generates string with default base 16', () => {
    const base = 16
    const random = generateRandomString(length, base, getRandomValues)
    const expected = '102030405060708'
    expect(random).toEqual(expected)
  })

  test('generates string with base 36', () => {
    const base = 36
    const random = generateRandomString(length, base, getRandomValues)
    const expected = 'jv30clup820'
    expect(random).toEqual(expected)
  })

  test('generates string with base 10', () => {
    const base = 10
    const random = generateRandomString(length, base, getRandomValues)
    const expected = '72623859790382856'
    expect(random).toEqual(expected)
  })
})
