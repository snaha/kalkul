import { describe, expect, it } from 'vitest'

import { versionBumpProblem } from './data-version-bump'

describe('versionBumpProblem', () => {
  const base = { version: 3, shape: 'abc' }

  it('accepts an unchanged record', () => {
    expect(versionBumpProblem(base, base)).toBeUndefined()
  })

  it('accepts a changed shape with a higher version', () => {
    expect(versionBumpProblem(base, { version: 4, shape: 'def' })).toBeUndefined()
  })

  it('rejects a changed shape with the same version', () => {
    expect(versionBumpProblem(base, { version: 3, shape: 'def' })).toBe(
      'the stored data shape changed but version is still 3',
    )
  })

  it('rejects a lower version', () => {
    expect(versionBumpProblem(base, { version: 2, shape: 'abc' })).toBe(
      'version went down from 3 to 2',
    )
  })
})
