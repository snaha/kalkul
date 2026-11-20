# Differentiating Features

Feature ideas that set Kalkul apart in the market — organised by the axes where we
can actually win. The benchmark competitor is ProjectionLab (US-first, FIRE
power-users, manual entry, rich planning, Premium-gated); the other competitors
are bank apps and abandoned spreadsheets.

Two kinds of differentiation, and they are not equal:

- **Moats** — hard for ProjectionLab (or a US player) to follow, because they'd
  hit the same country-complexity wall we do, or because their business model
  can't hold the position sincerely. Invest here.
- **Executional edges** — copyable in principle, but a real advantage if we do
  them better for our audience (less-expert Europeans, not FIRE nerds).

See `strategy-assumptions.md` for why EU depth is the durable moat, and
`planning-reward-features.md` for the tracking→reward loop (not repeated here).

---

## A. EU-centricity (the primary moat)

This is the ground ProjectionLab structurally cannot take cheaply — their
"International Planning" is a shallow Premium bolt-on. Depth here is our defensible
territory. **Risk to respect:** country tax/pension logic is a tar pit (see
`strategy-assumptions.md`, risk #6). Go _two countries deep, not ten shallow._

**A1. Country tax rulesets in the projection (the core moat)**

- What: model income tax, capital-gains treatment, and tax-advantaged wrappers per
  country — e.g. CZ 3-year time-test exemption, FR PEA / assurance-vie envelopes,
  HU TBSZ / önkéntes nyugdíjpénztár, SK pillars.
- Why it differentiates: nobody models _European_ decumulation tax correctly for a
  novice. This is the reason an EU user picks us over PL. Moat.
- Effort: high. Start with one country end-to-end, prove the pattern, then add.

**A2. State / statutory pension integration**

- What: fold the local state pension entitlement into the retirement projection
  (retirement age, contribution years, indexation) — the EU analogue of PL's
  Social Security modelling.
- Why: state pension is a huge share of EU retirement income and is modelled
  nowhere well. Directly improves projection accuracy for our users. Moat.
- Effort: medium-high per country.

**A3. Multi-currency reality**

- What: hold EUR + local currency (CZK, HUF) + USD (IBKR) positions; show net worth
  and projections in the user's home currency with explicit FX assumptions.
- Why: PL is USD-centric; Europeans are natively multi-currency. Removes a daily
  friction PL ignores. Moat-ish (annoying for a US-first tool to retrofit).
- Effort: medium.

**A4. Localised default assumptions**

- What: sensible per-country defaults for inflation, wage growth, expected returns,
  so a novice isn't staring at blank assumption fields.
- Why: serves the less-expert audience _and_ is inherently local. Cheap trust win.
- Effort: low (data + defaults), pairs with A1/A2.

**A5. Local product awareness**

- What: recognise culturally dominant products — stavební spoření (CZ),
  assurance-vie (FR), local pension funds — as first-class account types with the
  right tax/behaviour, not generic "investment."
- Why: makes the tool feel built _for them_. Strong belonging signal. Moat-ish.
- Effort: medium, incremental (one product at a time).

**A6. Cross-border / relocation scenarios (later)**

- What: model moving country — dual-tax years, wrapper portability, pension transfer.
- Why: Europeans move; expats are underserved and sticky. Niche but defensible.
- Effort: high. Park until A1–A2 exist for ≥2 countries.

## B. Better planning (depth + approachability)

The goal is depth PL lacks _or_ the same depth made approachable for non-experts.

**B1. Assumption calibration (verified PL gap)**

- What: auto-compute realised returns from tracked history and suggest updating the
  plan's assumptions. Detailed in `planning-reward-features.md` (Feature 4).
- Why: PL makes users eyeball variance and hand-edit; we make the plan
  self-correct. Verified gap. Modest but real edge, cheap given snapshots.
- Effort: medium.

**B2. Question-first planning (instead of goals)**

- What: lead with plain questions — "When can I stop working?", "Can I afford a
  €400k home?", "What if I take a one-year break?" — that configure a scenario
  behind the scenes.
- Why: PL is a blank-canvas modeller for enthusiasts; question-first is radically
  more approachable, and it sidesteps our missing goals feature entirely. Strong
  edge for the non-expert wedge.
- Effort: medium.

**B3. Reverse planning / solver**

- What: solve backwards — "I want to retire at 60; what monthly saving gets me
  there?" instead of only forward simulation.
- Why: forward-sim answers "what happens"; users actually ask "what must I do." PL
  is forward-first. Genuinely useful, memorable.
- Effort: medium (search over the existing projection).

**B4. Plain-language scenario comparison**

- What: side-by-side Plan A vs Plan B with the delta in words: "retire 2 years
  earlier, but spend 12% less."
- Why: PL has Compare Mode but it's power-user-y. The plain-language framing is the
  differentiator, not the comparison itself.
- Effort: medium.

**B5. "What matters most" sensitivity**

- What: show which lever (savings rate, retirement age, return, spend) moves the
  outcome most, ranked.
- Why: turns a wall of assumptions into "focus on this one thing." Educational,
  distinctive, respects a novice's attention.
- Effort: medium.

**B6. Life-event templates (EU-flavoured)**

- What: guided modules for "having a child," "buying a home," "career break,"
  "inheritance," tuned to local costs/benefits.
- Why: approachable on-ramp to planning depth; pairs with B2. Guided beats blank.
- Effort: medium, incremental.

**B7. Honest-projection framing**

- What: ranges not a single line, Monte Carlo explained in plain words,
  behind-plan warnings.
- Why: it's the trust feature the ★☆ review demanded and the ★★★★★ review praised
  (`product-reviews.md`). Differentiates against both PL's density and banks' spin.
- Effort: low-medium (partly presentation of the engine you already run).

## C. Trust, access & privacy (structural, PL can't match sincerely)

A funded, subscription-first US competitor cannot hold these positions
convincingly — their model wants the opposite.

**C1. Genuinely free and saveable, local-first**

- What: full planning + tracking that saves, for free, in the browser — no account
  required to start.
- Why: PL's free tier _cannot save_. "The free one that actually keeps your data"
  is a clean market position. Moat (their pricing depends on the opposite).
- Effort: already true — make it a stated feature, not an accident.

**C2. Open, auditable maths — "check our numbers"**

- What: link from inside the app to the open-source calculation engine and its
  tests; explain a projection's formula on demand.
- Why: transparency no bank or closed competitor can offer. Converts OSS from a
  dev-only virtue into an end-user trust feature. Moat-ish.
- Effort: low.

**C3. No bank linking required (privacy by design)**

- What: keep manual/CSV entry as a deliberate, stated choice — your finances never
  leave your device unless you opt into cloud.
- Why: GDPR-era Europeans are wary; "we never touch your bank" is a selling point,
  not just a limitation. Reframes A weakness as trust.
- Effort: already true — position it.

**C4. Bulletproof, visible backup/restore (for the paid cloud tier)**

- What: proven restore across devices, "last backed up 2 min ago," easy export.
- Why: this is the exact ★☆ betrayal (`product-reviews.md`). For a paying "cloud"
  user, data safety must be visible and trusted. Table stakes that, done well,
  turns local-first into a point of pride.
- Effort: medium (cloud phase).

## D. Approachability / education (the non-expert wedge)

PL's ceiling is complexity; being the _understandable_ planner is open ground.

**D1. Guided, question-first onboarding** — pairs with B2; get to a first
meaningful answer in minutes, not after a modelling tutorial.

**D2. Inline plain-language explanations** — every number has a "what is this?"
without leaving the screen. Serves novices; costs a glossary.

**D3. "Explain this projection" narrative** — a few sentences summarising the chart
in words ("you're on track to X by Y, mainly because Z"). Distinctive, cheap,
memorable.

---

## Where to focus

- **Durable moat:** A1 + A2 (country tax + state pension), started _one country
  deep_. This is the only category PL cannot cheaply follow, and it's the reason an
  EU user chooses you. Everything else defends or amplifies it.
- **Cheap structural wins to claim now:** C1, C2, C3 — you already have them;
  position them as features. B7 and A4 are low-effort trust/approachability wins.
- **Approachability wedge (medium effort, high impact for non-experts):** B2, B3,
  B5, D1 — this is how you beat PL's complexity for a mainstream audience.
- **Sequencing caution:** the EU tax moat (A1) is also the tar-pit risk. Prove it
  end-to-end for one country and validate demand before spreading thin across four.
