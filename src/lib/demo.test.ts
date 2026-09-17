import { describe, expect, test } from 'vitest'

import { DEMO_PERSONAS, DEMO_PLAN_ID, buildDemoData, personaLabel } from './demo'

const TODAY = new Date(2026, 8, 17) // 2026-09-17

const persona = (id: string) => {
  const found = DEMO_PERSONAS.find((p) => p.id === id)
  if (!found) throw new Error(`no persona ${id}`)
  return found
}

describe('personaLabel', () => {
  test('first name and age on the given day, as the chooser shows them', () => {
    expect(DEMO_PERSONAS.map((p) => personaLabel(p, TODAY))).toEqual([
      'Tereza, 20',
      'Peter, 29',
      'Claire, 41',
      'Jan, 56',
    ])
  })
})

describe('buildDemoData', () => {
  test('puts an editable plan of the whole profile in front of the persona plans', () => {
    const claire = persona('claire')
    const { profile, portfolios } = buildDemoData(claire, TODAY)

    expect(profile).toBe(claire.data.profile)
    expect(portfolios.length).toBe(claire.data.portfolios.length + 1)
    expect(portfolios[0]).toMatchObject({
      id: DEMO_PLAN_ID,
      name: 'Claire, 41',
      start_date: '2026-09-01',
      include_cash: true,
      included_investment_ids: ['inv-1', 'inv-2', 'inv-3'],
      // ta-4 is the chalet a saved plan owns, so it is not part of the current situation.
      included_tangible_asset_ids: ['ta-1', 'ta-2', 'ta-3'],
      included_liability_ids: ['li-1'],
    })
  })

  test('leaves the persona data untouched', () => {
    const jan = persona('jan')
    const before = JSON.stringify(jan.data)
    buildDemoData(jan, TODAY)
    expect(JSON.stringify(jan.data)).toBe(before)
  })
})
