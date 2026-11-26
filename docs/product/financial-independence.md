# Financial independence

Normative, present tense. How Kalkul measures progress toward living off
investments: the Financial independence card on the dashboard, its settings
dialog, the FI column in History and the per-year FI% of a projection. All
four are one calculation.

## Vocabulary

| UI label                           | Field / code                                 | Meaning                                                           |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| Living cost (annually)             | `getAnnualOutflowsTotal`                     | The yearly outflow level, defined under Rules                     |
| Investable net worth               | `getInvestableNetWorth`                      | Cash plus investments minus loans not secured by an asset         |
| Withdrawal rate                    | `Profile.fi_withdrawal_rate`                 | Percent of the portfolio drawn a year; absent means 4%            |
| Your financial independence number | `getFiNumber`                                | Living cost × 100 / withdrawal rate                               |
| Financial independence             | `getFiPercent`, `YearlyProjection.fiPercent` | Investable net worth as a percent of the FI number, never below 0 |

## Rules

- The FI number is annual outflows × 100 / withdrawal rate. At the default 4%
  that is 25 times the outflows.
- The outflows are a yearly level, not what a year happened to pay: the
  recurring expenses at their yearly rate, a year's property tax on the
  tangible assets, and the installments of loans secured by an asset (the
  financing of a tangible asset) while they are still owed. A one-time expense
  is an event and is not counted.
- The installments of a loan not secured by an asset are not outflows. Its
  balance already comes off the investable net worth, so counting the
  installments as well would count the loan twice.
- FI% is the investable net worth over the FI number, as a percentage, clamped at 0. It is undefined, shown as a dash, when outflows are zero, and on a History row or chart point whose expenses were never recorded.
- The investable net worth is defined in `net-worth.md`. A loan secured by a
  tangible asset (a mortgage) is not subtracted from it; a standalone loan is.
- A projection year reads what the dashboard would read as the year closes:
  the year's closing balances over the outflow level then. The level is the
  recurring expenses still running in December, each at its yearly rate, so
  an expense that started mid-year counts in full and one that ended does
  not; the property tax of the assets held; and the installments of the
  secured loans still owed. What the year actually paid (a one-time expense,
  a loan's pay-off, a few months of a new expense) does not move it.
- The withdrawal rate is above 0 and at most 100. The schema rejects anything
  else and the dialog disables Apply.
- The rate is a flat optional field on the profile, the shape the runway
  switches use too (`docs/product/runway.md`).
- The rate is a setting, not financial data. One rate applies to the card,
  every History row and every year of every projection; a projection does not
  copy it, and History rows use today's rate.
- The dialog shows the living cost and the investable net worth with a tooltip
  each, the withdrawal rate with a tooltip and a one-line description beside
  the field, and the FI number it implies with its own description. It
  previews the edit live; nothing is written until Apply. Reset puts the
  field back to 4% without applying.
- The landing page sample always uses 4%.

## Worked examples

1. Cash 620,000, expenses 40,000 a year, no loans. At 4% the FI number is
   1,000,000 and FI% is 62%. At 2% the FI number is 2,000,000 and FI% is 31%.
   At 5% FI% is 77.5%.
2. The same household with a financed house paying 790 a month: outflows are
   49,480 a year, the portfolio stays 620,000, FI% at 4% is 620,000 /
   1,237,000 ≈ 50.1%.
3. A projection year with investments 100,000 and expenses 10,000 at a 2%
   rate: FI number 500,000, FI% 20%.
4. A rate of 0, -1 or 1000 is rejected by the schema.
5. The household of example 1 with a car loan of 20,000 repaid at 1,000 a
   month: the investable net worth is 600,000 and the outflows stay 40,000, so
   FI% is 60%. Counting the installments too would give 600,000 / 1,300,000 =
   46.2%.
6. The household of example 1 owning a house worth 200,000 taxed at 1%:
   outflows 42,000, FI number 1,050,000, FI% 59.0%.
7. A projection from 2025 with cash 200,000, living expenses of 10,000 a year
   and a car bought for 50,000 in June 2025: 2025 closes with 140,000 against
   a level of 10,000, FI% 56%. The car is not an outflow.
8. A projection from 2025 with cash 100,000 and rent of 1,000 a month from
   July 2025 to June 2026: 2025 pays 6,000 and closes with 94,000 against a
   level of 12,000, FI% 31.3%. 2026 closes with nothing running: a dash.

## Open questions

- The dialog's labels and tooltips no longer match the designer's frame (#220):
  "Current portfolio value" is "Investable net worth", and both tooltips say
  what the code counts. The frame has not been redrawn.
- A mortgage's installments are still multiplied by 25 like a permanent
  expense, although they end with the loan. Carrying the loan by its balance
  instead is not decided.
- The savings rate and the runway count every loan's installments, since
  both pay them out of cash, while FI % leaves out the loans whose balance it
  already subtracted. All three count property tax.
- The #220 thread also raised counting tangible assets in the investable net worth
  and letting the user try a lower living cost. The revised frame has neither,
  so the dialog does not; either needs its own issue if wanted.

## In the code

- `src/lib/financial-totals.ts`: `getAnnualOutflowsTotal`, `getFiNumber`,
  `getFiPercent`, `getInvestableNetWorth`
- `src/lib/plan-projection.ts`: `fiPercentOf`, the one formula, and the
  per-year `fiPercent` in `getYearlyPlanProjection`
- `src/lib/snapshot-rows.ts`: History rows
- `src/lib/history-series.ts`: FI% on each recorded date for the History chart
  tooltip
- `src/lib/schemas.ts`: `fi_withdrawal_rate`, `DEFAULT_FI_WITHDRAWAL_RATE`
- `src/routes/(app)/fi-settings-dialog.svelte`: the dialog
