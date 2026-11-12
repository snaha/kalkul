# Decisions

Product and strategic decisions, newest first. One entry per decision: the
context in a line or two, the decision, and what it supersedes. Append only;
a reversed decision gets a new entry that names the old one. The reasons live
here, the rules they produce live in `docs/product/`, and the code follows
both.

A PR that makes or changes a decision adds the entry in the same PR. Decisions
made in a review thread or a meeting are added the same day by whoever made
them.

## 2026-11-12 A History chart dot opens a one-column edit of its snapshot

**Context.** #345 asks for a click on a History chart dot to edit that
snapshot, on the dashboard as well as the History page. The History page
already had the full snapshot dialog (frame 911-77498), which can also
re-date a snapshot and writes every field back.

**Decision.** Clicking a recorded dot, on either chart, opens a dialog shaped
like Quick update for that snapshot's date: one column with an input for
every figure the snapshot can hold (cash, investments, each tangible asset's
value and debt, liabilities, incomes and expenses), seeded from the snapshot.
The date cannot be changed there. Confirm writes only the figures the user
typed; everything else in the snapshot stays as recorded, and an item it
never recorded stays unrecorded unless the user types a figure for it. A
financed asset's value and debt are one entry, so editing either writes both.
There is no change column. The History table's Edit keeps the full dialog.

**Why.** A dot is one reading, so the edit is a correction of that reading
rather than a new snapshot; writing back untouched seeded figures would add
estimates the user never confirmed.

## 2026-11-06 The History chart tooltip shows the reading on each date

**Context.** #345 adds a tooltip to the History chart's dots (Figma frame
1360-86910). #292 asks for some reward for updating one's data; showing each
figure's change since the previous snapshot in this tooltip was tried and
dropped, since the frame has no room for it.

**Decision.** Hovering (or focusing) a dot draws a vertical guide and shows
the date, net worth, runway and financial independence on that date, as in
the frame, with no change labels. On the History page a recorded dot opens
its snapshot for editing; the dashboard chart has no edit dialog, so it does
not, which leaves #345 open. #292 stays open.

**Why.** The tooltip follows the design. Savings rate is not in it, following
the #345 frame.

## 2026-11-06 An age is reached in the birthday month

**Context.** A cash flow or transfer timed "when your age is N" resolved to
the whole calendar year the user turns N: one ending at 60 ran through
December of that year and one starting at 60 ran from its January. A salary
ending at 60 and a withdrawal starting at 60 therefore both ran for the whole
year, and the plan showed a year of double income that nothing explained.

**Decision.** An age-based start takes effect in the birthday month of the
year the age is reached, and an age-based end runs until the month before
it, so a flow ending at an age and one starting at the same age hand over
without a gap or an overlap. With a January birthday a flow ending at an age
has no month left in that year and stops with the previous one. The month
comes from the profile's birth date, which the user enters as a month and a
year. This covers incomes, expenses and transfers, whose amounts already
scale with the months active in a year. A start and an end at the same age
is therefore an empty range, and the form and the schema reject it, as they
do a same-year date range that ends before it starts. A planned purchase,
sale or loan timed by age is still a whole-year event in that year, as it
was. The rule is stated in `docs/product/projections.md`.

**Why.** "When your age is 60" names a birthday, and the user plans a
handover at it. Assets and loans are yearly events in the engine, so moving
them to a month is a separate change with its own cases.

## 2026-11-06 A transfer's amount is what arrives after the tax

**Context.** The 2026-11-05 decision below deducted the estimated tax from
the transfer's amount, so a 3,000 a month withdrawal taxed on its gain landed
less than 3,000 in cash, and a plan whose expenses were 3,000 a month ran out
of cash a few years into retirement with no visible cause in the plan.

