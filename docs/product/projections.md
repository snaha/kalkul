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

| Term in this doc   | UI label                     | Code                                                           |
| ------------------ | ---------------------------- | -------------------------------------------------------------- |
| Financial data     | Financial data, Quick update | `Profile`, written through `updateProfile`                     |
| Projection         | Projection, plan             | `Portfolio`                                                    |
| Base               | not shown                    | `Portfolio.base`, the financial data the plan was created from |
| Outdated           | "Financial data has changed" | `isPlanOutdated`                                               |
| Current projection | Current projection           | `buildCurrentProjectionPlan`, built fresh on every read        |
| Down payment       | Down payment                 | `down_payment` on a projection's tangible asset                |

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

### A financed asset's loan in a projection is its price less the down payment

Financial data knows only what is owed on a financed asset today. A projection
also carries the asset's down payment, the cash paid at purchase, which the
plan dialog asks for whenever the payment method is Financed. The balance owed
in the projection is the purchase price less the down payment, recomputed when
either is edited, and the installment or term follows from it. Nothing fills
the down payment in from the price: a new asset opens with it empty, so an
untouched one is financed in full. The user may change it whether the purchase
is in the past or the future; the projection reruns from its first year either
way.

When a projection is created from financial data the down payment is not
known, so the dialog opens such an asset at the price less the balance owed,
which keeps the projection's loan equal to the dashboard's until the user
types another figure. An asset owing more than it is worth opens at 0 and
keeps its balance until its price or down payment is edited.

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
   installment re-derives. Her house (420,000, 235,000 owed) opens in the
   same dialog with a 185,000 down payment; changing its price there to
   430,000 makes the plan's loan 245,000, while Financial data still says
   235,000 owed.

6. **Every loan is in the breakdown.** A plan holds a standalone loan of
   1,000 paid off at 250 a year, and a house financed with 3,000,000
   outstanding paid off at 300,000 a year, both at 0% interest. Its first year
   lists "Loan" at 750 and "House" at 2,700,000, the house's row marked as tied
   to the house; they add up to the liabilities total of 2,700,750. From the
   fourth year "Loan" stays listed at 0.

## Where this lives in the code

- `createPlan` (`src/lib/plan-defaults.ts`) and `buildCurrentProjectionPlan`
  (`src/lib/current-projection.ts`) take the copy with `snapshotFinancialData`
  (`src/lib/plan-base.ts`), which also holds `isPlanOutdated`.
- A plan's items are written through `src/lib/plan-items.ts`: a dialog saves
  an item with `saveEditedPlanItem`, which applies only the fields it changed
  onto the item as stored now; `upsertPlanItem` writes a whole item (the MCP
  tool) and `removePlanItem` drops one. They are read off the `Portfolio`.
- `profileSchema` and `repairStoredData` in `src/lib/schemas.ts` enforce and
  repair the no-planned-timing rule.
- `financedAmount` and `seededDownPayment` in `src/lib/tangible-asset-form.ts`
  hold the down-payment rule; the plan asset dialog is their only caller.
- The engine is `src/lib/plan-projection.ts`; the MCP tools in
  `src/lib/mcp/tools.ts` expose the same helpers, and their descriptions state
  the same rules. Keep them in sync with this doc.
