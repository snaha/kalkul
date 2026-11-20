# Experiment: Tracking Retention (pre-cloud validation)

## Why

The monetization plan's keystone assumption is that **users keep their financial
data updated over months** (see `strategy-assumptions.md`). Cloud subscription
value, the advisor value prop, and the advisor go-to-market all depend on it.
It is also the hardest problem in consumer fintech. So: validate it cheaply,
on the existing local-first app, **before** building any backend.

## The measurement problem

The current app makes this impossible to observe as-is:

- **No analytics/telemetry of any kind.** Fully static SPA (`adapter-static`),
  no outbound network calls, no account.
- The only timestamp in stored data is a single global `lastUpdated` (epoch ms),
  refreshed on every save and **omitted from JSON export**
  (`src/lib/stores/app.svelte.ts`, `src/lib/schemas.ts`).
- **No per-entity timestamps, no history.** `updateProfile()` overwrites; prior
  values are lost. No tracking/snapshot/time-series feature exists.

So the experiment must add just enough instrumentation to measure retention —
without collecting any financial data.

## Question & metric

**Question:** Do activated users return and _update an existing financial value_
(not just first-entry) in month 2 / 3 / 6?

**Metric:** an update-retention curve keyed by an anonymous per-device id.

- **Cohort (activation):** ids that complete initial financial-data entry.
- **Retained:** fired a `financial_data_updated` event (a change to a value that
  already existed) in a later week.
- Distinguish `financial_data_first_entry` (category had no value before) from
  `financial_data_updated` (value existed and changed) — you care about _updates_,
  not initial setup.

**Success threshold (set before running):** e.g. **≥30% of activated users update
≥1 value in month 2.** Near-zero kills the source-of-truth thesis. The advisor
tier only needs _annual_ freshness, so even modest monthly retention is positive.

## Consent model — opt-in (decided)

Off by default. A short "help improve Kalkul by sharing anonymous usage" toggle;
instrumentation no-ops until enabled. Fits the OSS/privacy ethos.

**Caveat this creates:** opt-in on a privacy-branded free product undercounts
heavily and skews toward privacy-purists (the least representative users). Treat
the opt-in aggregate as a **lower bound** — a low reading is not conclusive alone.

**Mitigation (primary signal):** run a small **recruited cohort** (~20–50 users
who explicitly agree up front). Same events, same anon-id mechanism, clean
unbiased read. Opt-in aggregate is the sanity check; the cohort is the verdict.

## Minimal implementation sketch

Principles: no new dependency, no financial-schema churn, one thin module,
never transmit amounts.

1. **`src/lib/analytics.ts`** (new — the whole surface):
   - `getAnonId()`: read/create `crypto.randomUUID()` (native, no dep) in its own
     localStorage key (`kalkul-anon-id`), separate from `kalkul-data` so it never
     touches the financial blob or exports.
   - `track(event, props)`: thin wrapper over the chosen backend. Guards: skip on
     SSR/prerender, skip unless opted in. Sends only event name + `category`
     string + a `first_entry`/`changed` flag. **Never amounts.**
   - opt-in state in its own key (`kalkul-analytics-opt-in`), not in the schema.
2. **Init** in `src/routes/+layout.svelte` (client-only): init backend with the
   anon id, fire `app_open` (return-visit signal even without edits).
3. **Event firing** in `appStore.updateProfile()`: diff previous vs next profile
   per category → emit `financial_data_first_entry` or `financial_data_updated`
   with `{ category }`.
4. **Env**: `PUBLIC_*` key/domain for the chosen backend in `.env` + `.env.example`.
5. **UI**: opt-in toggle + one-line disclosure in settings/navbar; i18n keys in
   all active locales (`cs.json`, `en.json`, …). Document exactly what is sent.

### Deliberately skipped (add later)

- Per-entity `updatedAt` timestamps — product value for the advisor tier's
  "what changed since last year," but not needed to measure retention.
- Zero-network fallback (local usage log + "share usage" export) — only if managed
  analytics is rejected on privacy grounds. Higher friction, biased sample.

## Analytics backend — overview (not yet decided)

Must support **per-anon-id retention/cohort analysis**. This rules out
aggregate-only tools (e.g. Plausible), which count updates but can't tell you
whether the _same_ users returned.

**PostHog EU Cloud**

- Pros: Native retention/cohort charts, cookieless option, EU/GDPR hosting, free
  tier; fastest to insight.
- Cons: Data managed by PostHog, not you.

**Self-hosted PostHog**

- Pros: Same capability, you own the data (fits OSS ethos).
- Cons: Setup + ops cost before any signal.

**Own endpoint (CF Worker + KV)**

- Pros: Max control, minimal data.
- Cons: You build the retention analysis; more code, slower.

`analytics.ts` isolates the backend, so the choice is a one-file swap.

## Verification (when built)

- `pnpm check:all` (format, lint, check, knip, check-locales) — new i18n keys in
  all active locales.
- Manual (`pnpm dev`, Network tab): anon id created; `app_open` fires on load;
  editing an existing value fires `financial_data_updated` with **no amount** in
  the payload; first-time entry fires `first_entry`; opting out stops all sends.
- Exported backup JSON still contains no id/opt-in/analytics fields (privacy
  invariant).
- Post-deploy: events land in the dashboard; a retention chart can be built on
  `financial_data_updated` keyed by anon id.

## What "done" looks like

A retention curve (opt-in aggregate + recruited cohort) answering: _do people keep
their financial data current for 3–6 months?_ — measured before a single line of
backend is written.
