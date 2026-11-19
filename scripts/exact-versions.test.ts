import { describe, expect, it } from 'vitest'

import { isExact, isExactOverride, lockfileOverrides, manifestRanges } from './exact-versions'

const LOCKFILE = 'pnpm-lock.yaml'

describe('isExact', () => {
  it.each(['13.0.0', '1.0.0-rc.1', '1.0.0+build.5', 'npm:foo@1.2.3', 'npm:@scope/foo@1.2.3'])(
    'accepts %s',
    (spec) => {
      expect(isExact(spec)).toBe(true)
    },
  )

  it.each([
    '^13.0.0',
    '~13.0.0',
    '>=1.0.0',
    '1.x',
    '1.0',
    '*',
    'latest',
    'github:owner/repo',
    'npm:foo@^1.2.3',
    'catalog:',
    'workspace:^',
  ])('rejects %s', (spec) => {
    expect(isExact(spec)).toBe(false)
  })
})

describe('isExactOverride', () => {
  it('accepts a reference to a direct dependency', () => {
    expect(isExactOverride('$foo')).toBe(true)
    expect(isExactOverride('$@scope/foo')).toBe(true)
  })

  it('rejects a range', () => {
    expect(isExactOverride('^8.22.1')).toBe(false)
  })
})

describe('manifestRanges', () => {
  it('lists the ranges of every dependency field, and nothing else', () => {
    const ranges = manifestRanges({
      dependencies: { a: '1.0.0', b: '^1.0.0' },
      devDependencies: { c: '~2.0.0' },
      optionalDependencies: { d: 'latest' },
    })
    expect(ranges).toEqual([
      ['dependencies b', '^1.0.0'],
      ['devDependencies c', '~2.0.0'],
      ['optionalDependencies d', 'latest'],
    ])
  })

  it('reads a manifest without dependency fields as having no ranges', () => {
    expect(manifestRanges({})).toEqual([])
  })
})

describe('lockfileOverrides', () => {
  it('reads plain, quoted and scoped entries up to the blank line', () => {
    const text = [
      "lockfileVersion: '9.0'",
      '',
      'overrides:',
      '  ws@^8: 8.22.1',
      "  '@scope/a>zod': 4.6.7",
      "  nanoid@^3: '>=3.3.20'",
      '',
      'importers:',
      '  .: {}',
    ].join('\n')
    expect(lockfileOverrides(text, LOCKFILE)).toEqual({
      'ws@^8': '8.22.1',
      '@scope/a>zod': '4.6.7',
      'nanoid@^3': '>=3.3.20',
    })
  })

  it('reads a lockfile without overrides as empty', () => {
    expect(lockfileOverrides("lockfileVersion: '9.0'\n", LOCKFILE)).toEqual({})
  })

  it('throws on a line it cannot read', () => {
    const text = ['overrides:', '  nested:', '    deeper: 1.0.0', ''].join('\n')
    expect(() => lockfileOverrides(text, LOCKFILE)).toThrow(
      'pnpm-lock.yaml:2: cannot read override "  nested:"',
    )
  })
})
