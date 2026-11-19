# Kalkul — Assumptions, Strategy & Risks

A stress-test of the monetization plan: free open-source app → cloud subscription
for individuals → co-editing tier for financial advisors. Written to surface the
hidden assumptions the plan rests on.

## Strategy (as understood)

1. **Free, open-source, local-first app.** localStorage, no account, no backend.
   Serves as a low-friction on-ramp — no registration for users, no infra cost/risk
   for us — and as an early-adopter/testing pool that polishes the product before
   the paid version ships. Open source also buys goodwill, free marketing, and
   transparency (the calculation engine is open with strong test coverage).
2. **Cloud subscription for individuals.** Removes the friction of manual
   JSON import/export sync across devices. The deeper bet: a **tracking** feature
   (in progress) that lets users keep their financial data current, so the app
   becomes the **source of truth** for a person's finances spread across many
   places (bank accounts, IBKR, retirement funds, assets, liabilities).
3. **Advisor tier (third step).** Advisors get an up-to-date view of a client's
   finances at the annual meeting _because the client already tracks in the app_.
   Editing is rare — mainly when the client wants a project, where the advisor
   drafts a plan from the current projection and shares it. Deliberately last,
   because a prior attempt to sell to advisors failed for lack of users on the
   platform; this time users (and validation) exist first.

Internationalization: moving from CZ/SK to **English-first**, then localizing to
known languages (Czech, Slovak, French, Hungarian). Country-specific tax/pension
logic handled by basic tools now, a **rules engine** with pre-made country
rulesets later.

## The keystone assumption

Across the founder's clarifications, most surface assumptions were resolved — but
each resolution pushed the risk downstream to the same place. The plan now rests
on **one keystone assumption:**

> **Users will keep their financial data updated over months, making the app
> their source of truth.**

Everything depends on it:

- **Cloud subscription** has recurring value _only if_ tracking is sticky.
- **Advisor value prop** ("updated view at the annual meeting") is _entirely
  downstream_ of tracking retention.
- **Advisor go-to-market** ("we already have validated users") needs those users
  to still be _active_, not just registered.

This matters because keeping personal financial data current is the single
hardest problem in consumer fintech — manual finance tracking is typically
abandoned within months. The plan concentrates its risk into exactly that behavior.

## Assumptions — resolved vs. residual

Each item lists the original hidden assumption, how the founder resolved it, and
the residual assumption still in play.

**1. Free local-first users will pay for cloud**

- Resolved: Local-first is a low-friction on-ramp, not the product; cloud adds
  convenience (cross-device).
- Residual: That the convenience delta (sync) is worth a recurring fee vs. free
  JSON export.

**2. Planning lacks subscription-grade usage frequency**

- Resolved: Tracking feature makes the app a live source of truth.
- Residual: That users maintain tracking — and, if aggregation is the fix, that
  aggregation's cost/coverage works (see risks). **[keystone]**

**3. OSS cannibalizes paid tiers**

- Resolved: Accepted; OSS buys goodwill + free marketing.
- Residual: That OSS is a distribution channel (it's usually a trust signal, not
  a channel).

**4. "Just add cloud" underestimates the rebuild**

- Resolved: Confident — 20y with DBs, CRDTs, collaboration, SaaS; no real-time
  needed.
- Residual: Low risk. The risk is attention, not capability — confidence here
  can mask where the real risk is.

**5. Going cloud discards the privacy differentiator**

- Resolved: Privacy/OSS is a GTM strategy for the free tier; those users are
  early testers.
- Residual: That free/privacy testers give the right signal for a cloud+tracking
  product they aren't using.

**6. Advisor product is a different business**

- Resolved: Agreed; it's a deliberate 3rd step, gated on having users first.
- Residual: That a B2C user base validates a B2B value prop, and that users are
  in the advisors' market.

**7. Advisors may not want client co-editing**

- Resolved: Validated with a real advisor; editing is rare, mostly
  advisor-drafted projects.
- Residual: That the value ("fresh view at annual meeting") holds — which
  requires #2 to be true.

**8. Can't displace entrenched advisor tools**

- Resolved: Accepted; that's why it's step three.
- Residual: Unchanged — still hard, just deferred.

**9. Market too CZ/SK-specific**

- Resolved: English-first + 4 locales; rules engine later.
- Residual: That "English" is one market, and that a tax/pension rules engine is
  tractable.

**10. Calculations must be trusted (liability)**

- Resolved: OSS engine + strong tests give transparency; may converge to trust
  faster.
- Residual: That transparency satisfies the mass market/advisors, who care about
  outcomes + liability, not auditability.

## Risks (ranked)

1. **Tracking-retention risk (existential).** If users don't keep data current,
   cloud loses its recurring hook and the advisor tier loses its value prop —
   three plan steps fail from one cause. _This is the thing to validate first._
2. **Aggregation cost & coverage.** The known cure for tracking abandonment is
   removing manual work via bank/broker aggregation (Plaid/GoCardless/Salt Edge).
   That is a **cost center and a new competitive set** (portfolio trackers,
   aggregators), not a feature: per-connection cost, uneven per-country coverage,
   connections that break. It reshapes unit economics.
3. **Wrong-signal risk.** Free/privacy testers exercise a different product
   (local, private, no tracking) than the one being sold (cloud, tracking). Polish
   and feedback accrue to the wrong surface; willingness-to-pay and retention
   signal won't come from this cohort.
4. **Distribution risk.** OSS is a trust signal, rarely a growth channel. A
   separate distribution engine is still required and isn't yet in the plan.
5. **Market-definition risk.** "English" isn't a market — US (401k/IRA/HSA,
   hyper-competitive) vs UK vs EU-expat are different products. Pick which.
6. **Rules-engine tar pit.** Tax/pension logic resists generalization; every
   country has irreducible special cases. "Rules engine later" tends toward an
   infinite backlog. Safer: hardcode 2 countries well before betting on config.
7. **Liability risk.** Both paid tiers rest on projections being right; the
   advisor tier turns errors into _professional_ liability. OSS narrows the trust
   gap for savvy users but doesn't remove liability.
8. **Advisor-displacement risk (deferred, real).** Entrenched, compliance-blessed
   incumbents; slow B2B sale. Mitigated only by sequencing it last.

## Bottom line

The sequencing (free → cloud → advisor) is coherent **if the keystone holds.**
But confidence and risk are mismatched: the founder is (correctly) relaxed about
the infra and treats tracking retention as a given (dangerous). The highest-value
next move is not building the backend — it's proving that a real cohort keeps its
financial data current for 3–6 months. One number validates or kills three steps
at once. See `tracking-retention-experiment.md`.
