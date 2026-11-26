# Snapshots

A snapshot records the figures a user's finances stood at on a date. This doc
covers the cash flows a snapshot records and how the History page's snapshot
dialog reads and writes them. The rest of the concept has not moved here yet.

## Vocabulary

| UI label                          | Field                                              | Meaning                                                    |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Income, expense in the dialog     | `incomes`, `expenses: [{ id, amount, frequency }]` | The cash flow's amount and frequency recorded for the date |
| Newest row                        | `latestSnapshot(profile.snapshots)`                | The snapshot with the latest date                          |
| Saved as the newest               | `savedAsNewest` in `buildSnapshotSections`         | No other snapshot is dated on or after the row's date      |
| Income, expense in Financial data | `profile.incomes`, `profile.expenses`              | The cash flows running now                                 |

## Rules

- A cash flow changed in Financial data records no snapshot, since no balance
  moved. The profile's flows and the newest snapshot's can therefore differ.
- A row that will be the newest once saved opens each cash flow at the
  profile's figure. That covers the newest row, an older row re-dated past it, a
  duplicate dated after it, and a new snapshot. The fields follow the date
  field: moving the date so the row is no longer the newest shows what it
  recorded instead.
- Any other row opens each cash flow at what it recorded, or at zero when it
  recorded none.
- Saving a row as the newest records its cash flows on it and writes them onto
  the profile, even when no field was changed. Since untouched fields hold the
  profile's figures, a raise entered since the last snapshot stays.
- The newest snapshot's cash flows are therefore the profile's as of the last
  save, not the flows running on its date. Once a newer snapshot is saved, they
  stay as recorded.
- Saving any other row records its cash flows on it and leaves the profile's
  alone.
- A cash flow the newest snapshot has no entry for keeps its profile figure.
- An entry recorded for a cash flow the profile has since lost stays on its
  row.
- Deleting a snapshot leaves the profile's cash flows alone, including when it
  rewinds balances to the snapshot before.

## Worked examples

January records a salary of 3,000 a month and June 4,000. The user then raises
it to 5,000 in Financial data; no snapshot is recorded.

- Editing June opens the salary at 5,000. Confirm untouched: June records 5,000,
  the profile keeps 5,000. History now shows the raise as in by June. A rent
  increase entered the same way would also move June's Financial independence,
  which counts expenses but not income.
- Editing June and typing 5,500: June records 5,500 and the profile becomes
  5,500.
- Re-dating June to 1 March keeps it the newest: it still opens at 5,000.
- Re-dating June to 1 December 2025 puts it behind January: it opens at its
  recorded 4,000. Typing 4,100 records 4,100 on that date and the profile keeps
  5,000.
- Duplicating January dated 1 August opens at 5,000 and saves 5,000, so the raise
  survives. Dated 1 March, the same duplicate is behind June and opens at
  January's 3,000.
- Editing January opens at 3,000, and saving it leaves the profile at 5,000.
- Correcting January's salary to 3,100 and then re-dating the row to 1 August,
  past June, in the same dialog: the typed 3,100 is kept, the row is saved as
  the newest, and the profile becomes 3,100 over the 5,000 raise.
- Deleting June rewinds balances to January's but leaves the salary at 5,000.

## Open questions

- Should the newest row's cash flows stay history, opening at what it recorded
  and writing only typed fields onto the profile? That keeps June at 4,000 in
  the first example, at the cost of the newest row showing a figure the
  dashboard no longer runs on, and of a typed field overwriting a profile
  figure it does not show. A variant opens at what the row recorded, shows the
  profile's figure beside it, and asks whether to update Financial data.
- Should the dialog say that saving the newest row changes the profile's
  incomes and expenses? Tracked in #493.
- Should a figure typed as a correction of an older row still reach the profile
  when the row is re-dated past the newest in the same dialog, as in the
  January example?

## In the code

- `src/lib/snapshot-form.ts`: `buildSnapshotSections`, which picks what a cash
  flow opens at
- `src/lib/snapshots.ts`: `withSavedSnapshot`, `withRecordedFlows`,
  `withDeletedSnapshot`
- `src/lib/schemas.ts`: `snapshotSchema`
- `src/routes/(app)/history/snapshot-dialog.svelte`
- Tests: "a snapshot saved as the newest" in `src/lib/snapshot-form.test.ts`,
  and `withSavedSnapshot` in `src/lib/snapshots.test.ts`
