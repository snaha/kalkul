import { describe, expect, it } from 'vitest'

import { type PlanOwned, itemsForPlan, planOwnedItems, sharedItems } from './plan-owned'

type Item = PlanOwned & { id: string }
const shared: Item = { id: 'shared' }
const own: Item = { id: 'own', plan_id: 'plan-1' }
const other: Item = { id: 'other', plan_id: 'plan-2' }

describe('sharedItems', () => {
  it('keeps only the items no plan owns', () => {
    expect(sharedItems([shared, own, other])).toEqual([shared])
  })

  it('treats a missing list as empty', () => {
    expect(sharedItems(undefined)).toEqual([])
  })
})

describe('planOwnedItems', () => {
  it('keeps only the items some plan owns', () => {
    expect(planOwnedItems([shared, own, other])).toEqual([own, other])
  })
})

describe('itemsForPlan', () => {
  it("lists the shared items and the plan's own, not another plan's", () => {
    expect(itemsForPlan([shared, own, other], 'plan-1')).toEqual([shared, own])
  })

  it('lists shared items only while the plan id is unknown', () => {
    expect(itemsForPlan([shared, own, other], undefined)).toEqual([shared])
  })

  it('treats a missing list as empty', () => {
    expect(itemsForPlan(undefined, 'plan-1')).toEqual([])
  })
})
