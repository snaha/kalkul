import { describe, expect, test } from 'vitest'

import { barCentreX, minStackedChartWidth } from './landing-chart-width'

describe('minStackedChartWidth', () => {
  test('fits every bar at the chart’s own minimum bar width', () => {
    // 21 left padding + 26 bars of 14 + 25 gaps of 4 + 8 right padding.
    expect(minStackedChartWidth(26)).toBe(493)
    expect(minStackedChartWidth(46)).toBe(853)
  })

  test('needs no bar room for an empty projection', () => {
    expect(minStackedChartWidth(0)).toBe(29)
  })
})

describe('barCentreX', () => {
  test('places the first bar half a bar in from the left padding', () => {
    expect(barCentreX(0, 26, 493)).toBe(28)
  })

  test('spaces the bars evenly across a wider chart', () => {
    // 1000px wide: (1000 - 29 - 100) / 26 = 33.5 per bar.
    expect(barCentreX(0, 26, 1000)).toBe(37.75)
    expect(barCentreX(1, 26, 1000)).toBe(75.25)
  })

  test('keeps the minimum bar width when the chart is narrower than its minimum', () => {
    expect(barCentreX(2, 26, 300)).toBe(64)
  })

  test('falls back to the left padding with no bars', () => {
    expect(barCentreX(0, 0, 400)).toBe(21)
  })
})
