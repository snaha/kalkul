# AI Strategy — Positioning AI in Kalkul

_How AI fits the free → cloud → advisor plan. Companion to
`ai-integration-ideas.md` (which explores the local-first plumbing) and
`strategy-assumptions.md` / `differentiating-features.md` (the market thesis)._

The starting instinct: **the free/local model is good for privacy but makes it
hard for AI to reach the data — so AI is naturally a cloud feature.** That's
correct, and it simplifies more than it first appears. But "AI as a cloud selling
point" is only half the idea; the other half is what makes it defensible. Four
points.

---

## 1. Cloud deletes the hard part

The entire `ai-integration-ideas.md` doc — WebSocket bridge, file sync, CRDT,
browser extension, native messaging, WebRTC (approaches 1–8) — exists for **one
reason only**: the data is trapped in `localStorage`, and getting an external
agent to reach it is brittle plumbing (local server the user must start, Firefox
Web-API gaps, sandboxed OPFS, etc.).

In the cloud, all of it evaporates. Data is server-side; you call an LLM API
server-side; done. No bridge, no local process, no browser-compat problems. So
the local-first architecture isn't merely "hard for AI" — it is the _sole_ reason
AI integration looks expensive. Cloud turns it into an ordinary server feature.

**Implication:** most of `ai-integration-ideas.md` is moot once AI lives in the
cloud tier. Keep Approach 6 (export/import, see point 4); the rest was solving a
problem cloud removes.

## 2. "We have AI" is not a moat — it's table stakes

Anyone can bolt a GPT wrapper on. ProjectionLab can too. AI _alone_ is a commodity
and a weak reason to pay. If the pitch is "the cloud version has a chatbot,"
you've built what everyone is building.

The defensible version is **AI × the two things you already own:**

1. **AI × EU tax/pension logic (A1/A2).** An assistant that reasons over _correct
   European decumulation tax_ — CZ 3-year exemption, FR assurance-vie, HU TBSZ,
   SK pillars, state-pension integration. A US GPT-wrapper answers these _wrong_.
   Your engine answers them right; the AI narrates and drives it. That's the moat
   expressed as a conversation.
2. **AI × fresh tracked data.** "Reason over _my actual, current_ finances" only
   works if the data is current — which is the keystone assumption. AI over stale
   data is useless; AI over live data is the reward.

AI is the **delivery mechanism for the approachability wedge** already scoped in
`differentiating-features.md` — B2 (question-first planning), B3 (reverse
planning / solver), D3 ("explain this projection" narrative) — not a new pillar.
Framed that way it amplifies the existing strategy instead of being a bolt-on.

## 3. Privacy segments, it doesn't conflict

The obvious objection: cloud AI means sending financial data to an LLM provider,
which collides with the privacy positioning (C1/C3). It doesn't — it falls exactly
on the tier boundary you already have:

- **Free / local** → private, no account, no AI. Privacy promise intact.
- **Cloud / paid** → the user already opted into cloud; AI is a natural, expected
  part of that. No new promise broken.

The two positions don't fight; they _define_ the tiers. Stated explicitly, this is
an asset, not a compromise.

## 4. Lazy sequencing — don't build a backend to find out

`strategy-assumptions.md` is blunt: the keystone is **tracking retention**, and the
highest-value next move is _proving_ a cohort keeps its data current for 3–6
months — not building backend. AI doesn't change that.

Two consequences:

- **Test AI's value for zero code first.** Approach 6 (export JSON → hand to Claude
  → converse) works _today_. It tells you whether AI-assisted planning has any pull
  before you build the integrated version.
- **AI's highest-leverage role is probably not planning-chat — it's cutting
  tracking friction.** Parse a statement/screenshot → propose updates → user
  approves. That attacks the existential retention risk directly, and it's the
  reward loop that makes tracking sticky. But it comes _after_ retention is
  validated, not before.

---

## Bottom line

Cloud is the right home for AI, and it makes AI cheap to build. But AI is only a
_selling point_ when it's fused with what a US GPT-wrapper can't replicate —
correct EU tax logic and the user's own live data. On its own it's table stakes.
Sequence it behind the tracking-retention proof, validate the conversation's value
with export/import first, and let the cloud/local split carry the privacy story.
