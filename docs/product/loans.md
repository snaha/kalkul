# Loans

Draft, 2026-10-29. This describes how Kalkul models borrowed money: what the user
enters, what is stored, what each edit does, and what the dashboard and the
projection engine do with it. It is normative and in the present tense. Where
the current code does something the team has not decided on, the behaviour is
listed under _Open questions_ rather than presented as a rule.

Every number in the worked examples was produced by the engine as it is today.

## Two kinds of loan

Kalkul has two places where money is owed:

- **A liability** is a standalone loan: a renovation loan, a car loan, a
  student loan. It lives in the profile's `liabilities` list and in a plan's
  copy of it.
- **The financing of a tangible asset** is the loan secured by the asset: a
  mortgage on a house, a loan on a car. It is not a separate item. It is a set
  of fields on the asset, present only while the asset's payment method is
  _Financed_. The engine turns these fields into an internal liability to run
  the schedule, but the user never sees it as one, and the plan page lists the
  debt under the asset, not under Liabilities.

The two behave the same way in every respect below unless a rule names one of
them.

## Vocabulary

The same figures carry different labels in Financial data and in the plan
dialogs. Specifications should use the first column.

| Term in this doc | Financial data label     | Plan dialog label        | Field                                             | Meaning                                                                         |
| ---------------- | ------------------------ | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Balance owed     | Outstanding balance      | Principal                | `outstanding_balance`                             | What is still owed on the loan today (or on the day it is taken on, in a plan). |
| Rate             | Annual percentage rate   | Annual percentage rate   | `annual_rate`                                     | Nominal yearly rate, in percent.                                                |
| Installment      | Installment amount       | Installment amount       | `installment_amount`                              | What is paid each period.                                                       |
| Frequency        | Installment frequency    | Installment frequency    | `installment_frequency`                           | Monthly, yearly or weekly.                                                      |
| Term             | Remaining term           | Term                     | `remaining_term`, `remaining_term_unit`           | How long until the loan is paid off, in years (default) or months.              |
| Interest type    | Interest type (advanced) | Interest type (advanced) | `interest_type`, `compounding_frequency`          | Compound at a chosen cadence, or simple. See _Interest_.                        |
| Start            | not shown                | Start                    | `start`, `start_year`, `start_month`, `start_age` | When a plan takes the loan on. Plan only.                                       |
| Pay-off          | not shown                | Pay-off                  | `pay_off`, `pay_off_year`, `pay_off_month`        | When a plan settles the loan early. Plan only.                                  |
| Price            | Value                    | Purchase price           | `value` on the asset                              | What the asset is worth, or costs when bought in a plan.                        |
| Down payment     | not shown                | Down payment             | not stored                                        | Price less balance owed. A display convenience in the asset dialog only.        |

"Principal" in the plan dialog is the balance owed, not the original loan amount.
Kalkul never stores the original amount or the start date of an existing loan.

## Financial data and projections

Financial data is what the user owes today. A projection is a scenario built on
a copy of it. The general rule in AGENTS.md applies: a projection never writes
financial data, and financial data carries no planned timing.

For loans that means:

- A loan in financial data is always running: it has a balance owed, a rate, an
  installment, a frequency and a term, and nothing else. There is no start and
  no pay-off on it. Start and pay-off exist only on a plan's copy.
- The engine tells **debt the user already carries** from **a loan the plan
  takes on** by one fact: whether the liability's id is in the plan's `base`.
  Not by dates, not by names. A liability added inside the plan is a new loan.
  A liability copied from financial data at plan creation is existing debt,
  however the plan has edited it since.
- A new loan pays its balance owed into cash in the year it starts. That is new
  money. Existing debt pays nothing in: that money is already in today's
  balances. Editing an existing loan's balance owed inside a plan changes the
  debt and the schedule, never the cash.
