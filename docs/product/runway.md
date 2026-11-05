# Runway

Normative, present tense. How Kalkul estimates how long the money lasts: the
Runway card on the dashboard and its settings dialog.

## Vocabulary

| UI label                           | Field / code                             | Meaning                                                         |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Runway                             | `getRunwayYears` in `src/lib/runway.ts`  | Years until the money runs out, one decimal; "100+ years" past  |
| Allow withdrawing from investments | `Profile.runway_withdraw_investments`    | Investments are sold once cash is gone; absent means on         |
| Include investment growth          | `Profile.runway_investment_growth`       | Investments grow at their effective APY; absent means off       |
| Tax rate on investment gains       | `Profile.runway_investment_tax_rate`     | Percent of the gain since today taken at a sale; absent means 0 |
| Include scheduled income           | `Profile.runway_include_income`          | Recurring income offsets the outflows; absent means off         |
| Allow selling tangible assets      | `Profile.runway_sell_tangible_assets`    | Assets are sold once investments are gone; absent means off     |
| Include value growth               | `Profile.runway_tangible_asset_growth`   | Assets follow their own value-over-time rate; absent means off  |
| Tax rate on tangible asset gains   | `Profile.runway_tangible_asset_tax_rate` | Percent of the gain since today taken at a sale; absent means 0 |
| Outflows                           | expenses plus loan installments          | What drains cash every month                                    |

## Rules

- Runway is a month-by-month drawdown of today's balances against today's
  recurring flows. Each month the outflows come out of cash; when cash runs
  short, investments are sold in list order; when those are gone, tangible
  assets are sold whole, in list order. Each stage only when its switch is on.
- Outflows are the recurring expenses plus every loan installment, standalone
  loans and the financing of tangible assets alike. Income counts only when
  "Include scheduled income" is on.
- A loan runs on its own schedule: the installment and the interest of each
  period, spread over the months, for its remaining term, with the last month
  settling whatever is left. A loan with no installment is never paid and does
  not drain cash.
- Selling a financed asset nets the asset's value less what the loan still
  owes at that point, settles the loan and ends its installments. An asset
  worth less than its loan is not sold.
- Investments grow by their effective APY (after TER and ongoing fees), applied
  monthly, only when "Include investment growth" is on. Tangible assets follow
  their own value-over-time rate, appreciation or depreciation, only when
  "Include value growth" is on; an asset with no rate set stays put. Nothing
  else moves: expenses and income stay flat, and there is no inflation.
- Tax applies to the gain accrued since today only, since today's balance is
  the only cost basis Kalkul has. A sale of an investment nets the amount sold
  less the tax rate times its gain share; a sale of an asset nets its value
  less the tax on its gain and less the loan. With growth off there is no gain
  and the rate changes nothing. Each rate is 0 to 100; the schema rejects the
  rest and the dialog disables Apply.
- The dialog shows the growth checkbox only while its switch is on, and the
  tax rate only while growth is on.
- The month the money runs out in counts by the share of its net outflow that
  was covered. Cash already below zero against no net surplus is 0 years.
- Money that never runs out, or outlasts 100 years, reads "100+ years". With
  nothing to pay the card shows a dash.
- The settings are flat fields on the profile, one per switch, absent meaning
  the default. They are settings, not financial data: a projection does not
  copy them, and the per-year runway in a projection keeps its ratio of
  investable wealth to outflows (`getYearlyPlanProjection`).
- The dialog previews the edit live; Apply writes only the fields that changed;
  Reset puts the switches back to the defaults without applying.

## Worked examples

1. Cash 620,000, expenses 40,000 a year, nothing else: 15.5 years.
2. Cash 12,000, income 1,000 and expenses 2,000 a month. With income on, 1
   year; with the default, income off, 0.5 years.
3. Cash 6,000 and an ETF of 6,000 against 1,000 a month: 1 year by default.
   With investment withdrawals off, 0.5 years.
4. An ETF of 1,000 growing 1% a month against 500 a month: 1,010 less 500
   leaves 510; 515.10 less 500 leaves 15.10; 15.25 covers 3% of the third
   month. Runway 2.03 months. Without growth, exactly 2 months.
5. An ETF of 12,000 growing 1% a month against 100 a month: the growth exceeds
   the draw, so 100+ years.
6. An ETF of 1,000 growing 1% a month against 1,500 a month, taxed at 50%:
   after a month it is worth 1,010 with 10 of gain, sells for 1,005 net, and
   covers 67% of the month. Taxed at 100% it sells for the basis, 1,000, the
   same as without growth.
7. A car worth 10,000 appreciating 1% a month, sold with 50% tax after a
   month against 2,000 a month: worth 10,100, 50 of tax on the 100 gain, 8,050
   left after the month's shortfall covers 4.025 more months. Depreciating 1%
   a month it sells for 9,900 with nothing to tax: 3.95 more months.
8. A flat worth 20,000 with 12,000 owed at 12% a year, 1,000 a month, against
   expenses of 2,000 and no cash, with asset sales on. The first month's
   installment leaves 11,120 owed; the flat sells for 8,880 net, which after
   the month's 3,000 shortfall covers 2.94 more months. Runway 3.94 months.
9. A loan of 12,000 at 1,000 a month for a year beside expenses of 1,000, from
   cash of 30,000: 2,000 a month for twelve months, then 1,000 a month for the
   remaining 6,000. 1.5 years.
10. Cash −1,000 against 1,000 a month: 0 years. The same cash with income of
    3,000 against 2,000: 100+ years, since nothing drains.

## Open questions

- Growth is nominal while the outflows stay flat, which flatters a long runway.
  Whether to deflate growth by an inflation rate, and whose rate, is not
  decided.
- The two tax rates are the runway's own; whether the holding-period tax rules
  on the Settings page should feed them is not decided (#391).
- Property tax on tangible assets is not an outflow here, as it is not in the
  dashboard's cash flow either.
- Exit fees on investments are ignored on the way out.

## In the code

- `src/lib/runway.ts`: `getRunwayYears`, `runwaySettingsOf`,
  `changedRunwaySettings`, `validRunwaySettings`, `DEFAULT_RUNWAY_SETTINGS`,
  `RUNWAY_CAP_YEARS`
- `src/lib/schemas.ts`: the seven `runway_*` fields on `profileFieldsSchema`
- `src/routes/(app)/runway-settings-dialog.svelte`: the dialog
- `src/routes/(app)/+page@.svelte`: the Runway card
- `src/lib/plan-projection.ts`: the per-year `runwayYears` ratio in projections
