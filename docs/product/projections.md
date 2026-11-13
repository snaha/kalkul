# Financial data and projections

Normative, present tense. This is the one-way rule the rest of the product is
built on: projections read financial data and never write it. Moved here from
AGENTS.md on 2026-10-29; the rules are unchanged.

## Two kinds of data

**Financial data** is what the user has today: the profile's cash, investments,
tangible assets, liabilities, incomes, expenses and transfers.

A **projection** (a "plan", `Portfolio` in code) is a scenario computed from it.
The dependency is one-way: projections read financial data, they never write it.

## Vocabulary

| Term in this doc   | UI label                     | Code                                                            |
| ------------------ | ---------------------------- | --------------------------------------------------------------- |
| Financial data     | Financial data, Quick update | `Profile`, written through `updateProfile`                      |
| Projection         | Projection, plan             | `Portfolio`                                                     |
| Base               | not shown                    | `Portfolio.base`, the financial data the plan was created from  |
| Outdated           | "Financial data has changed" | `isPlanOutdated`                                                |
| Current projection | Current projection           | `buildCurrentProjectionPlan`, built fresh on every read         |
| Down payment       | Down payment                 | `down_payment` on a tangible asset added in a projection        |
| Imported           | "Local override"             | an item whose id is in its list in `base`, `isImportedPlanItem` |
| Birth month        | Date of birth, in Settings   | `Profile.birth_date`, a month and a year                        |

## Rules

### Financial data is edited in exactly two places

The Financial data pages (`src/routes/(app)/financial-data/`, plus the
onboarding editors that share their components) and Quick update
(`confirmBalances`). Nothing under `src/routes/(app)/plan/` and no
projection-side MCP tool may call `updateProfile`, `confirmBalances` or
`saveSnapshot`. An ESLint rule in `eslint.config.mjs` rejects profile writes
under the plan routes.

### A projection is a copy

A projection is built on a copy of financial data taken when it is created, or
on nothing when the user chooses not to start from their current finances. The
`Portfolio` holds that copy: `cash_amount` and its own `investments`,
`tangible_assets`, `liabilities`, `incomes`, `expenses` and `transfers`.

Whatever the user changes while working on a projection lands on that copy
only, including cash, edits, duplicates and deletes. "Delete" inside a
projection means "this projection no longer has it"; the item stays in
financial data and in every other projection.

The reverse holds too: a projection's items stay out of financial data and out
of every other projection. Current-data readers (totals, the dashboard,
snapshots, Quick update, onboarding) never see a projection's items.

### A projection does not follow financial data

After creation a projection does not change when financial data does. The
`base` is the financial data it was created from, kept untouched.
`isPlanOutdated` (`src/lib/plan-base.ts`) compares it with current financial
data so the plan page can say the projection is outdated.

Bringing a projection up to date with current financial data is a planned
feature, not built yet. When it comes, `base` is the common ancestor of the
three-way merge.

**Never write `base` after creation.** Only `createPlan` and
`buildCurrentProjectionPlan` set it. No dialog, store method or MCP tool may
change it; an update that touched it would make the outdated check and the
future merge lie. The one exception is `repairStoredData`, which brings a
stored `base` up to the current schema exactly as it does the profile: a repair
changes the shape of what was recorded, not what the user had, and leaving
`base` behind would make the outdated check report the repair as a change.

### Financial data carries no planned timing

When something starts, ends, is bought, sold or paid off is a modelled change.
It lives on the projection's copy of the item, never on the profile. A profile
item is always already running: start `immediately` or `now`, end `never`,
pay-off at term, no exit or sale date, and never one-time. `profileSchema`
rejects anything else, so a new projection always starts every financial-data
item at the plan's start with no end.

Stored data from before this rule is repaired on load: every plan first takes
its copy of the items it included, timing intact, and only then is the profile
stripped. An item that is running on the repair date is set to running; one
that has not started yet, or has already ended, been sold or been paid off, is
dropped from financial data with a console warning. The plans keep their timed
copies.

### Existing debt versus a loan the plan takes on

The engine tells a loan the plan takes on from debt the user already carries by
one fact: whether the liability's id is in `base.liabilities`. Never by dates
or names. A new loan pays its balance into cash in the year it starts; existing
debt pays nothing in, however the plan has edited it since.