**Decision.** The amount of a transfer that deducts tax is what the
destination receives. The source gives up the amount plus the tax: with gain
share _g_ and rate _r_, amount / (1 − _g_ · _r_) leaves the source, and the
tax is _g_ · _r_ of that gross. The insufficient-funds check is against the
gross. A "Max" transfer still sweeps the whole balance and lands it less the
tax, as there is nothing to gross up from. A source that holds the amount but
not the tax on top is swept the same way rather than skipped, so entering
exactly the balance still empties it. Exit and entry fees are unchanged:
they still come off on the way, so with fees the destination receives the
amount less the fees. The dialog's extra box shows the gross leaving the
source with the tax and the gain it was applied on; the Figma frames draw it
as a net figure, which is now the amount itself. (#406 follow-up)

**Why.** The user thinks in what they will have to spend, and asks the app to
work out the tax, not the other way round. Grossing up for the fees as well
would be consistent but changes a rule older than the tax switch, so it is
left as it is for now; showing what actually arrives with fees on is #413.

## 2026-11-05 A transfer deducts an estimated tax on its gain

**Context.** With the Settings tax rules gone (#386), nothing in a projection
modelled the tax on selling an investment. The Figma transfer dialog adds a
"Deduct estimated tax" switch with a rate, "applied to a rough estimate of the
gain, based on the investment's APY" (#313).

**Decision.** A transfer may deduct an estimated tax at its own rate from
what leaves an investment. The gain is estimated from the source's APY and
the years it has been held in the plan: a balance that grew by (1 + r)^n is
gain for 1 − (1 + r)^−n of it, so a sale in the plan's first year carries no
tax. The tax comes off the gross gain share, before the exit fee, and reduces
what reaches the destination. Cash has no gain, so the switch is only shown
when the source is an investment. The dialog previews the net transfer, what
arrives after the tax and the fees, with the tax and the gain it was applied
on, and counts the holding years exactly as the engine does. (#313)

**Why.** A plan keeps no cost basis, so the gain since the plan start is the
only estimate it can make without inventing history, and the APY is what the
user already entered. A per-transfer rate puts the tax where the sale is
decided, with no global rule to maintain. The estimate is knowingly rough: it
treats the whole balance as compounding since purchase, so an investment built
by contributions has its gain overstated (1,000 a year for 30 years at 7 % reads
as about 87 % gain where the real share is about 70 %), and it uses the gross
APY while the engine grows the balance at APY less TER and fee drag. The UI
says "rough estimate" for that reason.

## 2026-11-05 Runway is a drawdown the user configures

**Context.** The Runway card divided investable net worth by annual outflows:
one number, no way to see what it assumed, and nothing a user could change
(#219). The Figma dialog offers three switches: withdraw from investments,
include income, sell tangible assets. Under the first and the last a growth
checkbox appears while the switch is on, and a tax rate on the gain while
growth is on (frame 1377 shows everything on, frame 1389 the collapsed
default, revised on 2026-11-03).

**Decision.** Runway is a month-by-month drawdown of today's balances against
today's recurring outflows: cash first, then investments, then tangible
assets, as far as the switches allow. Loans run on their own schedule for
their remaining term, and selling a financed asset settles what it still owes
on that schedule. Investments grow at their effective APY and assets at their
own value-over-time rate only when the growth checkbox is on; nothing else
moves, so the figures are nominal and flat. Tax takes its rate of the gain
accrued since today, since today's balance is the only cost basis Kalkul has,
and the two rates are the runway's own. The defaults are the frame's: investments on
without growth, income and asset sales off, both rates 0. That is close to
the old ratio, not equal to it: loans are paid by installment over time
instead of being subtracted up front, and a loan with no installment is never
paid. Money that never runs out reads "100+ years". Each setting is a flat
optional field on the profile, the shape `fi_withdrawal_rate` uses, so Apply
writes only what changed and the MCP `update_profile` sees them as plain
fields. Projections keep the ratio for their per-year runway. (#391)

**Why.** A drawdown answers the question the card asks, "how long", with the
loans paid as they fall due rather than netted off today, and it lets each
switch mean one visible thing. Tax on the gain since today is the only
estimate that needs no purchase history. Flat fields rather than a nested
object keep one storage shape for both calculation settings and keep the
fields-only save rule.

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
