import type { YearlyProjection } from './plan-projection'

/**
 * The years of a projection in which a cash flow (an income, an expense or a
 * transfer) is active: the years the engine lists it in. A one-time flow has
 * the one year it fires in; a flow that never runs within the plan has none.
 */
export function activeYearsOfCashFlow(projection: YearlyProjection[], id: string): Set<number> {
  return new Set(
    projection
      .filter((p) =>
        [p.incomesByItem, p.expensesByItem, p.transfersByItem].some((items) =>
          items.some((item) => item.id === id),
        ),
      )
      .map((p) => p.year),
  )
}
