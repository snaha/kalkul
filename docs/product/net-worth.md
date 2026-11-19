# Net worth and portfolio value

Normative, present tense. The three wealth totals Kalkul shows, what each one
counts, and where each is used.

## Vocabulary

| UI label                | Field / code                                                   | Meaning                                                     |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Net worth               | `getNetWorth`, `snapshotNetWorth`, `YearlyProjection.netWorth` | Cash, investments and tangible assets minus every liability |
| Current portfolio value | `getInvestableNetWorth`                                        | Cash plus investments minus loans not secured by an asset   |
| Investable net worth    | `getInvestableNetWorth`; not a UI label                        | The portfolio value, under the name the code gives it       |
| Liquid net worth        | `liquidNetWorth` on the projection page                        | Cash plus investments minus every liability                 |

Investable net worth is the part of net worth that can be invested or drawn
on: cash plus investments minus loans not secured by an asset. It is the same
figure as the portfolio value. The UI says "portfolio value"; the code says
investable net worth. A loan secured by an asset is the financing of a tangible asset, such as a
mortgage. A standalone loan is any other liability.

## Rules

- Net worth is the total of the assets (cash, investments, tangible assets)
  minus every liability, the financing of tangible assets included. It is the
  one net worth figure everywhere: the dashboard's Net worth card, the
  financial data overview, History, and every year of a projection.
- Portfolio value is cash plus investments minus standalone loans. Tangible
  assets stay out, and so does the loan secured by one: a mortgage leaves with
  the house it financed.
- Portfolio value is what financial independence is measured on: the FI % on
  the dashboard, in History and in every year of a projection is the portfolio
  value over the FI number (`financial-independence.md`). A projection's
  per-year runway is the portfolio value over that year's outflows.
- Liquid net worth is net worth minus the tangible assets: cash plus
  investments minus every liability, secured or not. It is shown only among a
  projection's key figures.
- Investable net worth and portfolio value are one figure with two names, never
  two numbers.
- Portfolio value and liquid net worth differ by exactly the loans secured by
  tangible assets. Without a financed asset they are equal.
- The dashboard's Runway card uses none of the three: it is a month-by-month
  drawdown of the balances (`runway.md`).

## Worked examples

1. Cash 100,000, investments 400,000, a house worth 5,000,000 with 3,000,000
   owed on its mortgage, and a car loan of 50,000. Net worth is 100,000 +
   400,000 + 5,000,000 − 3,050,000 = 2,450,000. Portfolio value is 500,000 −
   50,000 = 450,000. Liquid net worth is 500,000 − 3,050,000 = −2,550,000.
2. The same household with the house fully owned: net worth 5,450,000,
   portfolio value and liquid net worth both 450,000.

## Open questions

- A projection's per-year runway is the ratio of portfolio value to outflows,
  while the dashboard's Runway card is a drawdown, so the two can disagree for
  the same balances (#462).
- Liquid net worth has no use outside the projection's key figures. Whether
  it should stay beside the portfolio value, or be replaced by it, is not
  decided.

## In the code

- `src/lib/snapshots.ts`: `snapshotNetWorth`, the single net worth sum
- `src/lib/financial-totals.ts`: `getNetWorth`, `getInvestableNetWorth`,
  `getFiPercent`
- `src/lib/plan-projection.ts`: per-year `netWorth`, `fiPercent` and
  `runwayYears` in `getYearlyPlanProjection`
- `src/routes/(app)/plan/[id]/+page.svelte`: `liquidNetWorth`
