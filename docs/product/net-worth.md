# Net worth and investable net worth

Normative, present tense. The two wealth totals Kalkul shows, what each one
counts, and where each is used.

## Vocabulary

| UI label             | Field / code                                                   | Meaning                                                     |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Net worth            | `getNetWorth`, `snapshotNetWorth`, `YearlyProjection.netWorth` | Cash, investments and tangible assets minus every liability |
| Investable net worth | `getInvestableNetWorth`, `YearlyProjection.investableNetWorth` | Cash plus investments minus loans not secured by an asset   |

Investable net worth is the part of net worth that can be invested or drawn
on: cash plus investments minus loans not secured by an asset. It has one
name, in the FI dialog, in a projection's right sidebar and in the code. A
loan secured by an asset is the financing of a tangible asset, such as a
mortgage. A standalone loan is any other liability.

## Rules

- Net worth is the total of the assets (cash, investments, tangible assets)
  minus every liability, the financing of tangible assets included. It is the
  one net worth figure everywhere: the dashboard's Net worth card, the
  financial data overview, History, and every year of a projection.
- Investable net worth is cash plus investments minus standalone loans.
  Tangible assets stay out, and so does the loan secured by one: a mortgage
  leaves with the house it financed.
- Investable net worth is what financial independence is measured on: the
  FI % on the dashboard, in History and in every year of a projection is the
  investable net worth over the FI number (`financial-independence.md`).
- A projection shows the investable net worth of the selected year in the
  right sidebar (`projections.md`).
- Liquid net worth, cash plus investments minus every liability, is not shown
  anywhere.
- The runway uses neither total, on the dashboard or in a projection: it is a
  month-by-month drawdown of the balances (`runway.md`).

## Worked examples

1. Cash 100,000, investments 400,000, a house worth 5,000,000 with 3,000,000
   owed on its mortgage, and a car loan of 50,000. Net worth is 100,000 +
   400,000 + 5,000,000 − 3,050,000 = 2,450,000. Investable net worth is
   500,000 − 50,000 = 450,000.
2. The same household with the house fully owned: net worth 5,450,000,
   investable net worth 450,000.

## Open questions

- The research behind the name found "liquid net worth" used for this figure
  as well (ProjectionLab's glossary). Kalkul shows no liquid net worth, so
  nothing clashes yet.

## In the code

- `src/lib/snapshots.ts`: `snapshotNetWorth`, the single net worth sum
- `src/lib/financial-totals.ts`: `getNetWorth`, `getInvestableNetWorth`,
  `getFiPercent`
- `src/lib/plan-projection.ts`: per-year `netWorth`, `investableNetWorth`,
  `fiPercent` and `runwayYears` in `getYearlyPlanProjection`
