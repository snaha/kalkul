# Decisions

Product and strategic decisions, newest first. One entry per decision: the
context in a line or two, the decision, and what it supersedes. Append only;
a reversed decision gets a new entry that names the old one. The reasons live
here, the rules they produce live in `docs/product/`, and the code follows
both.

A PR that makes or changes a decision adds the entry in the same PR. Decisions
made in a review thread or a meeting are added the same day by whoever made
them.

## 2026-11-27 An added item's less-used fields are sections, not a switch

**Context.** An imported asset or liability kept its less-used fields in
collapsible sections, while one added in the plan revealed them all at once
with a "Show advanced options" switch in the dialog's footer (#480, #482).

**Decision.** The switch is gone. An investment, tangible asset or liability
added in a projection has the same sections as an imported one, closed until
opened or until they hold a value that is not the default. Financing details
also holds the down payment and opens when Financed is picked. A recurring
income, expense or transfer added in a projection keeps its start, end and
change over time in a Timeline section, like an imported one. In every dialog
the amount moves right under the name, before the schedule and the start
(#497). Supersedes the
"full dialog with the switch" of the imported-items dialogs.

**Why.** One way to reach the fields in every dialog, each group under its own
title, and nothing the user set is hidden when the item is opened again. The
amount is what the user comes to enter, so it comes first.

## 2026-11-25 Inflation counts months from the projection's start month

**Context.** An amount that adjusts for inflation rose once a year, from the
plan's first year: a one-time transfer cost the same in every month of a year
and jumped in January (#485).

**Decision.** Inflation counts months from the start month: a payment `n`
months later costs (1 + rate)^(n / 12) as much, for every income, expense and
transfer, one-time and recurring. A flow in today's money is its payments
each deflated by their own month, so one that adjusts for inflation reads as
entered. Balances are still deflated once a year, and a yearly change over
time still steps once a year. Amounts stay shown in whole units.

**Why.** The start month is "today" for a new projection, so a payment a month
later should already cost a month more, and the dialog's preview should move
with the month picked. Deflating each payment by its own month keeps an
inflation-adjusted amount equal to what was entered, as the dialog says.

## 2026-11-24 The projection's cash flow lists installments and fees and taxes apart from expenses

**Context.** The right sidebar's Expense group listed a financed asset's
installments under the asset's name only, so a taxed, financed house read
"House property tax" and then "House" (#474). Investment fees and transfer
tax were not shown anywhere.

**Decision.** Cash flow has three outflow groups: Expenses, Liability
installments and Fees and taxes. Fees and taxes lists each investment's fees,
each transfer's tax and each asset's property tax, and the Cash flow headline
subtracts all of them, although fees and transfer tax do not leave cash. Sales
tax on a tangible asset is left for later, since an asset has none today.
Supersedes the single Expense group of 2026-11-23's sidebar.

**Why.** The group labels match the ones used in financial data and the left
sidebar, and each group names its rows without a suffix for the installments.
Counting the fees in the headline keeps the groups adding up to it.

## 2026-11-23 A row of the projection's right sidebar opens its item

**Context.** #320 left open whether a row of the right sidebar opens its item
or focuses the chart on it. Reading a figure there and wanting to change it
meant finding the same item again in the left sidebar.

**Decision.** A row opens the dialog of its item, the one its row in the left
sidebar opens. Cash opens the cash balance; a property tax row, the loan
behind a financed asset and its installments open the asset they belong to.
On the Current projection the rows open nothing, as on the left.
`docs/product/projections.md` states the rule.

## 2026-11-20 The projection's left sidebar is for editing and shows no asset values

**Context.** The left sidebar listed every asset with the value it was entered
at, which reads as its value today while the chart beside it shows another
year (#448). Adding an item meant the button at the bottom and then a type
picker (#420). #470 redesigns the sidebar to match the right one.

**Decision.** The left sidebar is for adding and editing, the right one for
reading figures. Assets show their name only; cash flows keep the amount as
entered, with an icon when it follows inflation. Cash flows and Assets are two
sections of one list, without tabs, search or item counts. Each group has a +
that adds an item of its type directly; the section's Add button keeps the
type picker.

**Why.** An entered asset value is where the plan starts, not what the asset
is worth in the year on screen, and the right sidebar now has that. A cash
flow's entered amount is the rule the user set, so it stays. With both
sections on one short list there is nothing left for tabs or search to do.

**Supersedes.** Nothing recorded; the earlier layout was not in a doc.

## 2026-11-20 A section opens on what it would hide; a financed asset needs a term or an installment

**Context.** In the review of #430: the sections of an imported item's dialog
always started closed, so the dialog could open with Save disabled and the
reason out of sight, or with a stored value that drives the projection unseen.
An imported asset switched to Financed could also be saved with only a balance
owed, a loan the engine never repays, because the term and installment sat in
a closed section.

**Decision.** A section starts open when it holds a stored value that is not
the default, or an empty one that keeps the dialog from being saved; otherwise
closed, and the user may close or open it either way. A financed tangible
asset cannot be saved from the plan dialog without a term or an installment.
An asset added in the plan whose down payment covers the whole price says so
beside the down payment, where Save was disabled without a reason.

**Supersedes.** "Sections that start closed" in "An imported item is edited as
a local override" (2026-11-13).

## 2026-11-20 The projection's right sidebar shows net worth, cash flow and the FIRE portfolio

**Context.** #320 redesigns the right sidebar of the projection page into
three sections, each with a year-on-year badge. The frames left open what the
Cash flow headline counts and what the Transfers row shows, and they have no
Key figures section, where liquid net worth, year-on-year and the income and
expense totals lived.

**Decision.** Cash flow is income less expenses, property tax and loan
installments. Its Expense row lists the expenses first, then the property tax
and the installments, which look like expenses for now. Transfers shows the
amount that left each source and stays out of the headline. The Key figures
section is dropped: total income and total expenses are the head rows of
Income and Expense, the portfolio value is shown as "FIRE portfolio" instead
of liquid net worth, and the badge's tooltip carries the year-on-year amount.
The "Missing funds" panel of the frames waits for #67, since the engine does
not stop at an error yet. `docs/product/projections.md` and `net-worth.md`
state the rules.

**Why.** An installment drains cash like any expense, so a cash flow without
it would overstate what the year leaves over; it is also what the FI number
counts as living cost. The portfolio value is the figure financial
independence is measured on, so it is the one worth following year by year;
liquid net worth differed from it only by the secured loans.

**Supersedes.** "Liquid net worth ... stays a key figure of a projection for
now" in the 2026-11-19 entry below, and the open question on it in
`net-worth.md`.

## 2026-11-19 Net worth, portfolio value and liquid net worth are three figures

**Context.** The app had three wealth totals and no stated definition for
them: the code said "investable net worth", the FI dialog "portfolio value",
the projection page "liquid net worth", and the FI doc left open whether a
mortgage counts against the portfolio.

**Decision.** Net worth is cash, investments and tangible assets minus every
liability. Portfolio value, also called investable net worth, is cash plus
investments minus loans not secured by an asset, and is what FI % is measured
on. Liquid net worth is cash plus investments minus every liability, and
stays a key figure of a projection for now. The code already computes all three this
way, so nothing changes in the app; `docs/product/net-worth.md` states them.

**Why.** A mortgage belongs with the house it financed: counting the debt
while leaving the house out would put most homeowners at FI 0 %. Liquid net
worth keeps the stricter view, what is left if every debt were paid from
cash and investments alone.

**Supersedes.** The open question in `financial-independence.md` on whether a
mortgage counts against the portfolio value.

## 2026-11-16 An investment has no Exit field

**Context.** The plan dialog let an investment be given an exit date, which
sold the whole balance into cash. A one-time transfer with the "Max" amount
now does the same and says where the money goes, so the field was a second
way to do one thing. Agreed with design in the review of #430; frame 1380
draws only Fees.

**Decision.** No investment dialog has an Exit field or section, in a
projection or in financial data. Saving an investment from the plan dialog
drops an exit it stored. The `exit` fields are still read by the schema and
the engine; removing them is a follow-up.

**Supersedes.** The Exit section "An imported item is edited as a local
override" (2026-11-13) gave an imported investment.

## 2026-11-13 An imported item is edited as a local override

**Context.** The plan dialogs showed every item the same fields whether the
plan added it or it came from financial data. For a financed asset that meant
a down payment, which since 2026-11-05 was made up for an imported asset as
the price less the balance owed. The design (Figma frames 1360 to 1366 and
1380 to 1386) treats the two differently: what the plan adds is planned
(a purchase, a price, a down payment, a start); what was imported already
exists, and those fields mean nothing for it.

**Decision.** An item whose id is in its list in the plan's `base` is
imported. Its dialog shows a "Local override" notice and no name field, and
keeps the less-used fields in sections that start closed. An imported
investment has no start; an imported tangible asset no purchase or
down payment, and its outstanding balance is edited directly, untouched by a
change of value; an imported liability no start or principal, only the
outstanding balance. Incomes, expenses and transfers keep their fields, with
the timing in a Timeline section. An item added in the plan keeps the dialog
it had.

**Supersedes.** The part of "A projection stores a financed asset's down
payment" (2026-11-05) that opened an asset copied from financial data at the
price less the balance owed. That fallback now applies only to an asset an
MCP tool wrote into a plan without a down payment.

## 2026-11-13 The outdated and Last updated notices can be dismissed for the browser session

**Context.** #369 and #407 redesign the two notices that say figures are not
current: the outdated bar on a projection and the Last updated alert above the
dashboard's key indicators. Both become yellow and gain a way to close them
("I understand", and an x). The frames do not say what closing remembers. In
#369 David proposed remembering nothing, so the bar would return every time
the projection is opened.

**Decision.** Closing either notice hides it for as long as the browser stays
open (`sessionStorage`), and it is back in a new session while it still
applies. Returning on every page visit would make closing pointless for
someone moving between the dashboard and a projection; forgetting it for good
would remove the only hint that the figures on screen are projected or out of
date. Each is dismissed for the state it was closed in, so it returns in the
same session once that state moves on: the outdated bar per projection and
for the financial data of that moment, so a further change to financial data
brings it back; the Last updated alert for the date it names on that profile,
so it returns once a newer update has gone stale. Closing the Last updated
alert also puts away its Quick update button, the only one on the dashboard
and the History page, until the alert returns; the notice is the nudge to
update, and a user who closes it has declined for now.

## 2026-11-12 Assets and liabilities share one scale on the plan chart

**Context.** #422: the plan chart scaled assets and liabilities separately,
each to fill its own area (assets above a baseline fixed at 75% of the
height, liabilities below it), so a 20 000 EUR loan drew taller than
286 000 EUR of investments. The 75/25 split came from the first chart
prototype, built before it had real data.

**Decision.** One scale covers the range from the largest liability to the
largest asset total, so every bar is proportional to its value. The
baseline sits where that range puts it: at the bottom when there are no
liabilities, higher as they grow. Grid lines stay evenly spaced and are
anchored on the baseline. The plan card thumbnail follows the same rule.

**Supersedes.** The fixed 75/25 split between assets and liabilities.

## 2026-11-12 A History chart dot edits its snapshot, and an edit saves only what was typed

**Context.** #345 asks for a click on a History chart dot to edit that
snapshot, on the dashboard as well as the History page. Frames 1308 (edit)
and 1309 (add) draw one snapshot dialog for both; the History page already
used it for its table's Edit and its Add button, and on Confirm it wrote
every field back, including estimates seeded for items the snapshot never
recorded.

**Decision.** Clicking a recorded dot, on either chart, opens that dialog in
edit mode for the dot's snapshot. The projected "now" dot, shown when today
has no snapshot, opens it in add mode for today, seeded with today's
estimate as the History page's Add is; its tooltip reads "click to add". In
edit mode Confirm writes only the figures the user typed; everything else in
the snapshot stays as recorded, and an item it never recorded stays unrecorded
unless the user types a figure for it. A financed asset's value and debt are
one entry, so editing either writes both; a debt the snapshot never recorded
is written only when the user types one. An untyped field opens at what the
saved snapshot will hold, also after a re-date. Adding or duplicating a snapshot still records every
field. The dialog grows to the window's height less 32px at the top and the
bottom; its title bar and footer stay put and the sections scroll between
them. It edits only what a snapshot records (cash, balances, asset values and
debts, income and expense amounts) as plain inputs: the frames' collapsible
item cards, their add buttons and a transfers section are left out, since a
snapshot holds no item names, settings or transfers. Those are edited in
financial data.

**Why.** An edit corrects a reading the user recorded; writing back
untouched seeded figures would add estimates they never confirmed. A new
snapshot has nothing recorded yet, so every field is its figure.

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

## 2026-11-05 A snapshot's unrecorded cash flows stay unrecorded

**Context.** Snapshots saved before cash flows were recorded, a window of about
four days in September, were filled from the profile's current flows on load,
and the next save stored those as if recorded on that date. #287 proposed
leaving them absent in storage and falling back at read time.

**Decision.** Nothing fills them in, in storage or at read time. An omitted list
means nothing was recorded, as in every other section of a snapshot, and a
History row without recorded expenses shows a dash for Financial independence,
in the table and in the chart's tooltip, and for the runway in the tooltip. The
snapshot dialog opens such flows at zero on the row's own date, and they stay
unrecorded on Confirm unless a field in their section was typed. A snapshot
added between such a row and the next one opens its flows at zero as well
(`seedSnapshotOn` carries the row forward), and there Confirm records them. This settles #287 differently from what it
proposed. (#396)

**Why.** Browsers that saved since September already hold the filled-in flows,
and those look exactly like recorded ones, so a read-time fallback could not
correct them. That leaves only browsers that have not saved since and backups
from that window, which does not justify a fallback before Kalkul has users to
keep. The dash is there because financial independence or a runway measured
without the day's expenses would count loan payments alone as the cost of
living. Editing another figure of the row must not undo that, which saving
the dialog's zeros would. The added snapshot is a new record the user
confirms rather than a correction of an old one, and its zeros are accepted
because the case is rare and a zero looks wrong on screen.

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
