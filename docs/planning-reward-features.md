# Planning-Reward Features

Concrete, shippable features that make updating financial data _rewarding_ by
pointing every update at planning value — not at a dashboard number.

See `tracking-improvements.md` for the friction-reduction side (fast update
screen, snapshots, cadence) and `strategy-assumptions.md` for why tracking
retention is the keystone.

## Why this matters, and why it should be prioritized

The keystone assumption is that users keep their financial data current. The
friction work (`tracking-improvements.md`) makes updating _cheap_, but cheap
isn't the same as _worth doing_ — a five-second update with no payoff still gets
abandoned. The reward is what closes the loop: the reason to come back. Our own
thesis is that tracking is the on-ramp to planning depth (people won't invest in
a detailed plan until they've invested in detailed data), so the reward for
tracking should be a _taste of that depth_ — the plan getting sharper — not a
better version of a net-worth tracker. If the payoff for updating is just
"your number went up," we've built a worse Mint; if the payoff is "your plan just
improved because you tracked," we've built the flywheel the whole strategy needs.

This should be prioritized because it is where the tracking-first bet either
converts into the actual moat (planning depth, the thing ProjectionLab proved
people pay for) or fails cheaply. And critically, the first two features below
require **no goals feature, no snapshots, and no new subsystems** — they are
arithmetic and a before/after diff on code that already exists. That means we can
test the entire "reward = planning" hypothesis in days, on ourselves, at almost
zero cost. It is the highest-leverage, lowest-risk work available: it validates
(or kills) the retention thesis before we spend anything on the heavier
primitives.

A note on goals: earlier reward ideas assumed an explicit goal to benchmark
against (retirement date, "house deposit 71%"), but goals are deprioritized and
not a feature today. The features below are deliberately **goal-free** — they use
derived outcomes (FI %, runway), the previous projection, and actual-vs-projected
history as benchmarks instead. Goals return later as a _salience amplifier_
(progress bars, named finish lines), not as a prerequisite.

## Features (cheapest first)

**1. The Headline Number (goal-free finish line)**

- What: one always-visible derived outcome that moves when data changes. Two
  candidates, both computable today:
  - **FI %** = investable net worth ÷ (annual expenses × 25). "Financial
    independence: **62% funded**."
  - **Runway** = investable net worth ÷ annual expenses. "**15.5 years** of
    expenses covered."
- Worked example: expenses €40k/yr, investable NW €620k → FI target €1.0M →
  **62%**; runway **15.5 yrs**.
- Needs: `getNetWorth` / `getInvestmentsTotal` / `getCashTotal` /
  `getLiabilitiesTotal` + an expenses total — all in
  `src/lib/financial-totals.ts`. Pure arithmetic; no projection engine, no plan,
  no goal.
- Decisions to pin down: "investable" = cash + investments − liabilities (exclude
  primary home); the 4% rule (×25) is a stated assumption — label it.
- Cheap version: FI % on the dashboard. Effort: tiny. This is the finish-line
  feeling for free.

**2. Plan-delta card on save (the "your action mattered" moment)**

- What: after saving an update, show how the Headline Number (and, if a plan
  exists, projected net worth at horizon / depletion year) changed.
- How: capture the metric(s) _before_ applying the update, apply, recompute,
  diff. Show a card, not a toast: "FI: **62%** (▲2%). Money lasts to **2071**
  (▲2 yrs)."
- Needs: run the projection twice (old vs new inputs) — `src/lib/plan-projection.ts`;
  hook the update flow in `appStore.updateProfile()`. No snapshots needed.
- Cheap version: just the FI-% delta from Feature 1 (no projection at all).
  Effort: small.
- Fallback if no plan exists: show the FI / runway delta only.

**3. Actual-vs-projected overlay (the differentiator — needs snapshots)**

- What: on the plan chart, plot dated snapshot net-worth points over the
  projected curve, with an "ahead/behind" badge: "Plan expected €406k by now —
  you're at **€412k, ~2 months ahead**."
- How: at each snapshot date, read the projection's value for that date and
  compare. The benchmark is the _curve_, not a goal.
- Needs: the snapshots primitive (dated net worth) +
  `src/lib/@snaha/kalkul-maths/graph-data.ts` / the plan page chart.
- Cheap version: one badge — today's actual vs projected-for-today. Full version:
  all points overlaid. Effort: medium (snapshots first).
- Competitive reality check (verified 2026): this is **parity, not a moat**.
  ProjectionLab already does this via "progress points" (dated snapshots of net
  worth/assets/liabilities, auto-created on each update, manually backdatable) and
  a "Net Worth + Progress" chart that overlays actuals on the projected curve.
  Our differentiation is therefore _access and UX_, not capability: (a) PL gates
  this behind Premium ($129/yr) and its free tier cannot save at all — we can
  offer the same loop free, local-first, and open-source; (b) PL requires a
  fixed-date-plan setup dance to see progress — we can make it zero-config.
  Sources: projectionlab.com/help/capture-progress,
  projectionlab.com/help/overlay-actual-progress.

**4. Assumption calibration (the deep, self-correcting one — needs snapshots)**

- What: compare realized numbers from snapshots to the plan's assumptions and
  offer a one-tap fix: "Your investments grew **8%/yr** over 3 updates; your plan
  assumes **5%** — update it?"
- How: realized return = (latest ÷ first)^(1/years) − 1 per category; compare to
  the plan's `apy`; nudge if the gap exceeds a threshold.
- Needs: ≥2 snapshots with category detail. Effort: medium-high. This is where we
  stop being a tracker.
- Genuine differentiator (verified 2026): ProjectionLab does **not**
  auto-calibrate. It offers rich _manual_ assumption control (fixed rates,
  historical-_market_ backtesting, per-account overrides, custom sequences) and a
  _visual_ actual-vs-projected overlay — but per its own docs the user "must
  manually observe differences and make their own changes." It never computes
  _your_ realized return from _your_ progress points and suggests updating the
  plan. Auto-calibration is therefore a real gap. Caveat on value: PL's FIRE
  power-users can eyeball variance and adjust manually, so for them it's a nicety;
  for a less-expert audience (our positioning) it's more valuable because they
  won't know to do it manually — and it's cheap for us (projection engine +
  snapshots already needed). Modest but real edge.
  Sources: projectionlab.com/help/update-plans-over-time,
  projectionlab.com/help/model-investment-growth.

**5. Quick what-if from fresh data (scenario invitation)**

- What: post-update CTA opening a one-variable scenario (savings rate / spend /
  retirement age) that shows the effect on the Headline Number or runway: "Save
  €200 more/mo → FI **62% → 67%**, runway +2.1 yrs."
- Needs: parametrize the projection over one input + a minimal slider. Effort:
  medium. Works anytime after Feature 1.

## Build order (side-project budget)

1. **Feature 1 (Headline Number: FI %)** — tiny, no dependencies, delivers the
   finish line immediately.
2. **Feature 2 (delta on save)** — small; makes tracking feel consequential.
   Features 1 + 2 together = the whole "reward = planning" thesis, testable in
   days with almost no code and no goals, no snapshots.
3. **Snapshots** → **Feature 3 (actual-vs-projected)** — the primitive that
   closes the reward loop. Note: parity with ProjectionLab, not a moat (see
   Feature 3); our edge is offering it free/local-first and zero-config.
4. **Feature 4 (calibration)**, then **Feature 5 (what-if)** — depth and
   engagement.

The honest headline: Features 1 + 2 turn the vague "reward = planning" into two
concrete numbers (FI %, and its delta on save) that ship this week with zero new
subsystems. Everything else is upside layered on top.
