# Improving Tracking

How to make users keep their financial data current. Context: this is a
side-project, the primary users are the team itself (dogfooding), and the
retention issue is already observed. Worst case is staying free forever at
near-zero cost — so the goal is the _cheapest_ way to make updating painless and
rewarding, without aggregation infrastructure or its economics.

See `strategy-assumptions.md` for why tracking retention is the keystone, and
`tracking-retention-experiment.md` for how to measure it.

## The two levers

Tracking retention comes down to two things:

1. **Cut the friction of updating.**
2. **Create a reason to come back.**

The biggest single unlock sits in the first lever — see the reframe below.

## The core reframe: entry → reconciliation

Today, updating means opening each category page and re-typing numbers into a
form. That is data _entry_ — a chore with no reward.

But the app already has a projection engine (`src/lib/plan-projection.ts`,
`src/lib/@snaha/kalkul-maths/graph-data.ts`). It knows what most values _should_
be next month: a loan amortizes on a schedule, recurring income/expenses recur,
investments have an expected drift. So instead of asking the user to enter
values, **show the expected value and ask "still right?"**

Update becomes confirming a pre-filled number and correcting the few exceptions.
A 15-minute form becomes a 2-minute reconciliation — built on code that already
exists.

## Ranked ideas (cheapest first)

**1. One "update balances" screen**

- Updating is currently spread across six category pages
  (`src/routes/(app)/financial-data/{cash,investments,tangible-assets,liabilities,incomes,expenses}/+page.svelte`).
- Add a single screen listing every volatile balance with just its number field,
  tab-to-next, no navigation.
- Likely moves the team's own cadence more than anything else. Cheapest high-impact
  change.

**2. Only prompt for what actually moves**

- Split fields into volatile (cash, investment balances) vs stable/derivable
  (a car's value, a mortgage balance that amortizes predictably).
- Don't ask for the stable ones — compute or leave them.
- Halving the number of fields halves the friction.

**3. Lightweight dated snapshots — the one primitive worth adding**

- `appStore.updateProfile()` currently overwrites, so there is no history and no
  reward.
- Store a dated copy of the profile blob on each update (cheap in localStorage).
- Unlocks everything below: deltas, charts, streaks. Without it, every update
  disappears into a single number and the user gets nothing back.

**4. Show the payoff of updating**

- Once snapshots exist: "net worth +2.3% since last month," a sparkline, progress
  toward a plan/goal the app already models.
- The reward for updating is watching the line move — the dopamine loop manual
  trackers lack. Turns a chore into a check-in the user _wants_ to do.

**5. CSV / paste import — friction-killer without aggregation**

- No Plaid, no per-connection cost. IBKR gives activity/Flex CSVs; banks give CSV
  exports. Even a "paste your numbers here" box that parses a statement.
- Local, free, fits the OSS/privacy ethos.
- Delivers the aggregation _benefit_ (no typing) without the aggregation _cost_.

**6. Match cadence to reality: a monthly ritual, not a habit loop**

- Finance isn't daily. Design one gentle monthly "check-in" flow (pre-filled from
  last values + projection) rather than nagging notifications.
- Monthly reconciliation is a realistic, achievable habit; chasing daily
  engagement just breeds guilt-then-churn.

## What to try first (on yourselves)

Ship **#1 + #3 + #4 together**, in that order:

1. Fast single-screen update.
2. Dated snapshots.
3. Show the delta.

That is the minimum loop where updating is both quick _and_ gives something back.
Then watch whether the team keeps doing it for three months.

- If dogfooding retention improves, the mechanic is found.
- If it doesn't work even on the people who built it, that's the honest signal —
  fall back to the free-forever plan, having spent almost nothing.

Reconciliation (#2, pre-filled from the projection) and CSV import (#5) are the
second wave: bigger builds, but they are what would make tracking stick for
someone who _isn't_ already emotionally invested in the app.
