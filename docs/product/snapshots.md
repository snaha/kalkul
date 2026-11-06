# Snapshots

A snapshot records the figures a user's finances stood at on a date. This doc
covers how a figure can be unknown. The rest of the concept has not moved here
yet.

## Vocabulary

| UI label                   | Field                                        | Meaning                     |
| -------------------------- | -------------------------------------------- | --------------------------- |
| Cash, bold in Quick update | `cash_amount: 1000`                          | The figure the user gave    |
| Cash, regular              | `cash_amount` missing                        | Unknown: calculated on read |
| Investment, bold           | `investments: [{ id, balance: 1000 }]`       | The figure the user gave    |
| Investment, regular        | `investments: [{ id }]`                      | Unknown: calculated on read |
| None                       | No entry for the investment in `investments` | Not held on the date        |

## Rules

- In Quick update a row shows its estimate at regular weight. Typing a figure
  enters it, even one equal to the estimate, and turns the value and its change
  bold.
- Confirm stores a row left untouched or erased as unknown. Erasing a row or
  pressing Reset values returns it to its estimate at regular weight.
- The profile still moves to the estimate, so the dashboard reads a number.
- Only Quick update writes unknowns from the app, and only for cash and
  investments. An AI client can write the same forms through `update_profile`.
- An unknown figure is calculated when read, linearly by date between its
  nearest known values, rounded to whole currency units.
- On the newest date the profile states the figure, so it counts as known for
  calculating earlier dates.
- With no earlier number the figure counts as 0, including right after a date
  the investment was not held.
- With no later number the figure keeps its last known value, including right
  before a date the investment was not held. A sold position stays at its last
  known value up to the sale.
- Deleting the newest snapshot rewinds the profile to the calculated value of
  any unknown figure on the snapshot before it. The figure stays unknown.
- The snapshot dialog opens an unknown figure at its calculated value and keeps
  it unknown unless a figure is typed.

## Worked examples

Cash is 1,000 on 1 January and 2,200 on 1 May. On 1 March it is unknown. That is
59 of the 120 days, so History shows 1,000 + 1,200 x 59 / 120 = 1,590.

Quick update on 1 May leaves cash untouched at its estimate of 2,200, and
nothing newer exists. The snapshot stores no cash, the profile holds 2,200, and
1 May reads 2,200. If the user later enters 3,000 on 1 June, 1 May is calculated
between 1 January and 1 June instead.

Deleting the 1 May snapshot above, with 1 March unknown, sets the profile's cash
to 1,590.

An ETF is 50,000 on 15 January and unknown on 15 March and 15 May, with cash
entered at 10,000 on all three dates. It is sold on 15 July, leaving cash at
60,000 and no entry for the ETF. History shows the ETF at 50,000 on both unknown
dates, so net worth stays at 60,000 throughout.

## Open questions

- Should the History chart and table mark calculated figures? Today they read as
  any other figure.
- A financial data edit on the day of a Quick update replaces that day's
  snapshot with numbers, so its unknowns are lost. Should they survive?
- A financial data edit records carried-forward figures as numbers. Should
  those be unknown too?
- Should the snapshot dialog have a control to make a figure unknown?
- Does one unknown concept also cover cash flows never recorded on old snapshots
  (#287)?

## In the code

- `src/lib/snapshots.ts`: `resolveSnapshots`, `withUnknownBalances`
- `src/lib/schemas.ts`: `snapshotSchema`
- `src/routes/(app)/quick-update-dialog.svelte`, `quick-update-confirm.ts`
- `src/lib/snapshot-form.ts`: the snapshot dialog