- The same split applies to a financed asset. An asset the plan buys pays its
  down payment out of cash in the purchase year and its loan starts then. An
  asset copied from financial data is already owned and already financed, and
  its loan runs from plan start.

## Rules

### Installment and term describe each other

In every dialog the installment and the term form a pair. The side the user
last edited is the anchor. The other side is derived from the balance owed, the
rate, the frequency and the interest type, and it is re-derived whenever any of
those change. Nothing is derived while the anchor cannot describe a loan: an
empty field, or an installment that does not cover one period's interest.

The derived installment is the fully amortizing payment, rounded to two
decimals. The derived term is in the loan's own unit, rounded to two decimals.

A new loan opens with the term as the anchor.

### The three numbers need not agree

The user may type a balance owed, an installment and a term that do not match.
Kalkul accepts them. In the projection the term decides when the loan ends: the
loan pays its installment each period, and the last scheduled installment pays
whatever is still owed, however large or small that is. An installment that
under-pays leaves a larger final payment; one that over-pays clears the loan
before the term ends and then stops.

### Interest

The rate is nominal and yearly. One period's interest is derived from it as
follows:

- **Simple**: the yearly rate divided by the periods per year.
- **Compound** at a cadence (daily, monthly, yearly): the yearly rate is turned
  into an effective annual rate at that cadence, then into the equivalent rate
  per installment period.
- **Unset**: compound at the installment frequency, which gives the same period
  rate as simple interest. This is the default for every loan that never had
  the advanced options opened.

A loan that says _Compound_ must also say at what cadence.

### The projection works in whole years

A loan's schedule runs period by period, but the projection reports and settles
per calendar year. Installments due in a year are paid from cash in that year.
A start year, a pay-off year and a purchase year each cover the whole year: a
loan that starts in May pays twelve monthly installments in its first year.

Months on Start, Pay-off and Purchase are stored and validated but do not
change the projection.

### Pay-off

A liability with no pay-off, or _Auto, at term_, amortizes for its whole term.
_On specific date_ runs the scheduled installments through the pay-off year and
then pays the rest out of cash in that year. A pay-off before the start means
the loan never happens: nothing is borrowed and nothing is paid.

A financed asset has no pay-off field. Selling the asset settles whatever is
still owed out of the sale proceeds in the year of the sale; the rest of the
proceeds go to cash.

### Debt service on the dashboard

The dashboard's savings rate, financial independence and runway count every
installment as a non-optional outflow, next to living expenses. Only loans with
a balance above zero are counted: a paid-off loan whose installment was never
cleared out costs nothing.

Net worth subtracts every debt, including the debt behind a financed asset.
Investable net worth, which the financial independence figure uses, subtracts
only standalone liabilities: a mortgage is secured by its house and the house
is not investable either.

### Carrying a loan forward to today

The profile holds each balance as of the last snapshot. The dashboard shows
balances as of today by paying the installments that fell due since: whole
periods only, each adding its interest and taking one installment off, floored
at zero, with the loan's last scheduled installment settling the rest. The
elapsed installments also come off the remaining term, so the pay-off date
stays where it was instead of moving later on every update.

Cash is charged for the same installments continuously over the elapsed time.

### Quick update and snapshots

Quick update asks for each loan's balance owed and nothing else about the loan.
A snapshot records the balance and the remaining term with it, so a date in
history restores the term that was true then. A financed asset's snapshot entry
records its debt too; an entry without a debt means the asset was fully owned
on that date.

### Down payment in the asset dialog

The asset dialog shows a down payment, not a balance owed. The two are
complements against the price: balance owed = price − down payment, never
below zero.

- **New asset** (no loan yet): the down payment is what the user has typed, 0
  until they type one. It stays put while the price is typed, and the balance
  owed follows the price. Typing a price of 400,000 with nothing paid down
  finances 400,000.
