# Decisions

Product and strategic decisions, newest first. One entry per decision: the
context in a line or two, the decision, and what it supersedes. Append only;
a reversed decision gets a new entry that names the old one. The reasons live
here, the rules they produce live in `docs/product/`, and the code follows
both.

A PR that makes or changes a decision adds the entry in the same PR. Decisions
made in a review thread or a meeting are added the same day by whoever made
them.

## 2026-11-05 A snapshot's unrecorded cash flows stay unrecorded

**Context.** Snapshots saved before cash flows were recorded, a window of about
four days in September, were filled from the profile's current flows on load,
and the next save stored those as if recorded on that date. #287 proposed
leaving them absent in storage and falling back at read time.

**Decision.** Nothing fills them in, in storage or at read time. An omitted list
means nothing was recorded, as in every other section of a snapshot, and a
History row without recorded expenses shows a dash for Financial independence.
The snapshot dialog opens such flows at zero, and confirming it saves those
zeros. This settles #287 differently from what it proposed. (#396)

**Why.** Browsers that saved since September already hold the filled-in flows,
and those look exactly like recorded ones, so a read-time fallback could not
correct them. That leaves only browsers that have not saved since and backups
from that window, which does not justify a fallback before Kalkul has users to
keep. Zeros in the dialog are accepted because the case is rare and a zero looks
wrong on screen.

## 2026-11-05 No capital gains tax rules in Settings

**Context.** The Settings page let the user enter default capital gains tax
rules by holding period, and a projection taxed the gain share of an
investment withdrawal at the matching rate, which needed a cost basis per
investment. The cost-basis work in #344 concluded that a plan keeps no cost
basis, and the rules were left behind (#386).

**Decision.** The tax rules, their profile fields and the cost-basis tracking
are removed. A projection charges no capital gains tax on a withdrawal; only
the exit and entry fees apply. Tax on a transfer's gain is instead an estimate
the user turns on per transfer, from the investment's APY and the years held
(#313). The runway's own tax rates (#391) are unaffected, as they never read
these rules. (#386)

**Why.** Rules the user types by holding period need a cost basis to apply
to, which the plan no longer keeps, and nothing but the projection's
withdrawal path read them. A per-transfer estimate asks for one rate where it
is used. Pre-production data needs no migration.

## 2026-11-05 A projection stores a financed asset's down payment

**Context.** The plan dialog showed the down payment as the price less the
balance owed. A new asset has no balance, so the field filled in with the
price as it was typed (#263), and every attempt to hold it (#307, #381) had to
decide per keystroke whether the price or the balance wins, with a different
answer for a new, an existing, a paid-off and an underwater asset.

**Decision.** A tangible asset in a projection carries `down_payment`. The
projection's loan is the price less the down payment, recomputed when either
is edited; nothing fills the down payment in from the price. An asset copied
from financial data, which knows only the balance owed, opens at the price
less that balance, so the projection agrees with the dashboard until the user
types another figure. Financial data does not store a down payment.
Supersedes the derived field from #228's dialog.

**Why.** The two numbers answer different questions: what was paid in cash,
and what is owed now. Financial data needs only the second, which comes from a
statement and amortizes forward. A projection is a scenario rerun from its
first year, so there the first is an input the user may change, past or
future, and the second follows from it. Deriving one from the other in the
dialog was the source of every regression.

## 2026-11-05 Liabilities include the loans behind financed assets

**Context.** A plan's liabilities total counted the loans behind financed
tangible assets, but the per-item breakdown beside it listed standalone
liabilities only, so the rows did not add up and an MCP agent could not say
what the debt was (#390).

**Decision.** Liabilities include the loans from tangible assets. Every
liability is always shown, whether or not it is attached to an asset, and the
sidebar marks the ones linked to an asset under Liabilities. A paid-off loan
stays listed at 0. This replaces the earlier code rule that a financing is
tracked as part of its asset only. (#390)

## 2026-10-29 Financial independence uses a withdrawal rate the user sets

**Context.** The Financial independence card compared investable wealth with
25 times annual outflows, the 4% rule, with no way to see or change that
(#220). The Figma dialog shows the inputs and lets the rate be changed.

**Decision.** The FI number is annual outflows, expenses plus loan
installments, times 100 over the withdrawal rate; FI% is the portfolio over
that number. The portfolio is cash plus investments minus standalone loans. The
rate lives on the profile, defaults to 4%, must be above 0 and at most 100, and
applies everywhere FI% is shown: the dashboard card, the History table and each
year of a projection. The landing page sample keeps 4%. (#392)

**Why.** Installments count as outflows because they are paid every month
whether or not the household works; leaving them out would call someone with
a large mortgage independent too early. A mortgage is not subtracted from the
portfolio because the house that secures it is not in the portfolio either;
subtracting one without the other would count the house as a pure debt. Both
keep the card's existing behaviour, so at 4% no figure moves. The dialog copy
says so rather than "minus liabilities". The rate is a setting about how the
user reads their numbers, not financial data: it sits on the profile next to
the language, a projection reads the live rate rather than copying it the way
it copies `inflation_rate`, and History rows recompute with today's rate, so
changing it moves every FI figure at once and they stay comparable.

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
Example personas moved their future-dated items (Jan's pension) onto their
plans. (#366, closes #318)

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
money is already in today's balances. (#323, closes #322)

## 2026-09-25 Cash always exists

**Context.** A plan could exclude cash, which turned every flow through it into
a special case.

**Decision.** Every plan has a cash balance and every flow runs through it,
with the insufficient-funds check always applied. A plan cannot exclude cash.
(#332)

## 2026-09-08 Pre-production: no backwards compatibility

**Context.** Kalkul has no production users whose data it is committed to
keeping; everything lives in the user's browser.

**Decision.** Schemas, stored shapes, storage keys and the MCP surface may
change in place, with the old path deleted. Transitional repair helpers exist
only to smooth a change in progress. This holds until kalkul.app is announced
publicly. (AGENTS.md, project status)
