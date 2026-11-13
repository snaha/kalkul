# Financial independence

Normative, present tense. How Kalkul measures progress toward living off
investments: the Financial independence card on the dashboard, its settings
dialog, the FI column in History and the per-year FI% of a projection.

## Vocabulary

| UI label                           | Field / code                                 | Meaning                                                      |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Living cost (annually)             | `getAnnualOutflowsTotal`                     | Expenses plus loan installments, annualized                  |
| Current portfolio value            | `getInvestableNetWorth`                      | Cash plus investments minus loans not secured by an asset    |
| Withdrawal rate                    | `Profile.fi_withdrawal_rate`                 | Percent of the portfolio drawn a year; absent means 4%       |
| Your financial independence number | `getFiNumber`                                | Living cost × 100 / withdrawal rate                          |
| Financial independence             | `getFiPercent`, `YearlyProjection.fiPercent` | Portfolio value as a percent of the FI number, never below 0 |

## Rules

- The FI number is annual outflows × 100 / withdrawal rate. At the default 4%
  that is 25 times the outflows.
- FI% is the portfolio value over the FI number, as a percentage, clamped at 0. It is undefined, shown as a dash, when outflows are zero, and on a History row or chart point whose expenses were never recorded.
- Loan installments are outflows. A loan secured by a tangible asset (a
  mortgage) is not subtracted from the portfolio; a standalone loan is.
- The withdrawal rate is above 0 and at most 100. The schema rejects anything
  else and the dialog disables Apply.
- The rate is a flat optional field on the profile, the shape the runway
  switches use too (`docs/product/runway.md`).
- The rate is a setting, not financial data. One rate applies to the card,
  every History row and every year of every projection; a projection does not
  copy it, and History rows use today's rate.
- The dialog shows the living cost and the portfolio value with a tooltip
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

## Open questions

- The dialog uses the designer's tooltips verbatim (#220, 2026-11-05), with
  "instalments" spelled "installments" as the app does elsewhere. The
  living-cost one, "expenses plus loan and other liability installments", says
  what the code does. The portfolio one says "minus what you owe", while the
  code subtracts only loans not secured by an asset, so a mortgage stays out
  with the house that secures it. Whether a mortgage should count is not
  confirmed with the designer.
- The #220 thread also raised counting tangible assets in the portfolio value
  and letting the user try a lower living cost. The revised frame has neither,
  so the dialog does not; either needs its own issue if wanted.

## In the code

- `src/lib/financial-totals.ts`: `getAnnualOutflowsTotal`, `getFiNumber`,
  `getFiPercent`, `getInvestableNetWorth`
- `src/lib/plan-projection.ts`: per-year `fiPercent` in `getYearlyPlanProjection`
- `src/lib/snapshot-rows.ts`: History rows
- `src/lib/history-series.ts`: FI% on each recorded date for the History chart
  tooltip
- `src/lib/schemas.ts`: `fi_withdrawal_rate`, `DEFAULT_FI_WITHDRAWAL_RATE`
- `src/routes/(app)/fi-settings-dialog.svelte`: the dialog
