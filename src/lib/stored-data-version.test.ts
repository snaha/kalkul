import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { storedDataSchema } from '$lib/schemas'

import { STORED_DATA_VERSION, isNewerData } from './stored-data-version'
import record from './stored-data-version.json'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [
        key,
        key === 'required' && Array.isArray(entry) ? [...entry].sort() : sortKeys(entry),
      ]),
  )
}

function shapeOf(schema: z.ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  return createHash('sha256')
    .update(JSON.stringify(sortKeys(jsonSchema)))
    .digest('hex')
}

describe('the recorded stored data shape', () => {
  it('matches storedDataSchema', () => {
    expect(
      shapeOf(storedDataSchema),
      'storedDataSchema changed: raise `version` in src/lib/stored-data-version.json and set `shape` to the received value',
    ).toBe(record.shape)
  })

  it('ignores the order of fields', () => {
    expect(shapeOf(z.object({ a: z.string(), b: z.number() }))).toBe(
      shapeOf(z.object({ b: z.number(), a: z.string() })),
    )
  })

  it('changes when a field is added', () => {
    expect(shapeOf(storedDataSchema.extend({ added: z.string().optional() }))).not.toBe(
      shapeOf(storedDataSchema),
    )
  })
})

describe('isNewerData', () => {
  it.each([
    ['a higher version', { version: STORED_DATA_VERSION + 1 }, true],
    ['the current version', { version: STORED_DATA_VERSION }, false],
    ['a lower version', { version: STORED_DATA_VERSION - 1 }, false],
    ['no version', { profile: {} }, false],
    ['a version that is not a number', { version: '99' }, false],
    ['something that is not an object', 'text', false],
    ['nothing', undefined, false],
  ])('with %s', (_label, data, expected) => {
    expect(isNewerData(data)).toBe(expected)
  })
})
