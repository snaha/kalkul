import { describe, expect, it } from 'vitest'

import { yearChange } from './year-change'

describe('yearChange', () => {
  it('is undefined without a previous year', () => {
    expect(yearChange(100, undefined)).toBeUndefined()
  })

  it('gives the delta and its percent of the previous year', () => {
    expect(yearChange(1250, 1000)).toEqual({ delta: 250, percent: 25 })
    expect(yearChange(750, 1000)).toEqual({ delta: -250, percent: -25 })
  })

  it('measures against the magnitude of a negative previous year', () => {
    expect(yearChange(-100, -200)).toEqual({ delta: 100, percent: 50 })
    expect(yearChange(100, -200)).toEqual({ delta: 300, percent: 150 })
  })

  it('has no percent when the previous year was 0', () => {
    expect(yearChange(500, 0)).toEqual({ delta: 500 })
  })
})
