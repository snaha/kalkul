# Decisions

Product and strategic decisions, newest first. One entry per decision: the
context in a line or two, the decision, and what it supersedes. Append only;
a reversed decision gets a new entry that names the old one. The reasons live
here, the rules they produce live in `docs/product/`, and the code follows
both.

A PR that makes or changes a decision adds the entry in the same PR. Decisions
made in a review thread or a meeting are added the same day by whoever made
them.

## 2026-10-29 Repair drops items that are not running today

**Context.** Converting stored data to the no-planned-timing rule had to do
something with a profile item dated in the future or the past. Marking every
such item as running turned a pension starting in 2040 and a house to be bought
in 2030 into today's net worth.

**Decision.** The repair decides against the repair date. Started and not yet
ended becomes running. Not started yet, or already ended, sold or paid off, is
dropped from financial data with a console warning. Plans keep their timed
copies. (#366)

## 2026-10-29 Financial data carries no planned timing

**Context.** Plan dialogs used to write start, end, exit, sale and pay-off dates
onto the profile item, so an edit in one projection showed up in the next.

**Decision.** A profile item is always already running: start now, end never,
pay-off at term, no exit or sale date, never one-time. The schema rejects
anything else. Timing is a modelled change and lives on the projection's copy
only. A new projection starts every item at the plan's start with no end.
Example personas moved their future-dated items (Pavel's pension) onto their
plans. (#366, closes #318)

## 2026-10-29 Existing loans keep their balance through a price edit

**Context.** The asset dialog shows a down payment but stores the balance owed.
Deriving the down payment from the balance on every keystroke filled it with
the purchase price as it was typed (#263). Holding the typed down payment for
every asset moved an existing mortgage when its house price was corrected.

**Decision.** A new asset holds the typed down payment and its balance follows
the price. An existing asset's balance owed is the truth, it comes from a
statement, and a price edit leaves it alone. (#381)

## 2026-10-19 A dialog saves only the fields it changed

**Context.** Saving a whole item from a dialog overwrote edits made to the same
item elsewhere, in another tab or by the MCP tools.

**Decision.** A dialog applies only the fields the user changed onto the item
as stored now. (#342, after #341 did the same for the list editors)

## 2026-10-17 A projection is a copy and does not follow financial data

**Context.** Projections read financial data live and stored only their
overrides, so a plan could never be built on a different premise and an edit
inside a plan leaked into the profile. The alternative discussed in review was
storing overrides as patches merged over current financial data.

**Decision.** A projection is a copy of financial data taken when it is
created, or empty when the user chooses not to start from their finances.
Whatever changes inside the projection lands on the copy. It does not follow
financial data afterwards; the plan page says when financial data has changed
since. Bringing a plan up to date is a planned feature with the plan's `base`
as the merge ancestor. Projections never write financial data; an ESLint rule
enforces it under the plan routes. (#364, confirmed in the #366 review)

## 2026-09-25 A loan the plan takes on pays its principal into cash

**Context.** Adding a liability to a plan raised the debt but not the cash, so
borrowing looked like losing money.

**Decision.** A liability the plan takes on pays its balance into cash in the
year it starts. Debt the plan was created with pays nothing in, because that
money is already in today's balances. The engine tells the two apart by
whether the id is in the plan's base. (#323, closes #322)

## 2026-09-25 Cash always exists

**Context.** A plan could exclude cash, which turned every flow through it into
a special case.

**Decision.** Every plan has a cash balance and every flow runs through it,
with the insufficient-funds check always applied. Excluding cash only zeroes
the opening balance. (#332)

## 2026-09-08 Pre-production: no backwards compatibility

**Context.** Kalkul has no production users whose data it is committed to
keeping; everything lives in the user's browser.

**Decision.** Schemas, stored shapes, storage keys and the MCP surface may
change in place, with the old path deleted. Transitional repair helpers exist
only to smooth a change in progress. This holds until kalkul.app is announced
publicly. (AGENTS.md, project status)