- **Existing asset**: the balance owed is the truth, it comes from a statement.
  The down payment shown is what the balance implies, and a price edit leaves
  the balance alone. Correcting a typo in the house price does not change the
  mortgage. An asset worth less than it owes shows a down payment of 0 and keeps
  its excess debt.
- Typing a down payment writes the balance owed on both kinds and re-derives
  the installment or the term.
- Switching an asset to _Financed_ when it has no loan yet treats nothing as
  paid down: the whole price is owed. Switching away from _Financed_ drops the
  loan.

### Affordability

Within a year the engine applies income and borrowed principal to cash first,
then transfers (a planned purchase's down payment is one), then expenses and
installments. A purchase the plan cannot pay the down payment for does not
happen: the asset is not acquired and its loan never starts. Installments that
cash cannot cover drive the year's cash to zero and flag that year's expenses;
the installments themselves are not blamed in the sidebar.

## Worked examples

The examples use one profile. Claire, born 1985-05-27. Cash 28,000. Salary
4,000 a month, living expenses 2,000 a month. One financed asset and one
liability:

| Item                 | Price   | Balance owed | Rate | Installment   | Term     | Interest         |
| -------------------- | ------- | ------------ | ---- | ------------- | -------- | ---------------- |
| Family house         | 420,000 | 235,000      | 2.1% | 1,350 / month | 17 years | unset            |
| Home renovation loan |         | 14,500       | 5.2% | 320 / month   | 4 years  | compound monthly |

Amounts are in the profile's currency. Plan examples use an inflation rate of 0
so the figures are nominal; the current projection uses the app's default rate.

### 1. Deriving the installment from the term

Given the house loan with the term anchored at 17 years, when the dialog
derives the installment, then it shows 1,370.79 a month.

Given the same loan with the installment anchored at 1,350, when the dialog
derives the term, then it shows 17.32 years.

Given an installment of 400 a month on 235,000 at 2.1%, which does not cover
the month's interest (411), then the term is not derived and the field keeps
its previous value.

### 2. Changing the balance re-derives the anchored side's counterpart

Given the house loan with the term anchored at 17 years, when the balance owed
becomes 245,000, then the installment becomes 1,429.12.

This is why an existing asset's balance must not follow a price edit: a typo in
the price would silently rewrite the installment on save.

### 3. Interest type

Given the renovation loan, 14,500 over 4 years at 5.2%, the derived monthly
installment is:

| Interest type             | Installment |
| ------------------------- | ----------- |
| Unset                     | 335.24      |
| Simple                    | 335.24      |
| Compound, monthly cadence | 335.24      |
| Compound, daily cadence   | 335.31      |

Compounding at the installment cadence is the same thing as simple interest per
period. Only a cadence finer than the installments changes the figure.

### 4. The dashboard counts installments as outflows

Given the profile above, then yearly debt service is 20,040, which is
(1,350 + 320) × 12. Income is 48,000 and expenses 24,000, so the savings rate is
8.25%, or 3,960 a year.

### 5. Carrying the loans forward to today

Given a snapshot dated 2026-01-01 with the figures above, when today is
2026-07-01 (181 days, five whole monthly installments), then the dashboard
shows:

| Item                 | Balance owed | Remaining term |
| -------------------- | ------------ | -------------- |
| Family house         | 230,290      | 16.58 years    |
| Home renovation loan | 13,203       | 3.58 years     |

Cash is 29,962: 28,000 plus 3,960 a year of net savings for 181 days.

### 6. Existing debt in the current projection

Given the profile above and the current projection starting 2026-07, then the
renovation loan reaches 0 in 2029 and all debt reaches 0 in 2042, when the
house loan's 17-year term ends.

### 7. A plan that takes on a loan

Given a plan created from the profile, with no inflation, when nothing changes,
then cash at the end of 2026 is 31,960 and debt is 234,965.

When the plan adds a liability of 20,000 at 5.2%, 400 a month over 5 years,
starting with the plan, then cash at the end of 2026 is 47,160: the 20,000
borrowed came in, and 4,800 of installments went out. Debt is 251,114.

When the plan instead starts that loan in 2028, then cash and debt in 2026 and
2027 are as without it, and in 2028 cash is 55,080 and debt 220,802.

When the plan instead edits the existing renovation loan's balance from 14,500
to 30,000, then cash at the end of 2026 is still 31,960 and debt is 251,291:
the extra 15,500 is debt the user already carries, not new money.

### 8. Paying a loan off on a date

Given a plan with no inflation, when the renovation loan is set to pay off in
June 2027, then at the end of 2026 it still owes 11,339, at the end of 2027 it
owes 0, and cash in 2027 is 27,910 instead of 35,920: the year's twelve
installments were paid and the remaining 8,010 was settled from cash. The month
has no effect.

### 9. Buying a financed asset in a plan, then selling it

Given the profile with cash 120,000 and a plan with no inflation, when the plan
buys a chalet in May 2028 for 200,000 with 134,000 financed at 3.4%, 770 a
month over 20 years, then:

| Year | Cash    | Tangible assets | Debt    |
| ---- | ------- | --------------- | ------- |
| 2027 | 127,920 | 420,000         | 220,021 |
| 2028 | 56,640  | 620,000         | 333,896 |
| 2029 | 50,549  | 620,000         | 312,357 |

In 2028 the down payment of 66,000 left cash, the asset arrived at its price,
the debt rose by 134,000 less the year's twelve installments, and the
installments have been charged every year since. The purchase month did not
shorten the first year.

When the plan also sells the chalet in June 2031, then in 2031 the asset leaves
at 200,000, the 113,961 still owed on it after that year's installments is
settled from the proceeds, and the remaining 86,039 goes to cash. Debt at the
end of 2031 is 163,034 instead of the 276,995 it would be had the chalet been
kept; cash is 133,708 instead of 47,669.

## Open questions

Behaviour the code has today that no decision backs. Each needs a yes or a
change.

1. **Months are ignored in the projection.** A loan that starts in May pays a
   full year of installments in its first year, and a pay-off in June settles
   after twelve installments. The month fields exist and are required. Either
   the engine honours them or the dialogs stop asking.
2. **Unpaid installments are not flagged.** When cash cannot cover a year's
   installments the year's expenses are blamed in the sidebar, not the loan.
3. **The three loan figures may disagree.** The term wins and the last
   installment absorbs the difference. The dialog could instead show the gap,
   or the engine could use the installment and let the term be informational.
4. **"Principal" in the plan dialog means balance owed.** For a loan the plan
   takes on, the two are the same. For existing debt the label is wrong.
5. **Kalkul does not store the original loan amount or the loan's start date.**
   Nothing needs them today. A loan-to-value figure or an amortization chart
   from day one would.
6. **Simple interest and compound-at-installment-cadence are identical.** The
   advanced option only matters for daily compounding, or for a cadence that
   differs from the installment frequency.

## Where this lives in the code

- Schemas: `profileLiabilitySchema` and `profileTangibleAssetSchema` in
  `src/lib/schemas.ts`.
- Installment ⇄ term: `rederiveLoanPair` in `src/lib/loan-pair.ts`, on top of
  `installmentAmountForLoan` and `termYearsForLoan` in
  `src/lib/plan-projection.ts`.
- Schedules, new versus existing debt, purchase and sale: `simulateLiability`,
  `financingToLiability` and the year loop in `src/lib/plan-projection.ts`.
- Dashboard totals: `getAnnualDebtServiceTotal` and `getInvestableNetWorth` in
  `src/lib/financial-totals.ts`.
- Carry-forward to today: `amortizeLoan` in `src/lib/current-values.ts`.
- Snapshots: `withRecordedDebt` and `recordsDebt` in `src/lib/snapshots.ts`.
- Down payment: `tangible-asset-fields.svelte` and `src/lib/tangible-asset-form.ts`.