### The liabilities breakdown lists every loan

A projection's per-year liabilities breakdown (`liabilitiesByItem`, the plan
page's "Liabilities balance" and the MCP `get_projection` output) lists every
liability, so its rows add up to the liabilities total. That includes the loan
behind each financed tangible asset: one row per asset, named after it,
carrying the asset's id as `assetId` and marked in the sidebar as tied to the
asset. A loan stays listed at 0 while it is not owed: before a planned
purchase, after it is paid off or settled by a sale, and when the plan could
not afford the purchase.

### An imported item is edited as a local override

An item the projection was created with is imported; one added in the plan is
not. The plan dialogs tell them apart by one fact: whether the item's id is in
its list in `base` (`isImportedPlanItem`), the same fact the engine uses for
existing debt. An imported item's dialog opens with a "Local override" notice
(edits stay in this projection; it calls an income, expense or transfer "this
cash flow" and anything else "this asset"), has no name field, and keeps its less-used
fields in sections that are closed until the user opens them:

| Item           | Always shown                                                        | Section                                            | Not shown              |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------- | ---------------------- |
| Investment     | Initial balance, Annual return                                      | Fees, Exit                                         | Start                  |
| Tangible asset | Initial value, Status, Outstanding balance when financed            | Financing details (financed), Value & tax, Sale    | Purchase, Down payment |
| Liability      | Outstanding balance, frequency, rate, Installment ⇄ Remaining term  | Pay-off & interest                                 | Start, Principal       |
| Income/expense | Schedule, Frequency, Amount, Adjust for inflation, the totals box   | Timeline (Start, End, Change over time), recurring |                        |
| Transfer       | From, To, Type, Frequency, Amount, Adjust for inflation, totals box | Timeline (Start, End, Change over time), recurring |                        |

Balances and values are as of the projection's start. A field that is not
shown keeps whatever the item stores. An imported item is not renamed in a
projection: its name is the one financial data gives it. An item added in the
plan keeps the full dialog, with the name, its start or purchase, and the
"Show advanced options" switch. The cash dialog always shows the notice, since
a plan's opening cash is always copied from financial data. The exit of an investment and the planned
sale of a tangible asset are the same field for both.

### An asset added in a projection is bought there; an imported one is already owned

**Added in the plan.** The asset is a purchase the plan makes, so the dialog
asks for the purchase date, the purchase price, the payment method and,
whenever that is Financed, the down payment: the cash paid at purchase. The
balance owed is the purchase price less the down payment, recomputed when
either is edited, and the installment or term follows from it. Nothing fills
the down payment in from the price: a new asset opens with it empty, so an
untouched one is financed in full. The user may change it whether the purchase
is in the past or the future; the projection reruns from its first year either
way.

**Imported.** The asset is already owned, so there is no purchase and no down
payment. The dialog opens with a "Local override" notice (edits stay in this
projection) and shows what financial data knows, as of the projection's
start: the Initial value, the Status (Fully owned or Financed) and, when
financed, the Outstanding balance, which is edited directly. Editing the
value does not change the balance, so an asset owing more than it is worth
keeps its balance.

An asset an MCP tool wrote into a plan with a balance but no down payment
opens at the price less the balance owed. Financial data does not store a
down payment: `profileSchema` rejects it, and the MCP `update_profile` and
`upsert_plan_item` descriptions say which copy carries which field.

### An age is reached in the birthday month

A start or end "when your age is N" on an income, expense or transfer resolves
to a month, not a year: the month the user turns N, from the birth month and
year in the profile. A start at an age runs from that month. An end at an age
runs until the month before it, so a flow ending at an age and one starting
at the same age hand over with no gap and no overlap. With a January birthday
an end at an age leaves no month in that year, and the flow stops with the
previous year. The previews in the dialogs count the same months.

A start and an end at the same age, or an end at an earlier age, is an empty
range: `profileSchema` rejects it and the dialogs say so under the end age,
as they do for a same-year date range that ends before it starts. An end at
an age reached in the plan's first year is rejected the same way when no
month of that year is left before the birthday.

A planned purchase, sale or loan timed by an age is still a whole-year event
in the year the age is reached.

### When a feature seems to need a projection to write financial data

The answer is a projection-level setting, never a profile write. Raise it
rather than papering over it.

## Worked examples

1. **An edit in a projection stays there.** Claire's financial data has an ETF
   contribution of 950 a month. In her "Family plan to 65" she raises it to
   1,200. Financial data still says 950, her other plan still says 950, and
   the dashboard's savings rate is computed from 950.
2. **Financial data changing does not reach a projection.** Claire then changes
   the contribution to 1,000 in Financial data. Both plans keep what they had
   (1,200 and 950). The plan page marks both as outdated, because their `base`
   says 950 and financial data now says 1,000.
3. **Delete inside a projection.** Claire deletes the rental apartment from
   "Buy a holiday home in 2030". The apartment is still in Financial data and
   in "Family plan to 65". The dashboard's tangible assets total still
   includes it.
4. **Timing lives on the plan.** Jan's pension starts at 65. It is not
   something Jan has today, so it does not exist in the financial data at all;
   it exists only on the retirement plan, with its start age. A new plan
   created from the financial data does not have it.
5. **A plan takes on a loan.** Claire adds a 20,000 loan to a plan. In the
   plan's first year cash goes up by 20,000 less that year's installments. If
   she instead edits her existing renovation loan's balance from 14,500 to
   30,000 inside the plan, cash does not move; only the debt and its schedule
   change.
6. **A down payment lives on the projection.** Claire adds a financed car to a
   plan and types a price of 30,000. The down payment stays empty, so the car
   is financed in full. She types 5,000 down: the loan is 25,000 and the
   installment re-derives. Her house (420,000, 235,000 owed) came from
   financial data, so its dialog has no down payment: it shows an initial
   value of 420,000 and an outstanding balance of 235,000. Changing the value
   there to 430,000 leaves the plan's loan at 235,000; typing a balance of
   200,000 makes the plan's loan 200,000 and re-derives the installment,
   while Financial data still says 235,000 owed.

7. **Every loan is in the breakdown.** A plan holds a standalone loan of
   1,000 paid off at 250 a year, and a house financed with 3,000,000
   outstanding paid off at 300,000 a year, both at 0% interest. Its first year
   lists "Loan" at 750 and "House" at 2,700,000, the house's row marked as tied
   to the house; they add up to the liabilities total of 2,700,750. From the
   fourth year "Loan" stays listed at 0.
8. **An age is a month.** Jan is born in March 1979. In his plan the salary
   ends at 60 and the pension starts at 60. In 2039 the salary pays January
   and February and the pension March to December: twelve months of income,
   none of them doubled. Were Jan born in January, the salary's last month
   would be December 2038. A flow set to run from 45 to 45 is rejected in
   the dialog, since it would have no month to run.

## Where this lives in the code

- `createPlan` (`src/lib/plan-defaults.ts`) and `buildCurrentProjectionPlan`
  (`src/lib/current-projection.ts`) take the copy with `snapshotFinancialData`
  (`src/lib/plan-base.ts`), which also holds `isPlanOutdated`.
- `isImportedPlanItem` (`src/lib/plan-items.ts`) tells an imported item from
  one added in the plan; `local-override-notice.svelte` and
  `src/lib/components/form-section.svelte` are the notice and the sections.
- A plan's items are written through `src/lib/plan-items.ts`: a dialog saves
  an item with `saveEditedPlanItem`, which applies only the fields it changed
  onto the item as stored now; `upsertPlanItem` writes a whole item (the MCP
  tool) and `removePlanItem` drops one. They are read off the `Portfolio`.
- `profileSchema` and `repairStoredData` in `src/lib/schemas.ts` enforce and
  repair the no-planned-timing rule.
- `activeMonthFraction` and `birthOf` in `src/lib/plan-projection.ts` place an
  age in its month; `ageRangeEmpty` in `src/lib/schemas.ts` rejects an empty
  range of ages and `timingWithinPlan` in `src/lib/plan-range.ts` an end
  with no month left in the plan.
- `financedAmount` and `seededDownPayment` in `src/lib/tangible-asset-form.ts`
  hold the down-payment rule; the plan asset dialog is their only caller.
- The engine is `src/lib/plan-projection.ts`; the MCP tools in
  `src/lib/mcp/tools.ts` expose the same helpers, and their descriptions state
  the same rules. Keep them in sync with this doc.
